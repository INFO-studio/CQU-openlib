"""Find continuous-tone (photographic) regions on a rendered page."""

from __future__ import annotations

import numpy as np

from .config import Detect

Rect = tuple[int, int, int, int]  # x0, y0, x1, y1 in pixels


def normalize(gray: np.ndarray) -> np.ndarray:
    """Stretch against the page's own paper-white and darkest ink, so a
    yellowed page or uneven scanner lamp doesn't read as continuous tone.

    Flat blank paper (low dynamic range and bright) stays white instead of
    having scanner grain stretched across 0..255; uniformly dark pages/covers
    stay dark so they are not split into false paper patches.
    """
    a = gray.astype(np.float32)
    hi = float(np.percentile(a, 95))
    lo = float(np.percentile(a, 2))
    if hi - lo < 24.0:
        if hi >= 200.0:
            return np.full_like(a, 255.0)
        return a
    if hi < 180.0:
        return a
    return np.clip((a - lo) / max(hi - lo, 1.0) * 255.0, 0, 255)


def _pad_to_block(arr: np.ndarray, block: int) -> np.ndarray:
    h, w = arr.shape[:2]
    pad_h = (block - h % block) % block
    pad_w = (block - w % block) % block
    if pad_h == 0 and pad_w == 0:
        return arr
    pad_width = ((0, pad_h), (0, pad_w)) if arr.ndim == 2 else ((0, pad_h), (0, pad_w), (0, 0))
    return np.pad(arr, pad_width, mode="edge")


