"""Single entry point.

    pdfopt run        INPUT.pdf        # whole chain
    pdfopt probe      INPUT.pdf        # what is this file, which mode suits it
    pdfopt plan       INPUT.pdf        # sample and solve, without a full pass
    pdfopt continuous INPUT.pdf        # native pixels → continuous grayscale JPEG 2000
    pdfopt ocr        INPUT.pdf        # add searchable text layer only
    pdfopt verify     OUTPUT.pdf       # does it open, does every page decode
    pdfopt toc        ...              # inspect/export/apply PDF bookmarks + PageLabels
    pdfopt ocr-setup                   # fetch the good tesseract models
    pdfopt ocr-check                   # which models would be used
    pdfopt clean      INPUT.pdf        # drop cached page artifacts for INPUT.pdf
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import sys
import time
from pathlib import Path

from . import budget as budget_mod
from . import continuous as continuous_mod
from . import ocr as ocr_mod
from . import toc as toc_mod
from . import verify as verify_mod
from .cache import OcrCache, _name_hash, ocr_source_key
from .config import Bilevel, Detect, Mode, Params, Tone
from .pipeline import Job, page_budget, resolve_params, run as run_pipeline, stage_plan
from .probe import probe as probe_source
from .util import human


def _default_workers() -> int:
    return max(1, (os.cpu_count() or 4) - 1)


def parse_pages(spec: str | None, count: int) -> list[int]:
    """1-based, inclusive: "1-20,285" → indices. Rejects invalid/empty/reversed ranges."""
    if spec is None:
        return []
    if not spec.strip():
        raise SystemExit("empty --pages specification")
    out: list[int] = []
    for raw_part in spec.split(","):
        part = raw_part.strip()
        if not part:
            raise SystemExit(f"empty token in --pages: {spec!r}")
        if "-" in part:
            a_s, b_s = part.split("-", 1)
            try:
                a, b = int(a_s.strip()), int(b_s.strip())
            except ValueError as exc:
                raise SystemExit(f"invalid --pages range {part!r}") from exc
            if a < 1 or b < 1:
                raise SystemExit(f"--pages is 1-based; got {part!r}")
            if a > b:
                raise SystemExit(f"invalid reversed --pages range {part!r}")
            if a > count:
                raise SystemExit(f"--pages {part!r} exceeds page count ({count})")
            out.extend(range(a - 1, min(b, count)))
        else:
            try:
                n = int(part)
            except ValueError as exc:
                raise SystemExit(f"invalid --pages page number {part!r}") from exc
            if n < 1:
                raise SystemExit(f"--pages is 1-based; got {part!r}")
            if n > count:
                raise SystemExit(f"--pages {part!r} exceeds page count ({count})")
            out.append(n - 1)
    if not out:
        raise SystemExit(f"--pages {spec!r} selected no valid pages")
    return sorted(set(out))


def add_tuning(ap: argparse.ArgumentParser) -> None:
    g = ap.add_argument_group("quality")
    g.add_argument(
        "--mode",
        type=Mode,
        choices=list(Mode),
        default=Mode.AUTO,
        help="auto | mrc (JBIG2 text + photo patches) | bilevel | gray | color. "
        "mrc and bilevel binarize text — great for printed scans, wrong for "
        "handwriting or photo books",
    )
    g.add_argument("--dpi", type=float, default=None, help="text/page DPI (default: native)")
    g.add_argument("--photo-dpi", type=float, default=None, help="MRC photo patch DPI")
    g.add_argument("--photo-quality", type=int, default=None, help="MRC photo patch JPEG quality")
    g.add_argument("--page-dpi", type=float, default=None, help="gray/color whole-page DPI")
    g.add_argument("--page-quality", type=int, default=None, help="gray/color JPEG quality")
    b = ap.add_argument_group("binarization (mrc/bilevel text layer)")
    b.add_argument(
        "--bilevel-min-dpi",
        type=float,
        default=None,
        help="resample the text layer up to at least this before thresholding "
        "(default 300); a low-DPI scan cannot represent its own stroke edges "
        "on a 1-bit grid",
    )
    b.add_argument(
        "--text-smooth",
        type=float,
        default=None,
        help="Gaussian sigma in source pixels applied before thresholding "
        "(default 0.3); 0 disables",
    )
    b.add_argument(
        "--sauvola-k",
        type=float,
        default=None,
        help="local threshold strictness (default 0.2); raise for thinner "
        "strokes, lower for fuller ones",
    )
    b.add_argument(
        "--sauvola-window-in",
        type=float,
        default=None,
        help="local threshold window in inches (default 0.10, about one glyph)",
    )
    b.add_argument(
        "--bw-threshold",
        type=int,
        default=None,
        help="escape hatch: one fixed cut level for the whole page instead of "
        "the local threshold. Only worth it when Sauvola misreads a page",
    )
    g.add_argument(
        "--no-patch-color",
        action="store_true",
        help="force photo patches to grayscale",
    )

    t = ap.add_argument_group("exposure")
    t.add_argument(
        "--text-contrast",
        type=float,
        default=None,
        metavar="PCT",
        help="deepen faint ink, 0-100 (default 0 = keep the scan's exposure). "
        "Reads each page's own ink and paper levels and pulls them towards "
        "black and white. A tone curve, not a threshold: nothing merges and "
        "no stroke can break, unlike --mode bilevel. Costs size — expanding "
        "contrast expands the scan's grain with it",
    )
    t.add_argument(
        "--drop-showthrough",
        type=float,
        default=None,
        metavar="PCT",
        help="flatten to white anything fainter than this far from paper "
        "towards ink, 0-100 (default 0 = off). Removes the next page's ghost, "
        "which --text-contrast would otherwise deepen along with the type. "
        "Try 20; measure first, the two populations must not overlap",
    )

    d = ap.add_argument_group("region detection")
    d.add_argument("--seed-white", type=float, default=None, help="paper-white fraction below which a block is definitely continuous-tone (default 0.25)")
    d.add_argument("--grow-white", type=float, default=None, help="paper-white fraction a detected region may grow across (default 0.60)")
    d.add_argument("--min-photo-in2", type=float, default=None, help="ignore photo regions smaller than this many square inches")
    d.add_argument(
        "--white-level",
        type=int,
        default=None,
        help="grey level counted as paper (default 235); lower it to ~225 so "
        "pale tinted bands read as paper and stay in the text layer, where "
        "the tint drops out and the heading stays sharp",
    )
    d.add_argument(
        "--tint-std",
        type=float,
        default=None,
        help="also treat flat low-contrast areas (pale tints, background "
        "watermarks) as continuous-tone; try 6.0. Off by default because it "
        "can also catch sparse text",
    )
    d.add_argument(
        "--chroma-seed",
        type=float,
        default=None,
        help="chrominance pixel fraction to seed coloured line plots/highlights "
        "(default 0.08; 0 disables)",
    )


def build_params(args) -> tuple[Params, set[str]]:
    detect = Detect()
    over = {
        k: v
        for k, v in (
            ("seed_white", args.seed_white),
            ("grow_white", args.grow_white),
            ("min_area_in2", args.min_photo_in2),
            ("white_level", args.white_level),
            ("seed_flat_std", args.tint_std),
            ("seed_chroma", getattr(args, "chroma_seed", None)),
        )
        if v is not None
    }
    if over:
        detect = Detect(**{**detect.__dict__, **over})

    bilevel = Bilevel()
    over = {
        k: v
        for k, v in (
            ("min_dpi", args.bilevel_min_dpi),
            ("smooth", args.text_smooth),
            ("k", args.sauvola_k),
            ("window_in", args.sauvola_window_in),
            ("global_threshold", args.bw_threshold),
        )
        if v is not None
    }
    if over:
        bilevel = Bilevel(**{**bilevel.__dict__, **over})

    def pct(value):
        return max(0.0, min(100.0, value)) / 100.0

    tone = Tone()
    if args.text_contrast is not None or args.drop_showthrough is not None:
        tone = Tone(
            strength=pct(args.text_contrast or 0.0),
            showthrough=pct(args.drop_showthrough or 0.0),
        )

    params = Params(mode=args.mode, dpi=args.dpi, detect=detect, bilevel=bilevel, tone=tone)
    locked: set[str] = set()
    if args.dpi is not None:
        locked.add("dpi")
    if args.bilevel_min_dpi is not None:
        locked.add("bilevel_min_dpi")
    for field_name, value in (
        ("photo_dpi", args.photo_dpi),
        ("photo_quality", args.photo_quality),
        ("page_dpi", args.page_dpi),
        ("page_quality", args.page_quality),
    ):
        if value is not None:
            params = params.replace(**{field_name: value})
            locked.add(field_name)
    if args.no_patch_color:
        params = params.replace(keep_patch_color=False)
    return params, locked


def build_job(args, params: Params, locked_fields: set[str] | None = None) -> Job:
    src = args.input.expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"not a file: {src}")
    workdir = (args.workdir or src.parent / "out").expanduser().resolve()
    workdir.mkdir(parents=True, exist_ok=True)

    from .render import open_doc

    doc = open_doc(src)
    count = doc.page_count
    doc.close()
    raw_pages = getattr(args, "pages", None)
    pages = parse_pages(raw_pages, count)
    is_subset = bool(raw_pages is not None and len(pages) < count)

    suffix = ".preview" if is_subset else ""
    out = args.out.expanduser().resolve() if args.out else workdir / f"{src.stem}{suffix}.pdf"
    return Job(
        src=src,
        out=out,
        workdir=workdir,
        params=params,
        budget_bytes=int(args.max_mb * 1048576),
        pages=pages,
        workers=args.workers,
        batch=args.batch,
        want_ocr=getattr(args, "ocr", False),
        ocr_langs=getattr(args, "ocr_langs", ocr_mod.DEFAULT_LANGS),
        ocr_dpi=getattr(args, "ocr_dpi", None),
        ocr_psm=getattr(args, "ocr_psm", ocr_mod.DEFAULT_PSM),
        ocr_min_conf=getattr(args, "ocr_min_conf", 25.0),
        tessdata_dir=getattr(args, "tessdata_dir", None),
        locked_fields=locked_fields or set(),
        is_subset=is_subset,
        ocr_cache=not getattr(args, "no_cache", False),
        ocr_force=getattr(args, "force", False),
    )


def _format_run_command(
    src: Path,
    chosen: Params,
    args,
) -> str:
    parts = ["pdfopt", "run", shlex.quote(src.name), "--no-plan", "--mode", chosen.mode.value]
    if chosen.dpi is not None:
        parts += ["--dpi", f"{chosen.dpi:g}"]
    if chosen.mode is Mode.MRC:
        parts += ["--photo-dpi", f"{chosen.photo_dpi:g}", "--photo-quality", str(chosen.photo_quality)]
    elif chosen.mode in (Mode.GRAY, Mode.COLOR):
        parts += [
            "--page-dpi",
            f"{(chosen.page_dpi or chosen.dpi or 300.0):g}",
            "--page-quality",
            str(chosen.page_quality),
        ]
    if not chosen.keep_patch_color:
        parts.append("--no-patch-color")
    if chosen.tone.strength > 0:
        parts += ["--text-contrast", f"{chosen.tone.strength * 100:g}"]
    if chosen.tone.showthrough > 0:
        parts += ["--drop-showthrough", f"{chosen.tone.showthrough * 100:g}"]

    def_b = Bilevel()
    if chosen.bilevel.min_dpi != def_b.min_dpi:
        parts += ["--bilevel-min-dpi", f"{chosen.bilevel.min_dpi:g}"]
    if chosen.bilevel.smooth != def_b.smooth:
        parts += ["--text-smooth", f"{chosen.bilevel.smooth:g}"]
    if chosen.bilevel.k != def_b.k:
        parts += ["--sauvola-k", f"{chosen.bilevel.k:g}"]
    if chosen.bilevel.window_in != def_b.window_in:
        parts += ["--sauvola-window-in", f"{chosen.bilevel.window_in:g}"]
    if chosen.bilevel.global_threshold is not None:
        parts += ["--bw-threshold", str(chosen.bilevel.global_threshold)]

    def_d = Detect()
    if chosen.detect.seed_white != def_d.seed_white:
        parts += ["--seed-white", f"{chosen.detect.seed_white:g}"]
    if chosen.detect.grow_white != def_d.grow_white:
        parts += ["--grow-white", f"{chosen.detect.grow_white:g}"]
    if chosen.detect.min_area_in2 != def_d.min_area_in2:
        parts += ["--min-photo-in2", f"{chosen.detect.min_area_in2:g}"]
    if chosen.detect.white_level != def_d.white_level:
        parts += ["--white-level", str(chosen.detect.white_level)]
    if chosen.detect.seed_flat_std != def_d.seed_flat_std:
        parts += ["--tint-std", f"{chosen.detect.seed_flat_std:g}"]
    if chosen.detect.seed_chroma != def_d.seed_chroma:
        parts += ["--chroma-seed", f"{chosen.detect.seed_chroma:g}"]

    if args.max_mb != 100.0:
        parts += ["--max-mb", f"{args.max_mb:g}"]
    if getattr(args, "pages", None):
        parts += ["--pages", shlex.quote(args.pages)]
    if getattr(args, "ocr", False):
        parts.append("--ocr")
    return " ".join(parts)


# --------------------------------------------------------------------------
# commands
# --------------------------------------------------------------------------


def cmd_run(args) -> int:
    params, locked = build_params(args)
    job = build_job(args, params, locked)
    result = run_pipeline(job, plan=not args.no_plan)
    if not result.report.ok:
        return 1
    return 0 if result.within_budget else 2


def cmd_probe(args) -> int:
    src = args.input.expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"not a file: {src}")
    info = probe_source(src, samples=args.samples)
    mode, why = info.recommend()
    wf, wf_why = info.recommend_workflow()
    print(f"file:         {src}")
    print(f"size:         {human(info.size)}  ({info.page_count} pages)")
    w_in, h_in = info.median_page_size_in
    print(f"page size:    {w_in:.2f} × {h_in:.2f} in")
    if info.median_image_px:
        pw, ph = info.median_image_px
        box_note = "  [OVERSIZED MediaBox — PDF-pt DPI is misleading!]" if info.oversized_mediabox else ""
        print(f"image px:     {pw} × {ph} px{box_note}")
    dpi_str = f"~{info.native_dpi:g}"
    if info.oversized_mediabox:
        dpi_str += f" (effective ~{info.effective_dpi:g})"
    print(f"native dpi:   {dpi_str}")
    ink_note = "  [faint exposure — do NOT binarize]" if info.median_ink_p05 > 100.0 else ""
    print(f"exposure:     ink p0.5={info.median_ink_p05:.0f}, paper p80={info.median_paper_p80:.0f}{ink_note}")
    print(
        f"text/meta:    text on {info.text_pages * 100:.0f}% sampled pages, "
        f"annots on {info.annot_pages} sampled page(s), {info.toc_count} bookmark(s)"
    )
    print(f"colour:       {info.colour_pages * 100:.0f}% of sampled pages")
    print(
        f"photos:       {info.photo_pages * 100:.0f}% of pages carry continuous-tone "
        f"regions, {info.mean_photo_coverage * 100:.0f}% of page area on average"
    )
    print(f"single-image: {info.single_image_pages * 100:.0f}% of sampled pages")
    print(f"recommended:  --mode {mode.value}  ({why})")
    print(f"workflow:     {wf}  ({wf_why})")
    if (0.0 < info.text_pages < 0.25) or info.annot_pages > 0:
        print("warn:         sparse text or annotations found — inspect for ads before running (ad-removal.md)")
    if info.toc_count == 0:
        print("note:         no bookmarks (toc=0) — after processing, generate TOC via `pdfopt toc` (bookmarks.md)")
    if args.per_page:
        print("\n  page  colourfulness  photo coverage  ink_p05  text")
        for p in info.sampled:
            print(
                f"  {p.index + 1:5d}  {p.colourfulness:13.1f}  {p.photo_coverage * 100:13.0f}%  "
                f"{p.ink_p05:7.0f}  {'yes' if p.has_text else 'no'}"
            )
    return 0


def cmd_plan(args) -> int:
    params, locked = build_params(args)
    src = args.input.expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"not a file: {src}")
    info = probe_source(src, detect=params.detect)
    job = build_job(args, params, locked)
    job.pages = job.pages or list(range(info.page_count))
    job.params = resolve_params(job, info)
    chosen = stage_plan(job, info, page_budget(job, info.page_count), locked_fields=locked).params
    print(f"\nrun this:\n  {_format_run_command(src, chosen, args)}")
    return 0


def cmd_verify(args) -> int:
    report = verify_mod.verify(args.input.expanduser().resolve(), deep=not args.shallow)
    print(f"{report.path.name}: {report.summary()}")
    if report.failed_pages:
        print(f"  failed pages: {report.failed_pages}")
    if report.blank_pages:
        print(f"  blank pages:  {report.blank_pages}")
    for w in report.warnings:
        print(f"  warning:      {w}")
    return 0 if report.ok else 1


def cmd_continuous(args) -> int:
    """Re-encode native scan images as continuous grayscale JPEG 2000."""
    src = args.input.expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"not a file: {src}")
    if args.ratio is not None and args.psnr is not None:
        raise SystemExit("specify either --ratio or --psnr, not both")

    workdir = (args.workdir or src.parent / "out").expanduser().resolve()
    workdir.mkdir(parents=True, exist_ok=True)

    from .render import open_doc

    doc = open_doc(src)
    count = doc.page_count
    doc.close()
    pages = parse_pages(args.pages, count)
    is_subset = bool(args.pages is not None and len(pages) < count)
    suffix = ".preview" if is_subset else ".continuous"
    dst = args.out.expanduser().resolve() if args.out else workdir / f"{src.stem}{suffix}.pdf"

    psnr = args.psnr
    ratio = args.ratio
    if psnr is None and ratio is None:
        try:
            psnr = continuous_mod.solve_psnr(
                src,
                int(args.max_mb * 1048576),
                keep_first_colour=args.keep_first_colour,
                keep_last_colour=args.keep_last_colour,
                auto_colour=args.auto_colour,
                pages=pages or None,
            )
            print(f"continuous: auto-solved PSNR {psnr:g} dB for ≤ {args.max_mb:g} MB")
        except (RuntimeError, ValueError) as exc:
            raise SystemExit(f"continuous unavailable — {exc}") from exc

    mode_desc = f"PSNR {psnr:g} dB" if psnr is not None else f"{ratio:g}:1"
    colour_desc = (
        "auto-colour"
        if args.auto_colour
        else f"keep first {args.keep_first_colour} and last {args.keep_last_colour} page(s) in colour"
    )
    print(f"continuous: native pixels, 8-bit grayscale JPEG 2000 ({mode_desc}); {colour_desc}")
    try:
        result = continuous_mod.reencode(
            src,
            dst,
            ratio=ratio,
            psnr=psnr,
            keep_first_colour=args.keep_first_colour,
            keep_last_colour=args.keep_last_colour,
            auto_colour=args.auto_colour,
            pages=pages or None,
            workers=args.workers,
            progress=lambda done, total, rate, size: print(
                f"  … {done}/{total}  {rate:.1f} p/s  {human(size)} images"
            ),
        )
    except (RuntimeError, ValueError) as exc:
        raise SystemExit(f"continuous unavailable — {exc}") from exc
    report = verify_mod.verify(dst, expect_pages=result.page_count)
    print(f"verify: {report.summary()}")
    print(f"output: {dst} ({human(result.output_bytes)}, {result.kept_colour_pages} colour page(s) kept)")
    if not is_subset:
        from .render import open_doc as _open_doc

        d_chk = _open_doc(dst)
        try:
            if len(d_chk.get_toc()) == 0:
                print("note:   output has 0 bookmarks — add TOC via `pdfopt toc` (see bookmarks.md)")
        finally:
            d_chk.close()
    target_bytes = int(args.max_mb * 1048576 * ((len(pages) or count) / max(count, 1)))
    if result.output_bytes > target_bytes:
        hint = "lower --psnr" if psnr is not None else "raise --ratio or use --psnr"
        print(
            f"warn:   over budget by "
            f"{human(result.output_bytes - target_bytes)} — {hint}"
        )
        return 2
    return 0 if report.ok else 1


def cmd_ocr(args) -> int:
    """Add a text layer without changing the target PDF's image streams."""
    target = args.input.expanduser().resolve()
    ocr_src = (args.ocr_source or target).expanduser().resolve()
    for label, path in (("input", target), ("OCR source", ocr_src)):
        if not path.is_file():
            raise SystemExit(f"{label} is not a file: {path}")
    workdir = (args.workdir or target.parent / "out").expanduser().resolve()
    workdir.mkdir(parents=True, exist_ok=True)
    dst = args.out.expanduser().resolve() if args.out else workdir / f"{target.stem}.ocr.pdf"
    if dst == target:
        raise SystemExit("--out would overwrite the input; pick another path")
    if dst == ocr_src:
        raise SystemExit("--out would overwrite the OCR source; pick another path")

    tessdata = ocr_mod.resolve_tessdata(args.tessdata_dir, args.ocr_langs)
    ok, why = ocr_mod.available(args.ocr_langs, tessdata)
    if not ok:
        raise SystemExit(f"ocr unavailable — {why}")
    for lang, _path, size, best in ocr_mod.model_report(args.ocr_langs, tessdata):
        note = "tessdata_best" if best else "fast/legacy model — run `pdfopt ocr-setup`"
        print(f"ocr:    {lang}: {human(size)} ({note})")

    from .render import open_doc

    target_doc = open_doc(target)
    count = target_doc.page_count
    target_doc.close()
    ocr_doc = open_doc(ocr_src)
    ocr_count = ocr_doc.page_count
    ocr_doc.close()
    if count != ocr_count:
        raise SystemExit(f"page count mismatch: input has {count}, OCR source has {ocr_count}")

    ocache: OcrCache | None = None
    if not args.no_cache:
        okey = ocr_source_key(
            ocr_src,
            langs=args.ocr_langs,
            dpi=args.ocr_dpi,
            psm=args.ocr_psm,
            min_conf=args.ocr_min_conf,
            tessdata_dir=tessdata,
        )
        ocache = OcrCache(workdir / ".pdfopt", okey)
        ocache.write_meta(
            {
                "source": str(ocr_src),
                "kind": "ocr",
                "langs": args.ocr_langs,
                "dpi": args.ocr_dpi,
                "psm": args.ocr_psm,
                "min_conf": args.ocr_min_conf,
            }
        )

    t0 = time.time()
    source_note = "" if ocr_src == target else f" from {ocr_src.name}"
    dpi_label = "auto" if args.ocr_dpi is None else f"{args.ocr_dpi:g}dpi"
    print(
        f"ocr:    tesseract -l {args.ocr_langs} --psm {args.ocr_psm} @ {dpi_label}, "
        f"{count} pages{source_note}; target images untouched …"
    )
    try:
        lines = ocr_mod.add_text_layer(
            ocr_src,
            list(range(count)),
            target,
            dst,
            ocr_mod.OcrSettings(
                langs=args.ocr_langs,
                tessdata_dir=tessdata,
                dpi=args.ocr_dpi,
                psm=args.ocr_psm,
                min_conf=args.ocr_min_conf,
            ),
            workers=args.workers,
            progress=lambda done, total, rate: print(
                f"  … {done}/{total}  {rate:.1f} p/s  ETA {(total - done) / max(rate, 0.01) / 60:.1f}m"
            ),
            cache=ocache,
            force=args.force,
        )
    except ValueError as exc:
        raise SystemExit(f"ocr refused — {exc}") from exc
    print(
        f"ocr:    {lines} text lines, {dst.name} ({human(dst.stat().st_size)}, "
        f"+{human(dst.stat().st_size - target.stat().st_size)}, {(time.time() - t0) / 60:.1f}m)"
    )
    report = verify_mod.verify(dst, expect_pages=count, expect_text=True)
    print(f"verify: {report.summary()}")
    for w in report.warnings:
        print(f"  warning: {w}")
    return 0 if report.ok else 1


