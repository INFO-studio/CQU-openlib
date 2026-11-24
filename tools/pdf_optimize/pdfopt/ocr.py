"""OCR stage: run tesseract per page and lay down our own text layer.

Model choice matters more than anything else here. Homebrew's
``tesseract-lang`` ships the 2019 fast models; on Chinese book scans they turn
bold headings into Latin gibberish. The ``tessdata_best`` LSTM models read the
same images correctly. ``pdfopt ocr-setup`` fetches them into a local mirror
directory so the system install is left alone.
"""

from __future__ import annotations

import atexit
import concurrent.futures as cf
import os
import shutil
import tempfile
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import pikepdf
import pymupdf as fitz

from .cache import OcrCache
from .render import ocr_render_dpi
from .textlayer import Line, cjk_font, ocr_image, write_lines
from .util import atomic_write, have, human

DEFAULT_LANGS = "chi_sim+eng"
BEST_URL = "https://github.com/tesseract-ocr/tessdata_best/raw/main/{lang}.traineddata"
#: tessdata_fast models are ~1-3MB, tessdata_best ~12-30MB.
BEST_MIN_BYTES = 6 * 1024 * 1024
MIN_PDF_VERSION = "1.6"


#: 4 = "single column of text of variable sizes". Tesseract's automatic layout
#: analysis (3) splits a page around margin portraits and figures, drops the
#: fragments it can't place, and emits the rest out of order. Across a sample
#: of this kind of scan, 4 recovered 6% more Chinese and cut the number of
#: characters misread as Latin roughly in half.
DEFAULT_PSM = 4


@dataclass
class OcrSettings:
    langs: str = DEFAULT_LANGS
    tessdata_dir: Path | None = None
    dpi: float | None = None
    psm: int | None = DEFAULT_PSM
    min_conf: float = 25.0


# --------------------------------------------------------------------------
# environment
# --------------------------------------------------------------------------


def system_tessdata() -> Path | None:
    """Richest tessdata directory on the box."""
    candidates = []
    exe = shutil.which("tesseract")
    if exe:
        candidates.append(Path(exe).resolve().parent.parent / "share" / "tessdata")
    candidates += [
        Path("/opt/homebrew/share/tessdata"),
        Path("/usr/local/share/tessdata"),
        Path("/usr/share/tessdata"),
        Path("/opt/homebrew/share/tessdata-best"),
    ]
    best: tuple[int, Path] | None = None
    for candidate in candidates:
        if not candidate.is_dir():
            continue
        n = len(list(candidate.glob("*.traineddata")))
        if n and (best is None or n > best[0]):
            best = (n, candidate)
    return best[1] if best else None


def local_tessdata() -> Path:
    """The tool's own mirror, next to the package."""
    return Path(__file__).resolve().parent.parent / "tessdata"


def resolve_tessdata(explicit: Path | None, langs: str | None = None) -> Path | None:
    if explicit:
        return explicit
    local = local_tessdata()
    if not local.is_dir():
        return None
    if langs:
        if all((local / f"{lang}.traineddata").exists() for lang in langs.split("+")):
            return local
    if any(local.glob("*.traineddata")):
        return local
    return None


def available(langs: str, tessdata_dir: Path | None) -> tuple[bool, str]:
    if not have("tesseract"):
        return False, "tesseract not on PATH (brew install tesseract tesseract-lang)"
    search = tessdata_dir or system_tessdata()
    if search is None:
        return False, "no tessdata directory found"
    missing = [
        lang for lang in langs.split("+") if not (search / f"{lang}.traineddata").exists()
    ]
    if missing:
        return False, f"missing language data in {search}: {', '.join(missing)}"
    return True, ""


def model_report(langs: str, tessdata_dir: Path | None) -> list[tuple[str, Path | None, int, bool]]:
    """(lang, path, size, looks_like_best) for each requested language."""
    search = tessdata_dir or system_tessdata()
    out = []
    for lang in langs.split("+"):
        path = (search / f"{lang}.traineddata") if search else None
        if path and path.exists():
            size = path.stat().st_size
            out.append((lang, path, size, size >= BEST_MIN_BYTES))
        else:
            out.append((lang, None, 0, False))
    return out


