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
    render_width: int = 0
    render_height: int = 0

    @property
    def nbytes(self) -> int:
        return sum(len(x.data) for x in self.layers)


# --------------------------------------------------------------------------


def _write_pbm(path: Path, bitmap: np.ndarray) -> None:
    """Write a 0/255 (0=black ink, 255=white paper) mask as 1-bit P4 PBM."""
    h, w = bitmap.shape
    packed = np.packbits(bitmap == 0, axis=1)
    with path.open("wb") as f:
        f.write(b"P4\n%d %d\n" % (w, h))
        f.write(np.ascontiguousarray(packed).tobytes())


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

    Resample up to ``cfg.min_dpi`` with bicubic interpolation (avoids Lanczos
    ringing halos next to strokes), smooth by a fraction of a source pixel,
    then cut against the local mean and contrast (Sauvola).
    """
    out_dpi = max(dpi, cfg.min_dpi)
    scale = out_dpi / dpi
    img = Image.fromarray(gray, "L")
    if scale > 1.0:
        img = img.resize(
            (max(1, round(img.width * scale)), max(1, round(img.height * scale))),
            Image.Resampling.BICUBIC,
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
    """Continuous, monotonic levels curve for this page, or None to skip.

    Reads the page's own ink and paper levels off its histogram and builds a
    piecewise-linear 256-entry LUT without step discontinuities — even when
    ``showthrough > 0`` and ``strength < 1``.
    """
    if cfg.strength <= 0 and cfg.showthrough <= 0:
        return None
    paper, ink = np.percentile(gray, [cfg.paper_pct, cfg.ink_pct])
    white = float(paper - cfg.showthrough * (paper - ink))
    if paper < cfg.min_paper or white - ink < cfg.min_range:
        return None

    strength = float(max(0.0, min(1.0, cfg.strength)))
    ink_f = float(ink)
    paper_f = float(paper)
    ink_out = ink_f * (1.0 - strength)
    white_out = 255.0 if cfg.showthrough > 0 else paper_f + strength * (255.0 - paper_f)

    level = np.arange(256, dtype=np.float32)
    out = np.empty(256, dtype=np.float32)

    low = level <= ink_f
    mid = (level > ink_f) & (level < white)
    high = level >= white

    out[low] = level[low] * (ink_out / max(ink_f, 1.0))
    out[mid] = ink_out + (level[mid] - ink_f) * ((white_out - ink_out) / max(white - ink_f, 1e-3))
    if cfg.showthrough > 0:
        out[high] = 255.0
    else:
        out[high] = white_out + (level[high] - white) * ((255.0 - white_out) / max(255.0 - white, 1.0))

    return np.clip(out, 0.0, 255.0).round().astype(np.uint8)


def _apply_tone_rgb(rgb: np.ndarray, gray: np.ndarray, lut: np.ndarray) -> np.ndarray:
    """Apply a grayscale tone curve to RGB while preserving hue and pushing clipped highlights to white."""
    g_in = gray.astype(np.float32)
    g_out = lut[gray].astype(np.float32)
    rgb_f = rgb.astype(np.float32)
    out = rgb_f.copy()

    darken = g_out <= g_in
    if darken.any():
        scale = g_out[darken] / np.maximum(g_in[darken], 1.0)
        out[darken] = rgb_f[darken] * scale[:, None]

    brighten = ~darken
    if brighten.any():
        t = (g_out[brighten] - g_in[brighten]) / np.maximum(255.0 - g_in[brighten], 1.0)
        out[brighten] = rgb_f[brighten] + t[:, None] * (255.0 - rgb_f[brighten])

    return np.clip(out, 0.0, 255.0).round().astype(np.uint8)


def jbig2_stream(bitmap: np.ndarray, dpi: float, scratch: Path) -> bytes:
    """1-bit JBIG2 generic-region stream, ready for PDF /JBIG2Decode."""
    src = scratch / "page.pbm"
    _write_pbm(src, bitmap)
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
    phys_dpi = dpi * params.dpi_scale

    orig_rgb, gray, (w_pt, h_pt) = page_render(
        doc, index, dpi, colorspace_gray_only=(mode is Mode.GRAY)
    )
    h_px, w_px = gray.shape
    layers: list[Layer] = []

    lut = tone_lut(gray, params.tone)
    gray_toned = lut[gray] if lut is not None else gray

    if mode in (Mode.GRAY, Mode.COLOR):
        rgb_toned = (
            _apply_tone_rgb(orig_rgb, gray, lut)
            if (mode is Mode.COLOR and lut is not None and is_colourful(orig_rgb))
            else orig_rgb
        )
        data, w, h, colour = jpeg_stream(
            rgb_toned,
            gray_toned,
            src_dpi=phys_dpi,
            out_dpi=phys_dpi,
            quality=params.page_quality,
            allow_colour=mode is Mode.COLOR,
        )
        layers.append(Layer("jpeg", data, w, h, colour, None))
        return Page(index, w_pt, h_pt, dpi, layers, render_width=w_px, render_height=h_px)

    rects: list[Rect] = []
    if mode is Mode.MRC:
        rects = find_regions(gray_toned, phys_dpi, params.detect, rgb=orig_rgb)

    for r in rects:
        x0, y0, x1, y1 = r
        # Keep colour patches untainted by the grayscale text tone curve.
        data, w, h, colour = jpeg_stream(
            orig_rgb[y0:y1, x0:x1],
            gray_toned[y0:y1, x0:x1],
            src_dpi=phys_dpi,
            out_dpi=params.photo_dpi,
            quality=params.photo_quality,
            allow_colour=params.keep_patch_color,
        )
        layers.append(Layer("jpeg", data, w, h, colour, r))

    # Threshold the full grayscale page first so blanked photo borders never
    # distort Sauvola's local mean/variance for adjacent captions, then white out
    # photo regions on the final 1-bit bitmap before JBIG2 encoding.
    if coverage(rects, gray_toned.shape) < 0.985:
        bitmap, text_dpi = bilevel_mask(gray_toned, phys_dpi, params.bilevel)
        if rects:
            bh, bw = bitmap.shape
            for x0, y0, x1, y1 in rects:
                bx0 = max(0, int(x0 * bw / w_px))
                by0 = max(0, int(y0 * bh / h_px))
                bx1 = min(bw, int(np.ceil(x1 * bw / w_px)))
                by1 = min(bh, int(np.ceil(y1 * bh / h_px)))
                bitmap[by0:by1, bx0:bx1] = 255
        data = jbig2_stream(bitmap, text_dpi, scratch)
        layers.insert(0, Layer("jbig2", data, bitmap.shape[1], bitmap.shape[0], False, None))

    return Page(index, w_pt, h_pt, dpi, layers, render_width=w_px, render_height=h_px)


def scratch_dir() -> Path:
    return Path(tempfile.mkdtemp(prefix="pdfopt-"))
