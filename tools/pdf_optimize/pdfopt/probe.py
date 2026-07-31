"""Inspect a source PDF: native resolution, colour, how photographic it is."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .config import Detect, Mode
from .detect import block_stats, find_regions
from .render import colourfulness, open_doc, page_render


@dataclass
class PageProbe:
    index: int
    native_dpi: float | None
    colourfulness: float
    seed_fraction: float  # share of blocks that are clearly continuous-tone
    photo_coverage: float


@dataclass
class SourceProbe:
    path: Path
    size: int
    page_count: int
    native_dpi: float
    has_text_layer: bool
    sampled: list[PageProbe]

    @property
    def colour_pages(self) -> float:
        if not self.sampled:
            return 0.0
        return sum(1 for p in self.sampled if p.colourfulness > 14.0) / len(self.sampled)

    @property
    def photo_pages(self) -> float:
        if not self.sampled:
            return 0.0
        return sum(1 for p in self.sampled if p.photo_coverage > 0.02) / len(self.sampled)

    @property
    def mean_photo_coverage(self) -> float:
        if not self.sampled:
            return 0.0
        return sum(p.photo_coverage for p in self.sampled) / len(self.sampled)

    def recommend(self) -> tuple[Mode, str]:
        """Pick a mode. Binarizing is a one-way door, so only choose it when
        the document really is printed text on paper."""
        if self.mean_photo_coverage > 0.55:
            return Mode.COLOR if self.colour_pages > 0.3 else Mode.GRAY, (
                "most of the page area is continuous-tone; binarizing would "
                "destroy it"
            )
        if not self.has_text_layer and self.mean_photo_coverage < 0.35:
            return Mode.MRC, "printed text scan with localised figures"
        return Mode.GRAY, "mixed content; keeping continuous tone everywhere"


def sample_indices(count: int, n: int) -> list[int]:
    if count <= n:
        return list(range(count))
    step = count / n
    return sorted({min(count - 1, int(i * step)) for i in range(n)})


def probe(path: Path, *, samples: int = 16, detect: Detect | None = None) -> SourceProbe:
    cfg = detect or Detect()
    doc = open_doc(path)
    try:
        count = doc.page_count
        idxs = sample_indices(count, samples)
        has_text = False
        native = []
        pages: list[PageProbe] = []
        for i in idxs:
            page = doc[i]
            if page.get_text("text").strip():
                has_text = True
            dpi_guess = None
            for img in page.get_images(full=True):
                info = doc.extract_image(img[0])
                if page.rect.width > 0:
                    dpi_guess = info["width"] / (page.rect.width / 72.0)
                break
            if dpi_guess:
                native.append(dpi_guess)

            probe_dpi = 150.0
            rgb, gray, _ = page_render(doc, i, probe_dpi)
            white, mid, _mean, _std = block_stats(
                gray, max(8, int(cfg.block_in * probe_dpi)), cfg.white_level
            )
            seed_frac = (
                float(((white < cfg.seed_white) | (mid > cfg.seed_mid)).mean())
                if white.size
                else 0.0
            )
            rects = find_regions(gray, probe_dpi, cfg)
            cov = (
                sum((x1 - x0) * (y1 - y0) for x0, y0, x1, y1 in rects)
                / max(gray.shape[0] * gray.shape[1], 1)
            )
            pages.append(PageProbe(i, dpi_guess, colourfulness(rgb), seed_frac, cov))

        native_dpi = round(sum(native) / len(native)) if native else 300.0
        # Snap to the usual scanner settings; a stray 299.7 is noise.
        for std in (600, 400, 300, 200, 150, 120, 96):
            if abs(native_dpi - std) / std < 0.06:
                native_dpi = float(std)
                break
        return SourceProbe(
            path=path,
            size=path.stat().st_size,
            page_count=count,
            native_dpi=float(native_dpi),
            has_text_layer=has_text,
            sampled=pages,
        )
    finally:
        doc.close()