def cmd_ocr_setup(args) -> int:
    print("mirroring system tessdata and fetching tessdata_best models")
    dest, smoke_ok = ocr_mod.setup_best(args.langs, dest=args.tessdata_dir)
    print(f"tessdata: {dest}")
    check_rc = cmd_ocr_check(args)
    return 0 if (smoke_ok and check_rc == 0) else 1


def cmd_ocr_check(args) -> int:
    tessdata = ocr_mod.resolve_tessdata(args.tessdata_dir, args.langs)
    print(f"tesseract:  {'found' if ocr_mod.have('tesseract') else 'NOT FOUND'}")
    print(f"tessdata:   {tessdata or ocr_mod.system_tessdata()} "
          f"({'local mirror' if tessdata else 'system'})")
    ok = True
    for lang, path, size, best in ocr_mod.model_report(args.langs, tessdata):
        if path is None:
            print(f"  {lang}: MISSING")
            ok = False
            continue
        kind = "tessdata_best" if best else "fast/legacy"
        print(f"  {lang}: {human(size)}  {kind}")
        if not best:
            print("      → run `pdfopt ocr-setup` for markedly better CJK accuracy")
    return 0 if ok else 1


def cmd_toc_show(args) -> int:
    src = args.input.expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"not a file: {src}")
    from .render import open_doc

    doc = open_doc(src)
    try:
        toc = doc.get_toc(simple=True)
        labels = doc.get_page_labels()
        print(f"file:       {src.name} ({doc.page_count} pages)")
        print(f"bookmarks:  {len(toc)}")
        print(f"pagelabels: {labels or 'none'}")
        for level, title, page in toc:
            indent = "  " * max(0, level - 1)
            print(f"{indent}{title}  @{page}")
    finally:
        doc.close()
    return 0


