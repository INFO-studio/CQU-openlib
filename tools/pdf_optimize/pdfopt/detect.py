"""Find continuous-tone (photographic) regions on a rendered page."""

from __future__ import annotations

import numpy as np

from .config import Detect

Rect = tuple[int, int, int, int]  # x0, y0, x1, y1 in pixels


def normalize(gray: np.ndarray) -> np.ndarray:
    """Stretch against the page's own paper-white and darkest ink, so a
    yellowed page or uneven scanner lamp doesn't read as continuous tone."""
    a = gray.astype(np.float32)
    hi = float(np.percentile(a, 95))
    lo = float(np.percentile(a, 2))
    return np.clip((a - lo) / max(hi - lo, 1.0) * 255.0, 0, 255)


def block_stats(
    gray: np.ndarray, block: int, white_level: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Per-block paper-white fraction, midtone fraction, mean and stddev."""
    n = normalize(gray)
    h, w = n.shape
    bh, bw = h // block, w // block
    if bh < 2 or bw < 2:
        z = np.zeros((0, 0))
        return z, z, z, z
    b = n[: bh * block, : bw * block].reshape(bh, block, bw, block)
    white = (b >= white_level).mean(axis=(1, 3))
    mid = ((b > 70) & (b < 190)).mean(axis=(1, 3))
    return white, mid, b.mean(axis=(1, 3)), b.std(axis=(1, 3))


def _labelled_bboxes(mask: np.ndarray) -> list[tuple[Rect, int, np.ndarray]]:
    """4-connected components of ``mask`` as (bbox_in_blocks, count, member_mask)."""
    seen = np.zeros(mask.shape, bool)
    h, w = mask.shape
    out = []
    for i in range(h):
        for j in range(w):
            if not mask[i, j] or seen[i, j]:
                continue
            stack = [(i, j)]
            seen[i, j] = True
            members = np.zeros(mask.shape, bool)
            i0 = i1 = i
            j0 = j1 = j
            n = 0
            while stack:
                y, x = stack.pop()
                members[y, x] = True
                n += 1
                i0, i1 = min(i0, y), max(i1, y)
                j0, j1 = min(j0, x), max(j1, x)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            out.append(((j0, i0, j1, i1), n, members))
    return out


def merge_rects(rects: list[Rect], gap: int) -> list[Rect]:
    rects = list(rects)
    changed = True
    while changed:
        changed = False
        for a in range(len(rects)):
            for b in range(a + 1, len(rects)):
                ax0, ay0, ax1, ay1 = rects[a]
                bx0, by0, bx1, by1 = rects[b]
                if ax0 - gap < bx1 and bx0 - gap < ax1 and ay0 - gap < by1 and by0 - gap < ay1:
                    rects[a] = (min(ax0, bx0), min(ay0, by0), max(ax1, bx1), max(ay1, by1))
                    rects.pop(b)
                    changed = True
                    break
            if changed:
                break
    return rects


def find_regions(gray: np.ndarray, dpi: float, cfg: Detect) -> list[Rect]:
    """Rects covering photographic content, in pixel coordinates of ``gray``."""
    block = max(8, int(round(cfg.block_in * dpi)))
    white, mid, mean, std = block_stats(gray, block, cfg.white_level)
    if white.size == 0:
        return []

    seed = (white < cfg.seed_white) | (mid > cfg.seed_mid)
    if cfg.seed_flat_std > 0:
        seed |= (
            (std > cfg.seed_flat_std)
            & (std < cfg.seed_flat_max_std)
            & (mean < cfg.seed_flat_max_mean)
        )
    if not seed.any():
        return []
    grow = (white < cfg.grow_white) | seed

    h, w = gray.shape
    rects: list[Rect] = []
    for (j0, i0, j1, i1), count, members in _labelled_bboxes(grow):
        # Grown regions only count if strict evidence sits inside them; this
        # keeps sparse ink (thin rules, bold headings) from snowballing.
        if not (members & seed).any():
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

    rects = merge_rects(rects, gap=block)
    pad = max(1, int(round(cfg.pad_in * dpi)))
    return [
        (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad))
        for x0, y0, x1, y1 in rects
    ]


def coverage(rects: list[Rect], shape: tuple[int, int]) -> float:
    if not rects:
        return 0.0
    total = shape[0] * shape[1]
    return sum((x1 - x0) * (y1 - y0) for x0, y0, x1, y1 in rects) / max(total, 1)
