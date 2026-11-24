"""Stage orchestration: probe → plan → encode → assemble → ocr → verify.

Each stage is independently runnable and writes its result where the next one
looks for it, so a long job can be resumed, inspected, or re-run piecemeal.
"""

from __future__ import annotations

import atexit
import concurrent.futures as cf
import os
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path

from . import budget as budget_mod
from . import ocr as ocr_mod
from . import verify as verify_mod
from .assemble import assemble
from .cache import Cache, OcrCache, ocr_source_key, source_key
from .config import Mode, Params
from .encode import encode_page, scratch_dir
from .probe import SourceProbe, probe
from .render import open_doc
from .util import copy_atomic, have, human

STAGES = ("probe", "plan", "encode", "assemble", "ocr", "verify")

#: Headroom held back for the OCR text layer when --ocr is requested.
OCR_RESERVE = 0.04


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
    ocr_dpi: float | None = None
    ocr_psm: int = ocr_mod.DEFAULT_PSM
    ocr_min_conf: float = 25.0
    tessdata_dir: Path | None = None
    verbose: bool = True
    locked_fields: set[str] = field(default_factory=set)
    is_subset: bool = False
    ocr_cache: bool = True
    ocr_force: bool = False

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


def _cleanup() -> None:
    doc = _W.pop("doc", None)
    if doc is not None:
        try:
            doc.close()
        except Exception:
            pass
    scratch = _W.pop("scratch", None)
    if scratch is not None:
        shutil.rmtree(scratch, ignore_errors=True)


def _init(src: str) -> None:
    _W["doc"] = open_doc(src)
    _W["scratch"] = scratch_dir()
    atexit.register(_cleanup)


def _encode_one(task: tuple[int, Params]):
    index, params = task
    return encode_page(_W["doc"], index, params, _W["scratch"])


# --------------------------------------------------------------------------
# stages
# --------------------------------------------------------------------------


