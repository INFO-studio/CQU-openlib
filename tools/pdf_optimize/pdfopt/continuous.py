"""Re-encode one-image-per-page scans without thresholding or rasterising pages.

This path is deliberately narrow. Each selected page must carry a single
page-filling image without text, annotations, links, vector drawings, or
transparency masks. Colour pages can be kept byte-for-byte via ``pikepdf``
in-place XObject preservation, while remaining pages are decoded cleanly
(honouring ``/Decode``, ICC profiles, and CMYK), converted to 8-bit grayscale
JPEG 2000, and swapped back into the original page structure so ``/Rotate``
and ``cm`` transforms stay exact.
"""

from __future__ import annotations

import atexit
import concurrent.futures as cf
import io
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
import pikepdf
from PIL import Image, features
from pikepdf import Name

from .probe import sample_indices
from .render import is_colourful, open_doc
from .util import atomic_write, copy_pdf_metadata

try:
    import pymupdf as fitz
except ImportError:  # pymupdf < 1.24 only ships the old name
    import fitz

MIN_PDF_VERSION = "1.6"


@dataclass(frozen=True)
class ContinuousResult:
    path: Path
    page_count: int
    image_bytes: int
    output_bytes: int
    kept_colour_pages: int = 0


def _covers_page(rect: fitz.Rect, page_rect: fitz.Rect, tolerance: float = 1.0) -> bool:
    return all(
        abs(a - b) <= tolerance
        for a, b in zip(
            (rect.x0, rect.y0, rect.x1, rect.y1),
            (page_rect.x0, page_rect.y0, page_rect.x1, page_rect.y1),
        )
    )


def _find_single_image_xobject(pk_page, label: str) -> str:
    res = pk_page.get("/Resources")
    if res is None and hasattr(pk_page, "Resources"):
        res = pk_page.Resources
    xobjs = res.get("/XObject") if res is not None else None
    if xobjs is None:
        raise ValueError(f"{label}: page has no XObject resources")
    image_keys: list[str] = []
    for k, obj in xobjs.items():
        if not hasattr(obj, "get"):
            continue
        subtype = obj.get("/Subtype")
        if subtype == Name.Form:
            raise ValueError(f"{label}: nested Form XObject is not supported")
        if subtype == Name.Image:
            image_keys.append(str(k))
    if len(image_keys) != 1:
        raise ValueError(
            f"{label}: expected one image XObject in Resources, found {len(image_keys)}"
        )
    return image_keys[0]


def _validate_page(doc: fitz.Document, index: int, pk_page) -> tuple[int, str]:
    page = doc[index]
    label = f"page {index + 1}"
    if page.get_text("text").strip():
        raise ValueError(f"{label}: has a text layer; preserve or remove it explicitly first")
    if list(page.annots() or []):
        raise ValueError(f"{label}: has annotations that rebuilding would drop")
    if page.get_links():
        raise ValueError(f"{label}: has links that rebuilding would drop")
    if page.get_drawings():
        raise ValueError(f"{label}: has vector drawings that rebuilding would drop")

    images = page.get_images(full=True)
    if len(images) != 1:
        raise ValueError(f"{label}: expected one image, found {len(images)}")
    xref, smask = images[0][:2]
    if smask:
        raise ValueError(f"{label}: image has a transparency mask")

    infos = page.get_image_info(xrefs=True)
    if len(infos) != 1 or infos[0].get("has-mask", False) or int(infos[0].get("xref") or 0) <= 0:
        raise ValueError(f"{label}: expected a single standalone image")
    disp_bbox = fitz.Rect(infos[0]["bbox"]) * page.rotation_matrix
    if not _covers_page(disp_bbox, page.rect):
        raise ValueError(f"{label}: the only image does not cover the page exactly")

    xobj_key = _find_single_image_xobject(pk_page, label)
    return int(xref), xobj_key


def _pixmap_is_colourful(pm: fitz.Pixmap) -> bool:
    if pm.colorspace == fitz.csGRAY and not pm.alpha:
        return False
    rgb_pm = pm if (pm.colorspace == fitz.csRGB and not pm.alpha) else fitz.Pixmap(fitz.csRGB, pm)
    arr = np.frombuffer(rgb_pm.samples, np.uint8).reshape(rgb_pm.height, rgb_pm.width, 3)
    return is_colourful(arr)


def _encode_jpx_gray(
    samples: bytes,
    width: int,
    height: int,
    *,
    ratio: float | None,
    psnr: float | None,
) -> bytes:
    img = Image.frombytes("L", (width, height), samples)
    encoded = io.BytesIO()
    if psnr is not None:
        img.save(
            encoded,
            format="JPEG2000",
            quality_mode="dB",
            quality_layers=[psnr],
            irreversible=True,
        )
    else:
        assert ratio is not None
        img.save(
            encoded,
            format="JPEG2000",
            quality_mode="rates",
            quality_layers=[ratio],
            irreversible=True,
        )
    return encoded.getvalue()


