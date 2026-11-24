"""Page rasterisation, image-grid metrics, and colour tests."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

try:
    import pymupdf as fitz
except ImportError:  # pymupdf < 1.24 only ships the old name
    import fitz

#: Assumed physical long edge (inches) when a broken PDF page box reports
#: >14 in and <140 DPI for a full-resolution scan (e.g. 96 DPI screen boxes).
_TYPICAL_BOOK_LONG_IN = 10.5


@dataclass(frozen=True)
class PageImageMetrics:
    page_width_in: float
    page_height_in: float
    image_count: int
    main_width_px: int | None
    main_height_px: int | None
    nominal_dpi: float | None
    oversized_mediabox: bool
    effective_dpi: float | None
    single_fullpage_image: bool


def open_doc(path):
    return fitz.open(path)


def page_image_metrics(doc, index: int) -> PageImageMetrics:
    """Measure true embedded-image dimensions and display DPI via PDF matrices."""
    page = doc[index]
    pr = page.rect
    w_in = pr.width / 72.0
    h_in = pr.height / 72.0
    images = page.get_images(full=True)
    infos = page.get_image_info(xrefs=True)

    main_info: dict | None = None
    main_area = -1.0
    main_dpi: float | None = None
    for info in infos:
        t = info.get("transform")
        if t and len(t) >= 4:
            disp_w = math.hypot(float(t[0]), float(t[1]))
            disp_h = math.hypot(float(t[2]), float(t[3]))
        else:
            bbox = fitz.Rect(info["bbox"])
            disp_w, disp_h = bbox.width, bbox.height
        area = disp_w * disp_h
        if area > main_area:
            main_area = area
            main_info = info
            raw_w = int(info.get("width") or 0)
            raw_h = int(info.get("height") or 0)
            if disp_w > 0 and disp_h > 0 and raw_w > 0 and raw_h > 0:
                dpi_x = raw_w / (disp_w / 72.0)
                dpi_y = raw_h / (disp_h / 72.0)
                main_dpi = (dpi_x + dpi_y) / 2.0
            else:
                main_dpi = None

    main_w = int(main_info["width"]) if main_info and main_info.get("width") else None
    main_h = int(main_info["height"]) if main_info and main_info.get("height") else None

    oversized = bool(
        max(w_in, h_in) > 14.0
        and main_dpi is not None
        and main_dpi < 140.0
        and main_w is not None
        and main_h is not None
        and max(main_w, main_h) >= 1200
    )
    if oversized and main_w is not None and main_h is not None:
        effective_dpi: float | None = max(main_w, main_h) / _TYPICAL_BOOK_LONG_IN
    else:
        effective_dpi = main_dpi

    single_fullpage = False
    if (
        len(images) == 1
        and len(infos) == 1
        and int(infos[0].get("xref") or 0) > 0
        and not images[0][1]
        and not infos[0].get("has-mask", False)
        and not page.get_text("text").strip()
        and not list(page.annots() or [])
        and not page.get_links()
        and not page.get_drawings()
    ):
        disp_bbox = fitz.Rect(infos[0]["bbox"]) * page.rotation_matrix
        single_fullpage = all(
            abs(a - b) <= 1.0
            for a, b in zip(
                (disp_bbox.x0, disp_bbox.y0, disp_bbox.x1, disp_bbox.y1),
                (pr.x0, pr.y0, pr.x1, pr.y1),
            )
        )

    return PageImageMetrics(
        page_width_in=w_in,
        page_height_in=h_in,
        image_count=len(images),
        main_width_px=main_w,
        main_height_px=main_h,
        nominal_dpi=main_dpi,
        oversized_mediabox=oversized,
        effective_dpi=effective_dpi,
        single_fullpage_image=single_fullpage,
    )


def ocr_render_dpi(
    doc,
    index: int,
    requested_dpi: float | None,
    *,
    max_side_px: int = 4500,
) -> float:
    """Safe raster DPI for OCR so oversized MediaBoxes or 150dpi scans never explode."""
    m = page_image_metrics(doc, index)
    long_in = max(m.page_width_in, m.page_height_in, 1e-3)
    if requested_dpi is None:
        if m.image_count == 1 and m.nominal_dpi is not None:
            dpi = min(m.nominal_dpi, 300.0)
        else:
            dpi = 300.0
    else:
        dpi = float(requested_dpi)

    pixel_cap = max_side_px
    if m.main_width_px and m.main_height_px:
        pixel_cap = max(max_side_px, max(m.main_width_px, m.main_height_px))
    if long_in * dpi > pixel_cap:
        dpi = pixel_cap / long_in
    return max(dpi, 36.0)


def page_render(
    doc,
    index: int,
    dpi: float,
    *,
    colorspace_gray_only: bool = False,
) -> tuple[np.ndarray, np.ndarray, tuple[float, float]]:
    """Return (rgb, gray, (width_pt, height_pt)) for one page."""
    page = doc[index]
    mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
    if colorspace_gray_only:
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY, alpha=False)
        gray = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width).copy()
        rgb = np.empty((0, 0, 3), dtype=np.uint8)
        return rgb, gray, (page.rect.width, page.rect.height)

    pix = page.get_pixmap(matrix=mat, alpha=False)
    rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3).copy()
    gray = (
        rgb[:, :, 0].astype(np.uint16) * 77
        + rgb[:, :, 1].astype(np.uint16) * 150
        + rgb[:, :, 2].astype(np.uint16) * 29
    ) >> 8
    return rgb, gray.astype(np.uint8), (page.rect.width, page.rect.height)


def colourfulness(rgb: np.ndarray, step: int = 8) -> float:
    """Mean channel disagreement; ~0 for a greyscale scan."""
    if rgb.size == 0:
        return 0.0
    s = rgb[::step, ::step].astype(np.int16)
    return float(
        (
            np.abs(s[:, :, 0] - s[:, :, 1])
            + np.abs(s[:, :, 1] - s[:, :, 2])
            + np.abs(s[:, :, 0] - s[:, :, 2])
        ).mean()
    )


def is_colourful(rgb: np.ndarray, threshold: float = 14.0) -> bool:
    return colourfulness(rgb) > threshold
