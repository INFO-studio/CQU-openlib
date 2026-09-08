"""Turn one rendered page into the image streams a PDF page needs."""

from __future__ import annotations

import io
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from .config import Bilevel, Mode, Params, Tone
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


def _sauvola_ink(gray: np.ndarray, radius: int, k: float, stripe: int = 768) -> np.ndarray:
    """Ink mask from a threshold local to each pixel's neighbourhood.

    ``T = m·(1 + k·(s/128 − 1))`` over a (2r+1)² window. On flat paper the
    deviation term drags the cut well below the local mean, so grain stays
    white; where there is real contrast it rises towards the mean and takes
    the stroke without its halo.

    Computed from exact integer summed-area tables, one horizontal stripe at
    a time. Exact because the sums of squares reach ~4e11 over a page, where
    differencing float32 tables loses more precision than a blank margin's
    variance amounts to; striped because one uint64 table for a whole page
    would cost more memory than the rest of the encoder put together. Edges
    are padded by replication, so every window is full and margins don't
    drift.
    """
    h, w = gray.shape
    side = 2 * radius + 1
    n = float(side * side)
    padded = np.pad(gray, radius, mode="edge")
    ink = np.empty((h, w), bool)
    for top in range(0, h, stripe):
        bottom = min(top + stripe, h)
        rows = bottom - top
        band = padded[top : bottom + 2 * radius].astype(np.uint64)
        means = []
        for values in (band, band * band):
            table = np.pad(values.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
            means.append(
                (
                    table[side:, side:].astype(np.float64)
                    - table[:rows, side:]
                    - table[side:, :w]
                    + table[:rows, :w]
                )
                / n
            )
        mean, mean_sq = means
        deviation = np.sqrt(np.maximum(mean_sq - mean * mean, 0.0))
        ink[top:bottom] = gray[top:bottom] < mean * (1.0 + k * (deviation / 128.0 - 1.0))
    return ink


def bilevel_mask(gray: np.ndarray, dpi: float, cfg: Bilevel) -> tuple[np.ndarray, float]:
    """Threshold the text layer. Returns the 0/255 bitmap and its DPI.

    Resample up to ``cfg.min_dpi`` first, smooth by a fraction of a source
    pixel, then cut against the local mean and contrast (Sauvola). See
    ``Bilevel`` for why each of the three steps is there.
    """
    out_dpi = max(dpi, cfg.min_dpi)
    scale = out_dpi / dpi
    img = Image.fromarray(gray, "L")
    if scale > 1.0:
        img = img.resize(
            (max(1, round(img.width * scale)), max(1, round(img.height * scale))),
            Image.Resampling.LANCZOS,
        )
    if cfg.smooth > 0:
        img = img.filter(ImageFilter.GaussianBlur(cfg.smooth * scale))
    prepared = np.asarray(img)

    if cfg.global_threshold is not None:
        ink = prepared < cfg.global_threshold
    else:
        ink = _sauvola_ink(prepared, max(1, round(cfg.window_in * out_dpi / 2)), cfg.k)
    return np.where(ink, 0, 255).astype(np.uint8), out_dpi


def tone_lut(gray: np.ndarray, cfg: Tone) -> np.ndarray | None:
    """Levels curve for this page, or None to leave it alone.

    Reads the page's own ink and paper levels off its histogram and returns
    the 256-entry map that takes them to black and white. Monotonic by
    construction: it darkens what is already dark relative to the paper it
    was printed on, and cannot break a stroke the way a cut level can. See
    ``Tone`` for why the anchors are measured rather than given.
    """
    if cfg.strength <= 0:
        return None
    paper, ink = np.percentile(gray, [cfg.paper_pct, cfg.ink_pct])
    if paper < cfg.min_paper or paper - ink < cfg.min_range:
        return None
    level = np.arange(256, dtype=np.float32)
    stretched = np.clip((level - ink) * (255.0 / (paper - ink)), 0.0, 255.0)
    blended = level + cfg.strength * (stretched - level)
    return np.clip(blended, 0.0, 255.0).round().astype(np.uint8)


def jbig2_stream(bitmap: np.ndarray, dpi: float, scratch: Path) -> bytes:
    """1-bit JBIG2 generic-region stream, ready for PDF /JBIG2Decode.

    ``bitmap`` is already 0/255, so jbig2enc's own cut level is a
    pass-through. JBIG2 is a bilevel codec: unlike a low-quality JPEG it has
    no ringing, so the edges survive exactly as thresholded.
    """
    src = scratch / "page.pgm"
    _write_pgm(src, bitmap)
    try:
        proc = subprocess.run(
            ["jbig2", "-p", "-T", "128", "-D", str(int(round(dpi))), str(src)],
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

    # Before anything is measured or cut: a washed-out scan is a greyscale
    # problem, and fixing it here means the detector, the threshold and the
    # JPEG all see the page the reader will.
    lut = tone_lut(gray, params.tone)
    if lut is not None:
        gray, rgb = lut[gray], lut[rgb]

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
        bitmap, text_dpi = bilevel_mask(text_src, dpi, params.bilevel)
        data = jbig2_stream(bitmap, text_dpi, scratch)
        layers.insert(0, Layer("jbig2", data, bitmap.shape[1], bitmap.shape[0], False, None))

    return Page(index, w_pt, h_pt, dpi, layers)


def scratch_dir() -> Path:
    return Path(tempfile.mkdtemp(prefix="pdfopt-"))