#: tessdata_best's chi_sim declares these as sub-languages and refuses to load
#: without them, even though we never OCR vertical text.
SUBLANGS = {"chi_sim": ["chi_sim_vert"], "chi_tra": ["chi_tra_vert"], "jpn": ["jpn_vert"]}


def _fetch(lang: str, dest: Path, log) -> bool:
    url = BEST_URL.format(lang=lang)
    target = dest / f"{lang}.traineddata"
    if target.is_symlink():
        target.unlink()

    def _download(tmp: Path) -> None:
        req = urllib.request.Request(url, headers={"User-Agent": "pdfopt"})
        with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
            data = resp.read()
        if not data or len(data) < 1024 or data.lstrip()[:1] == b"<":
            raise RuntimeError("downloaded payload is empty or HTML")
        tmp.write_bytes(data)

    try:
        atomic_write(target, _download)
    except Exception as exc:
        log(f"  {lang}: download failed ({exc})")
        return False
    log(f"  {lang}: {human(target.stat().st_size)}")
    return True


def smoke_test(langs: str, tessdata_dir: Path) -> tuple[bool, str]:
    """Actually OCR something. tesseract exits 0 on a failed language load, so
    a green ``--list-langs`` proves nothing."""
    scratch = Path(tempfile.mkdtemp(prefix="pdfopt-smoke-"))
    try:
        doc = fitz.open()
        page = doc.new_page(width=300, height=120)
        page.insert_text((20, 60), "Test 1234", fontsize=28)
        page.get_pixmap(matrix=fitz.Matrix(300 / 72, 300 / 72)).save(scratch / "t.png")
        doc.close()
        try:
            lines = ocr_image(
                scratch / "t.png",
                langs=langs,
                tessdata_dir=tessdata_dir,
                psm=None,
                min_conf=0.0,
                scratch=scratch,
            )
        except Exception as exc:
            return False, str(exc)
        return (bool(lines), "recognised nothing" if not lines else "")
    finally:
        shutil.rmtree(scratch, ignore_errors=True)


def setup_best(langs: str, *, dest: Path | None = None, log=print) -> tuple[Path, bool]:
    """Mirror the system tessdata, then override with tessdata_best models."""
    dest = dest or local_tessdata()
    system = system_tessdata()
    if system is None:
        raise SystemExit("no system tessdata directory to mirror; install tesseract first")
    log(f"  mirroring {system}")

    dest.mkdir(parents=True, exist_ok=True)
    for entry in system.iterdir():
        link = dest / entry.name
        if link.is_symlink() or link.exists():
            continue
        link.symlink_to(entry)

    wanted = list(langs.split("+"))
    for lang in list(wanted):
        wanted += [s for s in SUBLANGS.get(lang, []) if s not in wanted]

    for lang in wanted:
        target = dest / f"{lang}.traineddata"
        if target.exists() and not target.is_symlink() and target.stat().st_size >= BEST_MIN_BYTES:
            log(f"  {lang}: already a best model ({human(target.stat().st_size)})")
            continue
        if target.is_symlink() and target.exists() and lang not in langs.split("+"):
            log(f"  {lang}: using the system copy (sub-language, never rendered)")
            continue
        log(f"  {lang}: downloading tessdata_best …")
        if not _fetch(lang, dest, log) and not target.exists():
            system_file = system / f"{lang}.traineddata"
            if system_file.exists():
                target.symlink_to(system_file)
                log(f"  {lang}: fell back to the system model")

    ok, why = smoke_test(langs, dest)
    log(f"  smoke test: {'ok' if ok else 'FAILED — ' + why}")
    return dest, ok


# --------------------------------------------------------------------------
# per-page work
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


def _init(pdf: str, settings: OcrSettings) -> None:
    _W["doc"] = fitz.open(pdf)
    _W["settings"] = settings
    _W["scratch"] = Path(tempfile.mkdtemp(prefix="pdfopt-ocr-"))
    atexit.register(_cleanup)