def cmd_toc_pages(args) -> int:
    src = args.input.expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"not a file: {src}")
    from .render import open_doc

    doc = open_doc(src)
    count = doc.page_count
    doc.close()
    spec = args.pages or f"1-{min(16, count)}"
    pages = parse_pages(spec, count)
    out_dir = (args.out_dir or src.parent / f"{src.stem}_toc_pages").expanduser().resolve()
    written = toc_mod.export_toc_pages(src, out_dir, pages, dpi=args.dpi)
    print(f"exported {len(written)} page image(s) to {out_dir}")
    return 0


def cmd_toc_apply(args) -> int:
    src = args.input.expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"not a file: {src}")
    dst = args.out.expanduser().resolve() if args.out else src

    if str(args.source) == "-":
        raw_text = sys.stdin.read()
    else:
        toc_file = Path(args.source).expanduser().resolve()
        if not toc_file.is_file():
            raise SystemExit(f"not a file: {toc_file}")
        raw_text = toc_file.read_text(encoding="utf-8")

    from .render import open_doc

    doc = open_doc(src)
    count = doc.page_count
    doc.close()

    try:
        entries, warnings = toc_mod.parse_toc_text(
            raw_text, offset=args.offset, page_count=count
        )
    except ValueError as exc:
        raise SystemExit(f"invalid TOC: {exc}") from exc

    for w in warnings:
        print(f"warn:   {w}")

    check = toc_mod.verify_toc_against_text(src, entries)
    if check.checked > 0:
        print(
            f"check:  {check.hits}/{check.checked} heading hits at offset {args.offset} "
            f"(offset-1: {check.hits_minus_1}, offset+1: {check.hits_plus_1})"
        )
    for w in check.warnings:
        print(f"warn:   {w}")

    if args.strict and (warnings or (check.checked >= 5 and (check.hits_minus_1 > check.hits or check.hits_plus_1 > check.hits))):
        raise SystemExit("aborted by --strict due to TOC warnings or suspected offset error")

    body_start: int | None = args.body_start
    if body_start is None and args.page_labels:
        body_start = args.offset + 1 if args.offset > 0 else 1

    try:
        toc_mod.apply_toc(src, dst, entries, body_start_page=body_start)
    except ValueError as exc:
        raise SystemExit(f"toc failed: {exc}") from exc

    report = verify_mod.verify(dst, expect_pages=count)
    label_note = f", PageLabels from body p{body_start}" if body_start else ""
    print(f"toc:    wrote {len(entries)} bookmark(s){label_note} -> {dst.name}")
    print(f"verify: {report.summary()}")
    for w in report.warnings:
        print(f"  warning: {w}")
    return 0 if report.ok else 1