def _encode_one_from_doc(
    doc: fitz.Document,
    index: int,
    xref: int,
    *,
    force_colour: bool,
    auto_colour: bool,
    ratio: float | None,
    psnr: float | None,
) -> tuple[bytes | None, int, int, int, bool]:
    """Return (jpx_bytes_or_None, width, height, byte_count, kept_colour)."""
    if force_colour:
        return None, 0, 0, len(doc.xref_stream_raw(xref)), True

    pm = fitz.Pixmap(doc, xref)
    if auto_colour and _pixmap_is_colourful(pm):
        return None, 0, 0, len(doc.xref_stream_raw(xref)), True

    if pm.colorspace != fitz.csGRAY or pm.alpha:
        if pm.alpha:
            pm = fitz.Pixmap(fitz.csRGB, pm)
        pm_gray = fitz.Pixmap(fitz.csGRAY, pm)
    else:
        pm_gray = pm

    jpx = _encode_jpx_gray(pm_gray.samples, pm_gray.width, pm_gray.height, ratio=ratio, psnr=psnr)
    return jpx, pm_gray.width, pm_gray.height, len(jpx), False


# --------------------------------------------------------------------------
# multiprocessing worker plumbing
# --------------------------------------------------------------------------

_W: dict = {}


def _worker_cleanup() -> None:
    doc = _W.pop("doc", None)
    if doc is not None:
        try:
            doc.close()
        except Exception:
            pass


def _worker_init(src_path: str) -> None:
    _W["doc"] = open_doc(src_path)
    atexit.register(_worker_cleanup)


def _worker_task(
    task: tuple[int, int, int, bool, bool, float | None, float | None],
) -> tuple[int, bytes | None, int, int, int, bool]:
    slot, index, xref, force_colour, auto_colour, ratio, psnr = task
    jpx, w, h, nbytes, kept = _encode_one_from_doc(
        _W["doc"],
        index,
        xref,
        force_colour=force_colour,
        auto_colour=auto_colour,
        ratio=ratio,
        psnr=psnr,
    )
    return slot, jpx, w, h, nbytes, kept


def _preserve_colour(index: int, total: int, first: int, last: int) -> bool:
    return index < first or index >= total - last


def _replace_page_xobject(
    pdf: pikepdf.Pdf,
    pk_page,
    xobj_key: str,
    jpx_bytes: bytes,
    width: int,
    height: int,
) -> None:
    """Replace the image XObject on ``pk_page`` without mutating shared dicts."""
    st = pikepdf.Stream(pdf, jpx_bytes)
    st.Type = Name.XObject
    st.Subtype = Name.Image
    st.Width = width
    st.Height = height
    st.ColorSpace = Name.DeviceGray
    st.BitsPerComponent = 8
    st.Filter = Name.JPXDecode

    res_src = pk_page.get("/Resources")
    if res_src is None and hasattr(pk_page, "Resources"):
        res_src = pk_page.Resources
    res = pikepdf.Dictionary(res_src)
    xobjs = pikepdf.Dictionary(res.XObject)
    xobjs[xobj_key] = pdf.make_indirect(st)
    res[Name.XObject] = xobjs
    pk_page[Name.Resources] = res


def solve_psnr(
    src: Path,
    budget_bytes: int,
    *,
    keep_first_colour: int = 0,
    keep_last_colour: int = 0,
    auto_colour: bool = False,
    pages: list[int] | None = None,
    samples: int = 12,
    lo: float = 32.0,
    hi: float = 44.0,
) -> float:
    """Binary-search the highest JPEG 2000 PSNR (dB) fitting ``budget_bytes``."""
    if not features.check("jpg_2000"):
        raise RuntimeError("this Pillow build has no JPEG 2000 support")

    source = open_doc(src)
    try:
        total = source.page_count
        indices = pages if pages is not None else list(range(total))
        if not indices:
            raise ValueError("no pages selected")
        picks = [indices[i] for i in sample_indices(len(indices), samples)]
        target = budget_bytes * (len(indices) / max(total, 1)) * 0.96

        with pikepdf.open(src) as pk_src:
            prepared: list[tuple[int, int, bool]] = []
            for idx in picks:
                xref, _ = _validate_page(source, idx, pk_src.pages[idx])
                force_col = _preserve_colour(idx, total, keep_first_colour, keep_last_colour)
                prepared.append((idx, xref, force_col))

        # Decode sampled pages once so binary search only re-runs the fast JP2 encode.
        sample_payloads: list[tuple[int, bytes | None, int, int]] = []
        for idx, xref, force_col in prepared:
            if force_col:
                sample_payloads.append((len(source.xref_stream_raw(xref)), None, 0, 0))
                continue
            pm = fitz.Pixmap(source, xref)
            if auto_colour and _pixmap_is_colourful(pm):
                sample_payloads.append((len(source.xref_stream_raw(xref)), None, 0, 0))
                continue
            if pm.colorspace != fitz.csGRAY or pm.alpha:
                if pm.alpha:
                    pm = fitz.Pixmap(fitz.csRGB, pm)
                pm_gray = fitz.Pixmap(fitz.csGRAY, pm)
            else:
                pm_gray = pm
            sample_payloads.append((0, bytes(pm_gray.samples), pm_gray.width, pm_gray.height))
    finally:
        source.close()

    def estimate_bytes(psnr: float) -> float:
        total_sample = 0
        for raw_len, gray_samples, w, h in sample_payloads:
            if gray_samples is None:
                total_sample += raw_len
            else:
                total_sample += len(_encode_jpx_gray(gray_samples, w, h, ratio=None, psnr=psnr))
        return total_sample / len(sample_payloads) * len(indices)

    if estimate_bytes(hi) <= target:
        return round(hi, 1)
    if estimate_bytes(lo) > target:
        return round(lo, 1)

    low, high = lo, hi
    for _ in range(5):
        mid = (low + high) / 2.0
        if estimate_bytes(mid) <= target:
            low = mid
        else:
            high = mid
    return round(low, 1)


