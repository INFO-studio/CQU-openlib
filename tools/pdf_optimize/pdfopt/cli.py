"""Single entry point.

    pdfopt run    INPUT.pdf            # whole chain
    pdfopt probe  INPUT.pdf            # what is this file, which mode suits it
    pdfopt plan   INPUT.pdf            # sample and solve, without a full pass
    pdfopt verify OUTPUT.pdf           # does it open, does every page decode
    pdfopt ocr-setup                   # fetch the good tesseract models
    pdfopt ocr-check                   # which models would be used
    pdfopt clean  INPUT.pdf            # drop cached page artifacts
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

from . import budget as budget_mod
from . import ocr as ocr_mod
from . import verify as verify_mod
from .config import Detect, Mode, Params
from .pipeline import Job, run as run_pipeline, stage_probe
from .probe import probe as probe_source
from .util import human


def _default_workers() -> int:
    return max(1, (os.cpu_count() or 4) - 1)


def parse_pages(spec: str | None, count: int) -> list[int]:
    """1-based, inclusive: "1-20,285" → indices."""
    if not spec:
        return []
    out: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.extend(range(int(a) - 1, min(int(b), count)))
        else:
            out.append(int(part) - 1)
    return sorted({i for i in out if 0 <= i < count})


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
    g.add_argument(
        "--bw-threshold",
        type=int,
        default=None,
        help="jbig2enc 1bpp threshold (default 200); raise for faint scans to "
        "thicken strokes — this is threshold tuning, not dilation, so it "
        "won't smear glyphs",
    )
    g.add_argument(
        "--no-patch-color",
        action="store_true",
        help="force photo patches to grayscale",
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


def build_params(args) -> Params:
    detect = Detect()
    over = {
        k: v
        for k, v in (
            ("seed_white", args.seed_white),
            ("grow_white", args.grow_white),
            ("min_area_in2", args.min_photo_in2),
            ("white_level", args.white_level),
            ("seed_flat_std", args.tint_std),
        )
        if v is not None
    }
    if over:
        detect = Detect(**{**detect.__dict__, **over})

    params = Params(mode=args.mode, dpi=args.dpi, detect=detect)
    for field, value in (
        ("photo_dpi", args.photo_dpi),
        ("photo_quality", args.photo_quality),
        ("page_dpi", args.page_dpi),
        ("page_quality", args.page_quality),
        ("bw_threshold", args.bw_threshold),
    ):
        if value is not None:
            params = params.replace(**{field: value})
    if args.no_patch_color:
        params = params.replace(keep_patch_color=False)
    return params


def build_job(args, params: Params) -> Job:
    src = args.input.expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"not a file: {src}")
    workdir = (args.workdir or src.parent / "out").expanduser().resolve()
    workdir.mkdir(parents=True, exist_ok=True)

    from .render import open_doc

    doc = open_doc(src)
    count = doc.page_count
    doc.close()
    pages = parse_pages(getattr(args, "pages", None), count)

    suffix = ".preview" if pages else ""
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
        ocr_dpi=getattr(args, "ocr_dpi", 300.0),
        ocr_psm=getattr(args, "ocr_psm", ocr_mod.DEFAULT_PSM),
        ocr_min_conf=getattr(args, "ocr_min_conf", 25.0),
        tessdata_dir=getattr(args, "tessdata_dir", None),
    )


# --------------------------------------------------------------------------
# commands
# --------------------------------------------------------------------------


def cmd_run(args) -> int:
    job = build_job(args, build_params(args))
    result = run_pipeline(job, plan=not args.no_plan)
    if not result.report.ok:
        return 1
    return 0 if result.within_budget else 2


def cmd_probe(args) -> int:
    src = args.input.expanduser().resolve()
    info = probe_source(src, samples=args.samples)
    mode, why = info.recommend()
    print(f"file:        {src}")
    print(f"size:        {human(info.size)}  ({info.page_count} pages)")
    print(f"native dpi:  ~{info.native_dpi:g}")
    print(f"text layer:  {'yes' if info.has_text_layer else 'no (image-only scan)'}")
    print(f"colour:      {info.colour_pages * 100:.0f}% of sampled pages")
    print(
        f"photos:      {info.photo_pages * 100:.0f}% of pages carry continuous-tone "
        f"regions, {info.mean_photo_coverage * 100:.0f}% of page area on average"
    )
    print(f"recommended: --mode {mode.value}  ({why})")
    if args.per_page:
        print("\n  page  colourfulness  photo coverage")
        for p in info.sampled:
            print(f"  {p.index + 1:5d}  {p.colourfulness:13.1f}  {p.photo_coverage * 100:13.0f}%")
    return 0


def cmd_plan(args) -> int:
    params = build_params(args)
    src = args.input.expanduser().resolve()
    info = probe_source(src, detect=params.detect)
    job = build_job(args, params)
    job.pages = job.pages or list(range(info.page_count))
    from .pipeline import page_budget, resolve_params, stage_plan

    job.params = resolve_params(job, info)
    chosen = stage_plan(job, info, page_budget(job, info.page_count)).params
    print(f"\nrun this:\n  pdfopt run {src.name} --no-plan --mode {chosen.mode.value} "
          f"--dpi {chosen.dpi:g}"
          + (
              f" --photo-dpi {chosen.photo_dpi:g} --photo-quality {chosen.photo_quality}"
              if chosen.mode is Mode.MRC
              else ""
          )
          + (
              f" --page-dpi {(chosen.page_dpi or chosen.dpi):g} --page-quality {chosen.page_quality}"
              if chosen.mode in (Mode.GRAY, Mode.COLOR)
              else ""
          ))
    return 0


def cmd_verify(args) -> int:
    report = verify_mod.verify(args.input.expanduser().resolve(), deep=not args.shallow)
    print(f"{report.path.name}: {report.summary()}")
    if report.failed_pages:
        print(f"  failed pages: {report.failed_pages}")
    if report.blank_pages:
        print(f"  blank pages:  {report.blank_pages}")
    return 0 if report.ok else 1


def cmd_ocr_setup(args) -> int:
    print("mirroring system tessdata and fetching tessdata_best models")
    dest = ocr_mod.setup_best(args.langs, dest=args.tessdata_dir)
    print(f"tessdata: {dest}")
    return cmd_ocr_check(args)


def cmd_ocr_check(args) -> int:
    tessdata = ocr_mod.resolve_tessdata(args.tessdata_dir)
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


def cmd_clean(args) -> int:
    src = args.input.expanduser().resolve()
    root = (args.workdir or src.parent / "out").expanduser().resolve() / ".pdfopt"
    if not root.exists():
        print("nothing cached")
        return 0
    total = sum(f.stat().st_size for f in root.rglob("*") if f.is_file())
    shutil.rmtree(root)
    print(f"removed {root} ({human(total)})")
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
        p.add_argument("--batch", type=int, default=64, help="pages per encode batch")

    r = sub.add_parser("run", help="probe → plan → encode → assemble → ocr → verify")
    common(r)
    r.add_argument("--out", type=Path, default=None)
    r.add_argument("--max-mb", type=float, default=50.0)
    r.add_argument("--pages", default=None, help="1-based subset, e.g. 1-20,285")
    r.add_argument("--ocr", action="store_true", help="add a searchable text layer")
    r.add_argument("--ocr-langs", default=ocr_mod.DEFAULT_LANGS)
    r.add_argument("--ocr-dpi", type=float, default=300.0, help="resolution fed to tesseract")
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
    pl.add_argument("--max-mb", type=float, default=50.0)
    pl.add_argument("--pages", default=None)
    add_tuning(pl)
    pl.set_defaults(func=cmd_plan)

    v = sub.add_parser("verify", help="open it, decode every page")
    v.add_argument("input", type=Path)
    v.add_argument("--shallow", action="store_true", help="structure only, skip page decode")
    v.set_defaults(func=cmd_verify)

    os_ = sub.add_parser("ocr-setup", help="fetch tessdata_best models into ./tessdata")
    os_.add_argument("--langs", default=ocr_mod.DEFAULT_LANGS)
    os_.add_argument("--tessdata-dir", type=Path, default=None)
    os_.set_defaults(func=cmd_ocr_setup)

    oc = sub.add_parser("ocr-check", help="report which OCR models will be used")
    oc.add_argument("--langs", default=ocr_mod.DEFAULT_LANGS)
    oc.add_argument("--tessdata-dir", type=Path, default=None)
    oc.set_defaults(func=cmd_ocr_check)

    c = sub.add_parser("clean", help="delete cached page artifacts")
    c.add_argument("input", type=Path)
    c.add_argument("--workdir", type=Path, default=None)
    c.set_defaults(func=cmd_clean)

    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\ninterrupted; cached pages are kept, re-run to resume", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