def cmd_clean(args) -> int:
    if args.all:
        base_dir = (
            args.workdir
            or (args.input.expanduser().resolve().parent / "out" if args.input else Path.cwd() / "out")
        ).expanduser().resolve()
        root = base_dir / ".pdfopt"
        if not root.exists():
            print("nothing cached")
            return 0
        total = sum(f.stat().st_size for f in root.rglob("*") if f.is_file())
        shutil.rmtree(root)
        print(f"removed {root} ({human(total)})")
        return 0

    if args.input is None:
        raise SystemExit("provide INPUT.pdf or pass --all")
    src = args.input.expanduser().resolve()
    root = (args.workdir or src.parent / "out").expanduser().resolve() / ".pdfopt"
    if not root.exists():
        print("nothing cached")
        return 0

    name_prefix = f"{_name_hash(src)}-"
    removed_bytes = 0
    removed_dirs = 0
    for entry in root.iterdir():
        if not entry.is_dir():
            continue
        meta_path = entry / "meta.json"
        matched = False
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text())
                if meta.get("source") == str(src):
                    matched = True
            except Exception:
                pass
        if not matched and name_prefix in entry.name:
            matched = True
        if matched:
            removed_bytes += sum(f.stat().st_size for f in entry.rglob("*") if f.is_file())
            shutil.rmtree(entry)
            removed_dirs += 1

    if not removed_dirs:
        print(f"nothing cached for {src.name}")
        return 0
    print(f"removed {removed_dirs} cache dir(s) for {src.name} ({human(removed_bytes)})")
    return 0


