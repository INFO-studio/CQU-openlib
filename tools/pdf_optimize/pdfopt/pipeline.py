"""Stage orchestration: probe → plan → encode → assemble → ocr → verify.

Each stage is independently runnable and writes its result where the next one
looks for it, so a long job can be resumed, inspected, or re-run piecemeal.
"""

from __future__ import annotations

import concurrent.futures as cf
import time
from dataclasses import dataclass, field
from pathlib import Path

from . import budget as budget_mod
from . import ocr as ocr_mod
from . import verify as verify_mod
from .assemble import assemble
from .cache import Cache, source_key
from .config import Mode, Params
from .encode import encode_page, scratch_dir
from .probe import SourceProbe, probe
from .render import open_doc
from .util import copy_atomic, have, human

STAGES = ("probe", "plan", "encode", "assemble", "ocr", "verify")

#: Headroom held back for the OCR text layer when --ocr is requested. Our own
#: layer is a subset CJK font plus one run per line — a few hundred KB.
OCR_RESERVE = 0.02


@dataclass
class Job:
    src: Path
    out: Path
    workdir: Path
    params: Params
    budget_bytes: int
    pages: list[int] = field(default_factory=list)
    workers: int = 4
    batch: int = 64
    want_ocr: bool = False
    ocr_langs: str = ocr_mod.DEFAULT_LANGS
    ocr_dpi: float = 300.0
    ocr_psm: int = ocr_mod.DEFAULT_PSM
    ocr_min_conf: float = 25.0
    tessdata_dir: Path | None = None
    verbose: bool = True

    def log(self, msg: str) -> None:
        if self.verbose:
            print(msg, flush=True)

    @property
    def cache_root(self) -> Path:
        return self.workdir / ".pdfopt"

    @property
    def stem(self) -> str:
        return self.src.stem


# --------------------------------------------------------------------------
# worker plumbing
# --------------------------------------------------------------------------

_W: dict = {}


def _init(src: str) -> None:
    _W["doc"] = open_doc(src)
    _W["scratch"] = scratch_dir()


def _encode_one(task: tuple[int, Params]):
    index, params = task
    return encode_page(_W["doc"], index, params, _W["scratch"])


# --------------------------------------------------------------------------
# stages
# --------------------------------------------------------------------------


def stage_probe(job: Job) -> SourceProbe:
    info = probe(job.src, detect=job.params.detect)
    job.log(
        f"probe:  {info.page_count} pages, native ~{info.native_dpi:g}dpi, "
        f"{info.colour_pages * 100:.0f}% colour, "
        f"{info.photo_pages * 100:.0f}% pages with continuous-tone regions "
        f"({info.mean_photo_coverage * 100:.0f}% mean area)"
        + (", has a text layer already" if info.has_text_layer else "")
    )
    return info


def resolve_params(job: Job, info: SourceProbe) -> Params:
    params = job.params
    if params.mode is Mode.AUTO:
        mode, why = info.recommend()
        job.log(f"mode:   {mode.value} (auto: {why})")
        params = params.replace(mode=mode)
    if params.dpi is None:
        params = params.replace(dpi=info.native_dpi)
    if params.mode in (Mode.GRAY, Mode.COLOR) and params.page_dpi is None:
        params = params.replace(page_dpi=params.dpi)
    return params


def page_budget(job: Job, page_count: int) -> int:
    """Budget scaled to the subset being processed, minus room for OCR."""
    scale = len(job.pages) / max(page_count, 1) if job.pages else 1.0
    target = job.budget_bytes * scale
    if job.want_ocr:
        target *= 1.0 - OCR_RESERVE
    return int(target)


def stage_plan(job: Job, info: SourceProbe, target: int) -> budget_mod.Plan:
    """Sample-based parameter search against the size budget."""
    count = len(job.pages) or info.page_count

    def report(params: Params, est: budget_mod.Estimate) -> None:
        verdict = "fits" if est.fits(target) else "over"
        job.log(
            f"  try {budget_mod.describe(params):48s} "
            f"{budget_mod.format_estimate(est)}  [{verdict}]"
        )

    job.log(f"plan:   solving for ≤ {human(target)}")
    plan = budget_mod.solve(job.src, job.params, count, target, on_step=report)
    if not plan.estimate.fits(target):
        job.log("  warn: nothing on the ladder fits; using the smallest setting")
    job.log(f"plan:   {budget_mod.describe(plan.params)}")
    return plan


def stage_encode(job: Job, cache: Cache) -> None:
    todo = cache.missing(job.pages)
    done = len(job.pages) - len(todo)
    if not todo:
        job.log(f"encode: all {len(job.pages)} pages cached")
        return
    if done:
        job.log(f"encode: resuming, {done}/{len(job.pages)} already cached")

    t0 = time.time()
    finished = 0
    for start in range(0, len(todo), job.batch):
        chunk = todo[start : start + job.batch]
        with cf.ProcessPoolExecutor(
            max_workers=job.workers, initializer=_init, initargs=(str(job.src),)
        ) as ex:
            for page in ex.map(_encode_one, [(i, job.params) for i in chunk], chunksize=2):
                cache.save(page)
                finished += 1
        elapsed = max(time.time() - t0, 0.01)
        rate = finished / elapsed
        seen = cache.total_bytes(job.pages)
        est = seen / max(done + finished, 1) * len(job.pages)
        job.log(
            f"  … {done + finished}/{len(job.pages)}  {rate:.1f} p/s  "
            f"ETA {(len(todo) - finished) / max(rate, 0.01) / 60:.1f}m  est {human(est)}"
        )


