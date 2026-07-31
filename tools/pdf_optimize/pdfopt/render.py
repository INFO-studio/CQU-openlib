"""Page rasterisation and colour tests."""

from __future__ import annotations

import numpy as np

try:
    import pymupdf as fitz
except ImportError:  # pymupdf < 1.24 only ships the old name
    import fitz


def open_doc(path):
    return fitz.open(path)


def page_render(doc, index: int, dpi: float) -> tuple[np.ndarray, np.ndarray, tuple[float, float]]:
    """Return (rgb, gray, (width_pt, height_pt)) for one page."""
    page = doc[index]
    pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72.0, dpi / 72.0), alpha=False)
    rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3)
    gray = (
        rgb[:, :, 0].astype(np.uint16) * 77
        + rgb[:, :, 1].astype(np.uint16) * 150
        + rgb[:, :, 2].astype(np.uint16) * 29
    ) >> 8
    return rgb, gray.astype(np.uint8), (page.rect.width, page.rect.height)


def colourfulness(rgb: np.ndarray, step: int = 8) -> float:
    """Mean channel disagreement; ~0 for a greyscale scan."""
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