# --------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="pdfopt",
        description="Shrink scanned PDFs without wrecking the text.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("input", type=Path)
        p.add_argument("--workdir", type=Path, default=None, help="default: <input dir>/out")
        p.add_argument("--workers", type=int, default=_default_workers())
        p.add_argument("--batch", type=int, default=64, help="pages per encode progress tick")

    r = sub.add_parser("run", help="probe → plan → encode → assemble → ocr → verify")
    common(r)
    r.add_argument("--out", type=Path, default=None)
    r.add_argument("--max-mb", type=float, default=100.0)
    r.add_argument("--pages", default=None, help="1-based subset, e.g. 1-20,285")
    r.add_argument("--ocr", action="store_true", help="add a searchable text layer")
    r.add_argument("--ocr-langs", default=ocr_mod.DEFAULT_LANGS)
    r.add_argument("--ocr-dpi", type=float, default=None, help="resolution fed to tesseract (default: auto)")
    r.add_argument(
        "--ocr-psm",
        type=int,
        default=ocr_mod.DEFAULT_PSM,
        help="tesseract page segmentation mode (4 = single column, 3 = auto layout)",
    )
    r.add_argument(
        "--ocr-min-conf",
        type=float,
        default=25.0,
        help="drop recognised words below this confidence",
    )
    r.add_argument(
        "--tessdata-dir",
        type=Path,
        default=None,
        help="language data directory (default: ./tessdata if present, else system)",
    )
    r.add_argument("--no-cache", action="store_true", help="bypass OCR page cache")
    r.add_argument("--no-plan", action="store_true", help="use the given settings verbatim")
    add_tuning(r)
    r.set_defaults(func=cmd_run)

    p = sub.add_parser("probe", help="describe the source and recommend a mode")
    p.add_argument("input", type=Path)
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--per-page", action="store_true")
    p.set_defaults(func=cmd_probe)

    pl = sub.add_parser("plan", help="solve for parameters from a sample, then stop")
    common(pl)
    pl.add_argument("--out", type=Path, default=None)
    pl.add_argument("--max-mb", type=float, default=100.0)
    pl.add_argument("--pages", default=None)
    pl.add_argument("--ocr", action="store_true", help="reserve headroom for OCR text layer")
    add_tuning(pl)
    pl.set_defaults(func=cmd_plan)

    ct = sub.add_parser(
        "continuous",
        help="native scan images → 8-bit grayscale JPEG 2000 without binarization",
    )
    ct.add_argument("input", type=Path)
    ct.add_argument("--workdir", type=Path, default=None, help="default: <input dir>/out")
    ct.add_argument("--out", type=Path, default=None)
    ct.add_argument("--max-mb", type=float, default=100.0)
    ct.add_argument("--pages", default=None, help="1-based subset, e.g. 1-20,285")
    ct.add_argument(
        "--ratio",
        type=float,
        default=None,
        help="fixed JPEG 2000 compression ratio; larger is smaller and more lossy",
    )
    ct.add_argument(
        "--psnr",
        type=float,
        default=None,
        help="JPEG 2000 target PSNR in dB (e.g. 38); avoids burning bitrate on blank pages",
    )
    ct.add_argument("--keep-first-colour", type=int, default=0)
    ct.add_argument("--keep-last-colour", type=int, default=0)
    ct.add_argument(
        "--auto-colour",
        action="store_true",
        help="automatically keep colourful pages inside the book byte-for-byte",
    )
    ct.add_argument("--workers", type=int, default=_default_workers())
    ct.set_defaults(func=cmd_continuous)

    v = sub.add_parser("verify", help="open it, decode every page")
    v.add_argument("input", type=Path)
    v.add_argument("--shallow", action="store_true", help="structure only, skip page decode")
    v.set_defaults(func=cmd_verify)

    t = sub.add_parser("toc", help="inspect, export TOC pages, or apply bookmarks + PageLabels")
    tsub = t.add_subparsers(dest="toc_cmd", required=True)

    t_show = tsub.add_parser("show", help="print existing bookmarks and PageLabels")
    t_show.add_argument("input", type=Path)
    t_show.set_defaults(func=cmd_toc_show)

    t_pages = tsub.add_parser("pages", help="render leading/TOC pages as JPEGs for visual reading")
    t_pages.add_argument("input", type=Path)
    t_pages.add_argument("--pages", default=None, help="1-based pages, default: first 16 pages")
    t_pages.add_argument("--dpi", type=float, default=130.0)
    t_pages.add_argument("--out-dir", type=Path, default=None)
    t_pages.set_defaults(func=cmd_toc_pages)

    t_apply = tsub.add_parser("apply", help="write nested bookmarks (and optional PageLabels) losslessly")
    t_apply.add_argument("input", type=Path)
    t_apply.add_argument("--from", dest="source", required=True, help="indented TOC file, or '-' for stdin")
    t_apply.add_argument("--offset", type=int, default=0, help="PDF page minus printed body page")
    t_apply.add_argument("--page-labels", action="store_true", help="write Roman front-matter + Arabic body PageLabels")
    t_apply.add_argument("--body-start", type=int, default=None, help="1-based PDF page where printed page 1 begins")
    t_apply.add_argument("--out", type=Path, default=None, help="output PDF path (default: update input in place)")
    t_apply.add_argument("--strict", action="store_true", help="abort on monotonicity or offset warnings")
    t_apply.set_defaults(func=cmd_toc_apply)

    o = sub.add_parser("ocr", help="add a text layer only, leaving every image untouched")
    common(o)
    o.add_argument("--out", type=Path, default=None)
    o.add_argument(
        "--ocr-source",
        type=Path,
        default=None,
        help="recognise from this same-length original PDF while leaving input images untouched",
    )
    o.add_argument("--ocr-langs", default=ocr_mod.DEFAULT_LANGS)
    o.add_argument("--ocr-dpi", type=float, default=None, help="resolution fed to tesseract (default: auto)")
    o.add_argument("--ocr-psm", type=int, default=ocr_mod.DEFAULT_PSM)
    o.add_argument("--ocr-min-conf", type=float, default=25.0)
    o.add_argument("--tessdata-dir", type=Path, default=None)
    o.add_argument("--force", action="store_true", help="overlay OCR text even if target already has text")
    o.add_argument("--no-cache", action="store_true", help="bypass OCR page cache")
    o.set_defaults(func=cmd_ocr)

    os_ = sub.add_parser("ocr-setup", help="fetch tessdata_best models into ./tessdata")
    os_.add_argument("--langs", default=ocr_mod.DEFAULT_LANGS)
    os_.add_argument("--tessdata-dir", type=Path, default=None)
    os_.set_defaults(func=cmd_ocr_setup)

    oc = sub.add_parser("ocr-check", help="report which OCR models will be used")
    oc.add_argument("--langs", default=ocr_mod.DEFAULT_LANGS)
    oc.add_argument("--tessdata-dir", type=Path, default=None)
    oc.set_defaults(func=cmd_ocr_check)

    c = sub.add_parser("clean", help="delete cached page artifacts")
    c.add_argument("input", type=Path, nargs="?", default=None)
    c.add_argument("--workdir", type=Path, default=None)
    c.add_argument("--all", action="store_true", help="delete all cached artifacts under workdir/.pdfopt")
    c.set_defaults(func=cmd_clean)

    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\ninterrupted; cached pages are kept, re-run to resume", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