def stage_assemble(job: Job, cache: Cache) -> Path:
    dst = job.workdir / f"{job.stem}.layers.pdf"
    pages = [cache.load(i) for i in job.pages]
    with_photos = sum(1 for p in pages if any(x.rect_px for x in p.layers))
    if job.params.mode is Mode.MRC:
        job.log(f"assemble: {with_photos}/{len(pages)} pages carry photo patches")
    assemble(pages, dst, title=job.stem)
    job.log(f"assemble: {dst.name} ({human(dst.stat().st_size)})")
    return dst


def stage_ocr(job: Job, src: Path) -> Path:
    tessdata = ocr_mod.resolve_tessdata(job.tessdata_dir)
    ok, why = ocr_mod.available(job.ocr_langs, tessdata)
    if not ok:
        job.log(f"ocr:    skipped — {why}")
        return src

    for lang, path, size, best in ocr_mod.model_report(job.ocr_langs, tessdata):
        note = "tessdata_best" if best else "fast/legacy model — run `pdfopt ocr-setup`"
        job.log(f"ocr:    {lang}: {human(size)} ({note})")

    dst = job.workdir / f"{job.stem}.ocr.pdf"
    if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime:
        job.log(f"ocr:    reusing {dst.name} ({human(dst.stat().st_size)})")
        return dst

    settings = ocr_mod.OcrSettings(
        langs=job.ocr_langs,
        tessdata_dir=tessdata,
        dpi=job.ocr_dpi,
        psm=job.ocr_psm,
        min_conf=job.ocr_min_conf,
    )
    job.log(
        f"ocr:    tesseract -l {job.ocr_langs} --psm {job.ocr_psm} @ {job.ocr_dpi:g}dpi "
        "from the original scan (the slow stage) …"
    )
    t0 = time.time()

    def progress(done: int, total: int, rate: float) -> None:
        job.log(f"  … {done}/{total}  {rate:.1f} p/s  ETA {(total - done) / max(rate, 0.01) / 60:.1f}m")

    try:
        lines = ocr_mod.add_text_layer(
            job.src, job.pages, src, dst, settings, workers=job.workers, progress=progress
        )
    except Exception as exc:
        job.log(f"ocr:    failed ({exc}); keeping the un-OCRed PDF")
        dst.unlink(missing_ok=True)
        return src
    job.log(
        f"ocr:    {lines} text lines, {dst.name} "
        f"({human(dst.stat().st_size)}, +{human(dst.stat().st_size - src.stat().st_size)}, "
        f"{(time.time() - t0) / 60:.1f}m)"
    )
    return dst


def stage_verify(job: Job, path: Path) -> verify_mod.Report:
    report = verify_mod.verify(path, expect_pages=len(job.pages))
    job.log(f"verify: {report.summary()}")
    if report.failed_pages:
        job.log(f"  pages that failed to decode: {report.failed_pages[:20]}")
    return report


# --------------------------------------------------------------------------
# whole chain
# --------------------------------------------------------------------------


@dataclass
class Result:
    out: Path
    report: verify_mod.Report
    params: Params
    within_budget: bool


def run(job: Job, *, plan: bool = True, max_corrections: int = 3) -> Result:
    if job.params.mode.binarizes() and not have("jbig2"):
        raise SystemExit("missing jbig2enc — brew install jbig2enc")

    info = stage_probe(job)
    job.params = resolve_params(job, info)
    if not job.pages:
        job.pages = list(range(info.page_count))
    if job.params.mode.binarizes() and not have("jbig2"):
        raise SystemExit("missing jbig2enc — brew install jbig2enc")

    target = page_budget(job, info.page_count)
    base = job.params
    rungs = budget_mod.ladder_for(base.mode)
    rung = 0
    if plan:
        planned = stage_plan(job, info, target)
        base, rung = planned.params, planned.rung
    else:
        job.log(f"plan:   fixed — {budget_mod.describe(base)}")
        rungs = [{}]  # honour the given settings verbatim

    # The estimate is only a starting point; the measured size decides. Step
    # down the ladder only when the real file misses, so photo quality is
    # never given up on a pessimistic guess.
    layered: Path | None = None
    for attempt in range(max_corrections + 1):
        job.params = base
        cache = Cache(job.cache_root, source_key(job.src, job.params))
        cache.write_meta(
            {
                "source": str(job.src),
                "mode": job.params.mode.value,
                "params": budget_mod.describe(job.params),
                "pages": len(job.pages),
            }
        )
        stage_encode(job, cache)
        layered = stage_assemble(job, cache)

        size = layered.stat().st_size
        if size <= target or attempt == max_corrections or rung + 1 >= len(rungs):
            break
        rung += 1
        base = budget_mod.apply_rung(base, rungs[rung])
        job.log(
            f"correct: {human(size)} over the {human(target)} target — "
            f"retrying at {budget_mod.describe(base)}"
        )

    assert layered is not None
    final = stage_ocr(job, layered) if job.want_ocr else layered

    copy_atomic(final, job.out)
    report = stage_verify(job, job.out)

    size = job.out.stat().st_size
    ratio = job.src.stat().st_size / max(size, 1)
    job.log(f"output: {job.out} ({human(size)}, {ratio:.1f}× smaller)")
    within = size <= job.budget_bytes
    if not within:
        job.log(
            f"warn:   over budget by {human(size - job.budget_bytes)} — "
            "lower --photo-dpi/--photo-quality"
        )
    return Result(job.out, report, job.params, within)