def block_stats(
    gray: np.ndarray, block: int, white_level: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Per-block paper-white fraction, midtone fraction, mean and stddev."""
    n = normalize(gray)
    h, w = n.shape
    if h < 2 * block or w < 2 * block:
        z = np.zeros((0, 0))
        return z, z, z, z
    padded = _pad_to_block(n, block)
    ph, pw = padded.shape
    bh, bw = ph // block, pw // block
    b = padded.reshape(bh, block, bw, block)
    white = (b >= white_level).mean(axis=(1, 3))
    mid = ((b > 70) & (b < 190)).mean(axis=(1, 3))
    return white, mid, b.mean(axis=(1, 3)), b.std(axis=(1, 3))


def chroma_stats(rgb: np.ndarray, block: int, chroma_threshold: int) -> np.ndarray:
    """Per-block fraction of pixels with strong RGB channel disagreement."""
    if rgb.size == 0:
        return np.zeros((0, 0))
    h, w = rgb.shape[:2]
    if h < 2 * block or w < 2 * block:
        return np.zeros((0, 0))
    padded = _pad_to_block(rgb, block)
    ph, pw = padded.shape[:2]
    bh, bw = ph // block, pw // block
    spread = padded.max(axis=2).astype(np.int16) - padded.min(axis=2).astype(np.int16)
    blocks = (spread > chroma_threshold).reshape(bh, block, bw, block)
    return blocks.mean(axis=(1, 3))


def _labelled_components(
    mask: np.ndarray, seed: np.ndarray
) -> list[tuple[Rect, int, bool]]:
    """4-connected components of ``mask`` as (bbox_in_blocks, count, has_seed)."""
    seen = np.zeros(mask.shape, bool)
    h, w = mask.shape
    out: list[tuple[Rect, int, bool]] = []
    for i in range(h):
        for j in range(w):
            if not mask[i, j] or seen[i, j]:
                continue
            stack = [(i, j)]
            seen[i, j] = True
            i0 = i1 = i
            j0 = j1 = j
            n = 0
            has_seed = False
            while stack:
                y, x = stack.pop()
                n += 1
                if seed[y, x]:
                    has_seed = True
                i0, i1 = min(i0, y), max(i1, y)
                j0, j1 = min(j0, x), max(j1, x)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            out.append(((j0, i0, j1, i1), n, has_seed))
    return out


def merge_rects(
    rects: list[Rect],
    gap: int,
    *,
    max_area_ratio: float | None = None,
) -> list[Rect]:
    rects = list(rects)
    changed = True
    while changed:
        changed = False
        for a in range(len(rects)):
            ax0, ay0, ax1, ay1 = rects[a]
            for b in range(a + 1, len(rects)):
                bx0, by0, bx1, by1 = rects[b]
                if not (
                    ax0 - gap < bx1
                    and bx0 - gap < ax1
                    and ay0 - gap < by1
                    and by0 - gap < ay1
                ):
                    continue
                mx0, my0 = min(ax0, bx0), min(ay0, by0)
                mx1, my1 = max(ax1, bx1), max(ay1, by1)
                already_overlap = ax0 < bx1 and bx0 < ax1 and ay0 < by1 and by0 < ay1
                if max_area_ratio is not None and not already_overlap:
                    area_sum = max((ax1 - ax0) * (ay1 - ay0) + (bx1 - bx0) * (by1 - by0), 1)
                    merged_area = (mx1 - mx0) * (my1 - my0)
                    if merged_area > area_sum * max_area_ratio:
                        continue
                rects[a] = (mx0, my0, mx1, my1)
                rects.pop(b)
                changed = True
                break
            if changed:
                break
    return rects


def detect_regions_and_seed_fraction(
    gray: np.ndarray,
    dpi: float,
    cfg: Detect,
    *,
    rgb: np.ndarray | None = None,
) -> tuple[list[Rect], float]:
    """Return (rects_px, seed_block_fraction) in pixel coordinates of ``gray``."""
    block = max(8, int(round(cfg.block_in * dpi)))
    white, mid, mean, std = block_stats(gray, block, cfg.white_level)
    if white.size == 0:
        return [], 0.0

    seed = (white < cfg.seed_white) | (mid > cfg.seed_mid)
    if rgb is not None and cfg.seed_chroma > 0:
        chroma = chroma_stats(rgb, block, cfg.chroma_threshold)
        if chroma.shape == seed.shape:
            seed |= chroma >= cfg.seed_chroma
    seed_frac = float(seed.mean())

    if cfg.seed_flat_std > 0:
        seed |= (
            (std > cfg.seed_flat_std)
            & (std < cfg.seed_flat_max_std)
            & (mean < cfg.seed_flat_max_mean)
        )
    if not seed.any():
        return [], seed_frac
    grow = (white < cfg.grow_white) | seed

    h, w = gray.shape
    rects: list[Rect] = []
    for (j0, i0, j1, i1), count, has_seed in _labelled_components(grow, seed):
        # Grown regions only count if strict evidence sits inside them; this
        # keeps sparse ink (thin rules, bold headings) from snowballing.
        if not has_seed:
            continue
        hp = (i1 - i0 + 1) * block
        wp = (j1 - j0 + 1) * block
        if min(hp, wp) / dpi < cfg.min_side_in:
            continue
        if (hp / dpi) * (wp / dpi) < cfg.min_area_in2:
            continue
        if count / max((i1 - i0 + 1) * (j1 - j0 + 1), 1) < cfg.min_fill:
            continue
        rects.append(
            (j0 * block, i0 * block, min((j1 + 1) * block, w), min((i1 + 1) * block, h))
        )

    # Merge nearby boxes only when doing so doesn't swallow large text gaps,
    # then pad and strictly coalesce any overlaps so patches never duplicate pixels.
    rects = merge_rects(rects, gap=block, max_area_ratio=1.5)
    pad = max(1, int(round(cfg.pad_in * dpi)))
    padded = [
        (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad))
        for x0, y0, x1, y1 in rects
    ]
    return merge_rects(padded, gap=0, max_area_ratio=None), seed_frac


def find_regions(
    gray: np.ndarray,
    dpi: float,
    cfg: Detect,
    *,
    rgb: np.ndarray | None = None,
) -> list[Rect]:
    """Rects covering photographic content, in pixel coordinates of ``gray``."""
    rects, _ = detect_regions_and_seed_fraction(gray, dpi, cfg, rgb=rgb)
    return rects


def coverage(rects: list[Rect], shape: tuple[int, int]) -> float:
    """Exact union-area fraction covered by ``rects`` within ``shape`` (h, w)."""
    if not rects:
        return 0.0
    h, w = shape
    if h <= 0 or w <= 0:
        return 0.0
    clamped = [
        (max(0, x0), max(0, y0), min(w, x1), min(h, y1))
        for x0, y0, x1, y1 in rects
        if min(w, x1) > max(0, x0) and min(h, y1) > max(0, y0)
    ]
    if not clamped:
        return 0.0
    xs = sorted({x0 for x0, _, _, _ in clamped} | {x1 for _, _, x1, _ in clamped})
    union_area = 0
    for xl, xr in zip(xs, xs[1:]):
        if xr <= xl:
            continue
        ys = sorted((y0, y1) for rx0, y0, rx1, y1 in clamped if rx0 <= xl and rx1 >= xr)
        if not ys:
            continue
        covered_y = 0
        cur_y0, cur_y1 = ys[0]
        for y0, y1 in ys[1:]:
            if y0 <= cur_y1:
                cur_y1 = max(cur_y1, y1)
            else:
                covered_y += cur_y1 - cur_y0
                cur_y0, cur_y1 = y0, y1
        covered_y += cur_y1 - cur_y0
        union_area += covered_y * (xr - xl)
    return union_area / (h * w)