def reencode(
    src: Path,
    dst: Path,
    *,
    ratio: float | None = 24.0,
    psnr: float | None = None,
    keep_first_colour: int = 0,
    keep_last_colour: int = 0,
    auto_colour: bool = False,
    pages: list[int] | None = None,
    workers: int = 1,
    progress: Callable[[int, int, float, int], None] | None = None,
) -> ContinuousResult:
    """Rebuild a simple scan in-place with native-size grayscale JPEG 2000.

    When ``psnr`` is provided, OpenJPEG uses constant-PSNR mode (``dB``) so blank
    or sparse pages shrink to <1 KB instead of burning fixed bitrate. Otherwise
    ``ratio`` controls target compression ratio. Colour pages are preserved
    byte-for-byte in the original XObject stream.
    """
    if not features.check("jpg_2000"):
        raise RuntimeError("this Pillow build has no JPEG 2000 support")
    if psnr is None:
        if ratio is None or ratio < 1:
            raise ValueError("JPEG 2000 ratio must be at least 1")
    elif psnr <= 0:
        raise ValueError("JPEG 2000 PSNR must be positive")
    if keep_first_colour < 0 or keep_last_colour < 0:
        raise ValueError("colour page counts cannot be negative")
    if src.resolve() == dst.resolve():
        raise ValueError("output would overwrite the source")

    source = open_doc(src)
    total = source.page_count
    indices = pages if pages is not None else list(range(total))
    if not indices:
        source.close()
        raise ValueError("no pages selected")

    full_doc = len(indices) == total and indices == list(range(total))
    src_pk = pikepdf.open(src)
    out_pk = src_pk if full_doc else pikepdf.Pdf.new()

    image_bytes = 0
    kept_colour = 0
    started = time.time()
    try:
        if not full_doc:
            for idx in indices:
                out_pk.pages.append(src_pk.pages[idx])
            copy_pdf_metadata(src, out_pk, page_indices=indices)

        tasks: list[tuple[int, int, int, bool, bool, float | None, float | None]] = []
        xobj_keys: list[str] = []
        for slot, idx in enumerate(indices):
            xref, xobj_key = _validate_page(source, idx, out_pk.pages[slot])
            xobj_keys.append(xobj_key)
            force_col = _preserve_colour(idx, total, keep_first_colour, keep_last_colour)
            tasks.append((slot, idx, xref, force_col, auto_colour, ratio, psnr))

        if workers > 1 and len(tasks) > 1:
            source.close()
            source = None
            max_w = min(workers, len(tasks), max(1, (os.cpu_count() or 2)))
            with cf.ProcessPoolExecutor(
                max_workers=max_w,
                initializer=_worker_init,
                initargs=(str(src),),
            ) as ex:
                for done, (slot, jpx, w, h, nbytes, kept) in enumerate(
                    ex.map(_worker_task, tasks, chunksize=2), start=1
                ):
                    image_bytes += nbytes
                    if kept:
                        kept_colour += 1
                    elif jpx is not None:
                        _replace_page_xobject(out_pk, out_pk.pages[slot], xobj_keys[slot], jpx, w, h)
                    if progress and (done % 25 == 0 or done == len(tasks)):
                        progress(done, len(tasks), done / max(time.time() - started, 0.01), image_bytes)
        else:
            for done, (slot, idx, xref, force_col, auto_col, r, p) in enumerate(tasks, start=1):
                jpx, w, h, nbytes, kept = _encode_one_from_doc(
                    source,
                    idx,
                    xref,
                    force_colour=force_col,
                    auto_colour=auto_col,
                    ratio=r,
                    psnr=p,
                )
                image_bytes += nbytes
                if kept:
                    kept_colour += 1
                elif jpx is not None:
                    _replace_page_xobject(out_pk, out_pk.pages[slot], xobj_keys[slot], jpx, w, h)
                if progress and (done % 25 == 0 or done == len(tasks)):
                    progress(done, len(tasks), done / max(time.time() - started, 0.01), image_bytes)

        atomic_write(
            dst,
            lambda tmp: out_pk.save(
                tmp,
                linearize=True,
                min_version=MIN_PDF_VERSION,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
            ),
        )
    finally:
        if source is not None:
            source.close()
        if out_pk is not src_pk:
            out_pk.close()
        src_pk.close()

    return ContinuousResult(dst, len(indices), image_bytes, dst.stat().st_size, kept_colour)