def _page(task: tuple[int, int]) -> tuple[int, int, list[Line], tuple[int, int]]:
    slot, source_index = task
    doc: fitz.Document = _W["doc"]
    st: OcrSettings = _W["settings"]
    scratch: Path = _W["scratch"]
    eff_dpi = ocr_render_dpi(doc, source_index, st.dpi)
    # Grayscale, because tesseract does its own adaptive binarisation and is
    # far better at it than a threshold picked to make JBIG2 small.
    pix = doc[source_index].get_pixmap(
        matrix=fitz.Matrix(eff_dpi / 72.0, eff_dpi / 72.0),
        colorspace=fitz.csGRAY,
        alpha=False,
    )
    image = scratch / "page.png"
    pix.save(image)
    try:
        lines = ocr_image(
            image,
            langs=st.langs,
            tessdata_dir=st.tessdata_dir,
            psm=st.psm,
            min_conf=st.min_conf,
            scratch=scratch,
        )
    finally:
        image.unlink(missing_ok=True)
    return slot, source_index, lines, (pix.width, pix.height)


def add_text_layer(
    ocr_src: Path,
    page_indices: list[int],
    target: Path,
    dst: Path,
    settings: OcrSettings,
    *,
    workers: int | None = None,
    progress=None,
    cache: OcrCache | None = None,
    force: bool = False,
) -> int:
    """Read ``ocr_src`` for text, write the layer onto ``target`` as ``dst``.

    Text is recognised from the *original* scan rather than from our own
    output. A page binarised for JBIG2 looks fine to a reader but reads as
    noise to tesseract, and coupling the text layer to the compression
    settings would mean every size tweak silently changed what is searchable.
    """
    workers = workers or max(1, (os.cpu_count() or 4) - 1)
    doc = fitz.open(target)
    if doc.page_count != len(page_indices):
        doc.close()
        raise ValueError(
            f"page count mismatch: {target.name} has {doc.page_count}, "
            f"asked to OCR {len(page_indices)}"
        )
    if not force:
        existing = sum(1 for i in range(doc.page_count) if doc[i].get_text("text").strip())
        if existing:
            count = doc.page_count
            doc.close()
            raise ValueError(
                f"{target.name} already has text on {existing}/{count} page(s); "
                "pass --force to overlay anyway"
            )

    font = cjk_font()
    total = len(page_indices)
    done = 0
    written = 0
    t0 = time.time()
    todo: list[tuple[int, int]] = []
    try:
        for slot, source_index in enumerate(page_indices):
            if cache is not None and cache.has(source_index):
                lines, img_size = cache.load(source_index)
                written += write_lines(
                    doc[slot], lines, settings.dpi or 300.0, font, img_size=img_size
                )
                done += 1
                if progress and (done % 25 == 0 or done == total):
                    rate = done / max(time.time() - t0, 0.01)
                    progress(done, total, rate)
            else:
                todo.append((slot, source_index))

        if todo:
            max_w = min(workers, len(todo))
            with cf.ProcessPoolExecutor(
                max_workers=max_w, initializer=_init, initargs=(str(ocr_src), settings)
            ) as ex:
                for slot, source_index, lines, img_size in ex.map(_page, todo, chunksize=1):
                    if cache is not None:
                        cache.save(source_index, lines, img_size)
                    written += write_lines(
                        doc[slot], lines, settings.dpi or 300.0, font, img_size=img_size
                    )
                    done += 1
                    if progress and (done % 25 == 0 or done == total):
                        rate = done / max(time.time() - t0, 0.01)
                        progress(done, total, rate)

        doc.subset_fonts()
        fd, tmp_name = tempfile.mkstemp(prefix=dst.stem + ".", suffix=".fitz.pdf", dir=dst.parent)
        os.close(fd)
        tmp_fitz = Path(tmp_name)
        try:
            doc.save(tmp_fitz, garbage=4, deflate=True, use_objstms=1)
            doc.close()
            doc = None

            def _linearize(out_tmp: Path) -> None:
                with pikepdf.open(tmp_fitz) as pk:
                    pk.save(
                        out_tmp,
                        linearize=True,
                        min_version=MIN_PDF_VERSION,
                        object_stream_mode=pikepdf.ObjectStreamMode.generate,
                    )

            atomic_write(dst, _linearize)
        finally:
            tmp_fitz.unlink(missing_ok=True)
    finally:
        if doc is not None:
            doc.close()
    return written
