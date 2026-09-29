"""Re-encode one-image-per-page scans without thresholding or rasterising pages.

This path is deliberately narrow. It extracts each source image at its native
pixel dimensions, keeps selected cover streams byte-for-byte, converts the
remaining pages to 8-bit grayscale JPEG 2000, and rebuilds the PDF with the
same page boxes. Refuse complex pages instead of silently dropping content.
"""

from __future__ import annotations

import io
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from PIL import Image, features

from .render import open_doc
from .util import atomic_write

try:
    import pymupdf as fitz
except ImportError:  # pymupdf < 1.24 only ships the old name
    import fitz


@dataclass(frozen=True)
class ContinuousResult:
    path: Path
    page_count: int
    image_bytes: int
    output_bytes: int


_METADATA_KEYS = {
    "title",
    "author",
    "subject",
    "keywords",
    "creator",
    "producer",
    "creationDate",
    "modDate",
    "trapped",
}


def _covers_page(rect: fitz.Rect, page_rect: fitz.Rect, tolerance: float = 1.0) -> bool:
    return all(
        abs(a - b) <= tolerance
        for a, b in zip(
            (rect.x0, rect.y0, rect.x1, rect.y1),
            (page_rect.x0, page_rect.y0, page_rect.x1, page_rect.y1),
        )
    )


def _single_page_image(doc: fitz.Document, index: int) -> bytes:
    page = doc[index]
    label = f"page {index + 1}"
    if page.rotation:
        raise ValueError(f"{label}: rotated pages are not supported")
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
    rects = page.get_image_rects(xref)
    if len(rects) != 1 or not _covers_page(rects[0], page.rect):
        raise ValueError(f"{label}: the only image does not cover the page exactly")
    return doc.extract_image(xref)["image"]


def _jpeg2000_gray(data: bytes, ratio: float) -> bytes:
    with Image.open(io.BytesIO(data)) as source:
        gray = source.convert("L")
        encoded = io.BytesIO()
        gray.save(
            encoded,
            format="JPEG2000",
            quality_mode="rates",
            quality_layers=[ratio],
            irreversible=True,
        )
    return encoded.getvalue()


def _preserve_colour(index: int, total: int, first: int, last: int) -> bool:
    return index < first or index >= total - last


def _copy_document_metadata(src: fitz.Document, dst: fitz.Document) -> None:
    metadata = {key: value for key, value in src.metadata.items() if key in _METADATA_KEYS}
    dst.set_metadata(metadata)
    toc = src.get_toc(simple=False)
    if toc:
        dst.set_toc(toc)
    labels = src.get_page_labels()
    if labels:
        dst.set_page_labels(labels)


def reencode(
    src: Path,
    dst: Path,
    *,
    ratio: float = 24.0,
    keep_first_colour: int = 0,
    keep_last_colour: int = 0,
    pages: list[int] | None = None,
    progress: Callable[[int, int, float, int], None] | None = None,
) -> ContinuousResult:
    """Rebuild a simple scan with native-size grayscale JPEG 2000 images.

    Ratio is the JPEG 2000 target compression ratio: larger values are
    smaller and more lossy. Colour pages are copied as their original encoded
    streams. For a page subset, cover selection still refers to source pages.
    """
    if not features.check("jpg_2000"):
        raise RuntimeError("this Pillow build has no JPEG 2000 support")
    if ratio < 1:
        raise ValueError("JPEG 2000 ratio must be at least 1")
    if keep_first_colour < 0 or keep_last_colour < 0:
        raise ValueError("colour page counts cannot be negative")
    if src.resolve() == dst.resolve():
        raise ValueError("output would overwrite the source")

    source = open_doc(src)
    output = fitz.open()
    indices = pages if pages is not None else list(range(source.page_count))
    if not indices:
        source.close()
        output.close()
        raise ValueError("no pages selected")

    total = source.page_count
    image_bytes = 0
    started = time.time()
    try:
        for done, index in enumerate(indices, start=1):
            page = source[index]
            original = _single_page_image(source, index)
            stream = (
                original
                if _preserve_colour(index, total, keep_first_colour, keep_last_colour)
                else _jpeg2000_gray(original, ratio)
            )
            image_bytes += len(stream)
            new_page = output.new_page(width=page.rect.width, height=page.rect.height)
            new_page.insert_image(new_page.rect, stream=stream)
            if progress and (done % 25 == 0 or done == len(indices)):
                progress(done, len(indices), done / max(time.time() - started, 0.01), image_bytes)

        if len(indices) == total and indices == list(range(total)):
            _copy_document_metadata(source, output)
        atomic_write(
            dst,
            lambda tmp: output.save(
                tmp,
                garbage=4,
                deflate=True,
                use_objstms=1,
                clean=True,
            ),
        )
    finally:
        output.close()
        source.close()

    return ContinuousResult(dst, len(indices), image_bytes, dst.stat().st_size)