def stage_probe(job: Job) -> SourceProbe:
    info = probe(job.src, detect=job.params.detect)
    dpi_note = (
        f"~{info.native_dpi:g}dpi box (effective ~{info.effective_dpi:g}dpi)"
        if info.oversized_mediabox
        else f"~{info.native_dpi:g}dpi"
    )
    job.log(
        f"probe:  {info.page_count} pages, native {dpi_note}, "
        f"ink p0.5={info.median_ink_p05:.0f}, {info.colour_pages * 100:.0f}% colour, "
        f"{info.photo_pages * 100:.0f}% pages with continuous-tone regions "
        f"({info.mean_photo_coverage * 100:.0f}% mean area)"
        + (
            f", text on {info.text_pages * 100:.0f}% sampled pages"
            if info.has_text_layer
            else ""
        )
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
    if info.oversized_mediabox and info.native_dpi > 0 and params.dpi_scale == 1.0:
        params = params.replace(dpi_scale=info.effective_dpi / info.native_dpi)
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


def stage_plan(
    job: Job,
    info: SourceProbe,
    target: int,
    *,
    locked_fields: set[str] | None = None,
) -> budget_mod.Plan:
    """Sample-based parameter search against the size budget."""
    pages = job.pages or list(range(info.page_count))

    def report(params: Params, est: budget_mod.Estimate) -> None:
        verdict = "fits" if est.fits(target) else "over"
        job.log(
            f"  try {budget_mod.describe(params):48s} "
            f"{budget_mod.format_estimate(est)}  [{verdict}]"
        )

    job.log(f"plan:   solving for ≤ {human(target)}")
    plan = budget_mod.solve(
        job.src,
        job.params,
        pages,
        target,
        on_step=report,
        locked_fields=locked_fields if locked_fields is not None else job.locked_fields,
        native_dpi=info.native_dpi,
    )
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
    total_todo = len(todo)
    max_w = min(max(1, job.workers), total_todo, max(1, (os.cpu_count() or 2)))
    with cf.ProcessPoolExecutor(
        max_workers=max_w, initializer=_init, initargs=(str(job.src),)
    ) as ex:
        for page in ex.map(_encode_one, [(i, job.params) for i in todo], chunksize=2):
            cache.save(page)
            finished += 1
            if finished % max(1, job.batch) == 0 or finished == total_todo:
                elapsed = max(time.time() - t0, 0.01)
                rate = finished / elapsed
                seen = cache.total_bytes(job.pages)
                est = seen / max(done + finished, 1) * len(job.pages)
                job.log(
                    f"  … {done + finished}/{len(job.pages)}  {rate:.1f} p/s  "
                    f"ETA {(total_todo - finished) / max(rate, 0.01) / 60:.1f}m  est {human(est)}"
                )


def stage_assemble(job: Job, cache: Cache) -> Path:
    tag = ".preview" if job.is_subset else ""
    dst = job.workdir / f"{job.stem}{tag}.layers.pdf"
    count, with_photos = assemble(
        (cache.load(i) for i in job.pages),
        dst,
        source_pdf=job.src,
        page_indices=job.pages,
        title=job.stem,
    )
    if job.params.mode is Mode.MRC:
        job.log(f"assemble: {with_photos}/{count} pages carry photo patches")
    job.log(f"assemble: {dst.name} ({human(dst.stat().st_size)})")
    return dst


def stage_ocr(job: Job, src: Path) -> Path:
    tessdata = ocr_mod.resolve_tessdata(job.tessdata_dir, job.ocr_langs)
    ok, why = ocr_mod.available(job.ocr_langs, tessdata)
    if not ok:
        raise SystemExit(f"ocr unavailable — {why}")

    for lang, _path, size, best in ocr_mod.model_report(job.ocr_langs, tessdata):
        note = "tessdata_best" if best else "fast/legacy model — run `pdfopt ocr-setup`"
        job.log(f"ocr:    {lang}: {human(size)} ({note})")

    tag = ".preview" if job.is_subset else ""
    dst = job.workdir / f"{job.stem}{tag}.ocr.pdf"

    settings = ocr_mod.OcrSettings(
        langs=job.ocr_langs,
        tessdata_dir=tessdata,
        dpi=job.ocr_dpi,
        psm=job.ocr_psm,
        min_conf=job.ocr_min_conf,
    )
    ocache: OcrCache | None = None
    if job.ocr_cache:
        okey = ocr_source_key(
            job.src,
            langs=job.ocr_langs,
            dpi=job.ocr_dpi,
            psm=job.ocr_psm,
            min_conf=job.ocr_min_conf,
            tessdata_dir=tessdata,
        )
        ocache = OcrCache(job.cache_root, okey)
        ocache.write_meta(
            {
                "source": str(job.src),
                "kind": "ocr",
                "langs": job.ocr_langs,
                "dpi": job.ocr_dpi,
                "psm": job.ocr_psm,
                "min_conf": job.ocr_min_conf,
            }
        )

    dpi_label = "auto" if job.ocr_dpi is None else f"{job.ocr_dpi:g}dpi"
    job.log(
        f"ocr:    tesseract -l {job.ocr_langs} --psm {job.ocr_psm} @ {dpi_label} "
        "from the original scan …"
    )
    t0 = time.time()

    def progress(done: int, total: int, rate: float) -> None:
        job.log(f"  … {done}/{total}  {rate:.1f} p/s  ETA {(total - done) / max(rate, 0.01) / 60:.1f}m")

    try:
        lines = ocr_mod.add_text_layer(
            job.src,
            job.pages,
            src,
            dst,
            settings,
            workers=job.workers,
            progress=progress,
            cache=ocache,
            force=job.ocr_force,
        )
    except Exception:
        dst.unlink(missing_ok=True)
        raise

    job.log(
        f"ocr:    {lines} text lines, {dst.name} "
        f"({human(dst.stat().st_size)}, +{human(dst.stat().st_size - src.stat().st_size)}, "
        f"{(time.time() - t0) / 60:.1f}m)"
    )
    return dst


def stage_verify(job: Job, path: Path) -> verify_mod.Report:
    report = verify_mod.verify(
        path, expect_pages=len(job.pages), expect_text=job.want_ocr
    )
    job.log(f"verify: {report.summary()}")
    if report.failed_pages:
        job.log(f"  pages that failed to decode: {report.failed_pages[:20]}")
    if report.blank_pages:
        job.log(f"  blank pages: {report.blank_pages[:20]}")
    for w in report.warnings:
        job.log(f"  warn: {w}")
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
    if plan:
        planned = stage_plan(job, info, target)
        base, rung, candidates = planned.params, planned.rung, planned.candidates
    else:
        job.log(f"plan:   fixed — {budget_mod.describe(base)}")
        candidates = [base]
        rung = 0

    # The estimate is only a starting point; the measured size decides. Step
    # down the candidate list only when the real file misses.
    layered: Path | None = None
    for attempt in range(max_corrections + 1):
        job.params = base
        cache = Cache(job.cache_root, source_key(job.src, job.params))
        cache.write_meta(
            {
                "source": str(job.src),
                "kind": "encode",
                "mode": job.params.mode.value,
                "params": budget_mod.describe(job.params),
                "pages": len(job.pages),
            }
        )
        stage_encode(job, cache)
        layered = stage_assemble(job, cache)

        size = layered.stat().st_size
        if size <= target or attempt == max_corrections or rung + 1 >= len(candidates):
            break
        rung += 1
        base = candidates[rung]
        job.log(
            f"correct: {human(size)} over the {human(target)} target — "
            f"retrying at {budget_mod.describe(base)}"
        )

    assert layered is not None
    final = stage_ocr(job, layered) if job.want_ocr else layered

    copy_atomic(final, job.out)
    report = stage_verify(job, job.out)

    if not job.is_subset:
        d_chk = open_doc(job.out)
        try:
            toc_n = len(d_chk.get_toc())
        finally:
            d_chk.close()
        if toc_n == 0:
            job.log("note:   output has 0 bookmarks — add TOC via `pdfopt toc` (see bookmarks.md)")

    size = job.out.stat().st_size
    if job.is_subset:
        ref_bytes = job.src.stat().st_size * (len(job.pages) / max(info.page_count, 1))
        ratio = ref_bytes / max(size, 1)
        job.log(f"output: {job.out} ({human(size)}, est. {ratio:.1f}× smaller)")
    else:
        ratio = job.src.stat().st_size / max(size, 1)
        job.log(f"output: {job.out} ({human(size)}, {ratio:.1f}× smaller)")
    subset_budget = int(job.budget_bytes * (len(job.pages) / max(info.page_count, 1)))
    within = size <= subset_budget
    if not within:
        job.log(
            f"warn:   over budget by {human(size - subset_budget)} — "
            "lower --photo-dpi/--photo-quality or --dpi"
        )
    return Result(job.out, report, job.params, within)
