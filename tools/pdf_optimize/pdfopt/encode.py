"""Turn one rendered page into the image streams a PDF page needs."""

from __future__ import annotations

import io
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from .config import Mode, Params
from .detect import Rect, coverage, find_regions
from .render import is_colourful, page_render


@dataclass
class Layer:
    """One image to draw on the page, positioned in source pixels."""

    kind: str  # "jbig2" | "jpeg"
    data: bytes
    width: int
    height: int
    colour: bool
    rect_px: Rect | None  # None = full page


@dataclass
class Page:
    index: int
    width_pt: float
    height_pt: float
    dpi: float
    layers: list[Layer]

    @property
    def nbytes(self) -> int:
        return sum(len(x.data) for x in self.layers)


# --------------------------------------------------------------------------


def _write_pgm(path: Path, gray: np.ndarray) -> None:
    h, w = gray.shape
    with path.open("wb") as f:
        f.write(b"P5\n%d %d\n255\n" % (w, h))
        f.write(np.ascontiguousarray(gray).tobytes())


def jbig2_stream(gray: np.ndarray, dpi: float, bw_threshold: int, scratch: Path) -> bytes:
    """1-bit JBIG2 generic-region stream, ready for PDF /JBIG2Decode.

    jbig2enc thresholds via leptonica's local adaptive method, which copes
    with the background gradients typical of book scans. JBIG2 is a bilevel
    codec: unlike a low-quality JPEG it has no ringing, so text edges come
    out crisper than the greyscale render they came from.
    """
    src = scratch / "page.pgm"
    _write_pgm(src, gray)
    try:
        proc = subprocess.run(
            ["jbig2", "-p", "-T", str(bw_threshold), "-D", str(int(round(dpi))), str(src)],
            capture_output=True,
        )
    finally:
        src.unlink(missing_ok=True)
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"jbig2 failed: {proc.stderr.decode(errors='replace')[:300]}")
    return proc.stdout


def jpeg_stream(
    rgb: np.ndarray,
    gray: np.ndarray,
    *,
    src_dpi: float,
    out_dpi: float,
    quality: int,
    allow_colour: bool,
) -> tuple[bytes, int, int, bool]:
    colour = allow_colour and is_colourful(rgb)
    img = Image.fromarray(rgb if colour else gray, "RGB" if colour else "L")
    if out_dpi < src_dpi:
        scale = out_dpi / src_dpi
        img = img.resize(
            (max(1, round(img.width * scale)), max(1, round(img.height * scale))),
            Image.Resampling.LANCZOS,
        )
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True, subsampling=2 if colour else 0)
    return buf.getvalue(), img.width, img.height, colour


# --------------------------------------------------------------------------


def encode_page(doc, index: int, params: Params, scratch: Path) -> Page:
    mode = params.mode
    if mode is Mode.AUTO:
        raise ValueError("resolve Mode.AUTO before encoding")

    dpi = params.dpi or 300.0
    if mode in (Mode.GRAY, Mode.COLOR):
        dpi = params.page_dpi or dpi

    rgb, gray, (w_pt, h_pt) = page_render(doc, index, dpi)
    layers: list[Layer] = []

    if mode in (Mode.GRAY, Mode.COLOR):
        data, w, h, colour = jpeg_stream(
            rgb,
            gray,
            src_dpi=dpi,
            out_dpi=dpi,
            quality=params.page_quality,
            allow_colour=mode is Mode.COLOR,
        )
        layers.append(Layer("jpeg", data, w, h, colour, None))
        return Page(index, w_pt, h_pt, dpi, layers)

    rects: list[Rect] = []
    if mode is Mode.MRC:
        rects = find_regions(gray, dpi, params.detect)

    for r in rects:
        x0, y0, x1, y1 = r
        data, w, h, colour = jpeg_stream(
            rgb[y0:y1, x0:x1],
            gray[y0:y1, x0:x1],
            src_dpi=dpi,
            out_dpi=params.photo_dpi,
            quality=params.photo_quality,
            allow_colour=params.keep_patch_color,
        )
        layers.append(Layer("jpeg", data, w, h, colour, r))

    # Blank the photo areas out of the text layer so the two don't overlap;
    # patches are drawn after it anyway, but this stops JBIG2 from wasting
    # bytes dithering a photo it will never be seen through.
    if coverage(rects, gray.shape) < 0.985:
        text_src = gray
        if rects:
            text_src = gray.copy()
            for x0, y0, x1, y1 in rects:
                text_src[y0:y1, x0:x1] = 255
        data = jbig2_stream(text_src, dpi, params.bw_threshold, scratch)
        layers.insert(0, Layer("jbig2", data, text_src.shape[1], text_src.shape[0], False, None))

    return Page(index, w_pt, h_pt, dpi, layers)


def scratch_dir() -> Path:
    return Path(tempfile.mkdtemp(prefix="pdfopt-"))
