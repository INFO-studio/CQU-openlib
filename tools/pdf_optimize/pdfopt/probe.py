"""Inspect a source PDF: native resolution, exposure, colour, and layout."""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .config import Detect, Mode
from .detect import coverage, detect_regions_and_seed_fraction
from .render import colourfulness, open_doc, page_image_metrics, page_render

try:
    import pymupdf as fitz
except ImportError:  # pymupdf < 1.24 only ships the old name
    import fitz

_STD_DPIS = (600, 400, 300, 240, 200, 150, 120, 96)


def _native_exposure(doc, page) -> tuple[float, float] | None:
    """Measure paper_p80 and ink_p05 directly from a single-image page's raw pixels."""
    images = page.get_images(full=True)
    if len(images) != 1:
        return None
    xref = int(images[0][0])
    if xref <= 0:
        return None
    try:
        pm = fitz.Pixmap(doc, xref)
        if pm.alpha:
            pm = fitz.Pixmap(fitz.csRGB, pm)
        if pm.colorspace != fitz.csGRAY:
            pm = fitz.Pixmap(fitz.csGRAY, pm)
        arr = np.frombuffer(pm.samples, np.uint8).reshape(pm.height, pm.width)
        sample = arr[::2, ::2] if min(arr.shape) >= 4 else arr
        p80, p05 = np.percentile(sample, [80.0, 0.5])
        return float(p80), float(p05)
    except Exception:
        return None


def _snap_dpi(dpi: float) -> float:
    rounded = round(dpi)
    for std in _STD_DPIS:
        if abs(rounded - std) / std < 0.06:
            return float(std)
    return float(rounded)


@dataclass
class PageProbe:
    index: int
    native_dpi: float | None
    colourfulness: float
    seed_fraction: float  # share of blocks that are clearly continuous-tone
    photo_coverage: float
    image_px: tuple[int, int] | None = None
    page_size_in: tuple[float, float] = (0.0, 0.0)
    oversized_mediabox: bool = False
    effective_dpi: float | None = None
    ink_p05: float = 0.0
    paper_p80: float = 255.0
    has_text: bool = False
    has_annots: bool = False
    single_fullpage_image: bool = False


@dataclass
class SourceProbe:
    path: Path
    size: int
    page_count: int
    native_dpi: float
    has_text_layer: bool
    sampled: list[PageProbe]
    effective_dpi: float = 0.0
    oversized_mediabox: bool = False
    median_image_px: tuple[int, int] | None = None
    median_page_size_in: tuple[float, float] = (0.0, 0.0)
    median_ink_p05: float = 0.0
    median_paper_p80: float = 255.0
    annot_pages: int = 0
    toc_count: int = 0

    def __post_init__(self) -> None:
        if self.effective_dpi <= 0.0:
            self.effective_dpi = self.native_dpi

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

    @property
    def text_pages(self) -> float:
        if not self.sampled:
            return 0.0
        return sum(1 for p in self.sampled if p.has_text) / len(self.sampled)

    @property
    def mostly_has_text(self) -> bool:
        return self.text_pages >= 0.5

    @property
    def single_image_pages(self) -> float:
        if not self.sampled:
            return 0.0
        return sum(1 for p in self.sampled if p.single_fullpage_image) / len(self.sampled)

    def _continuous_fallback(self) -> Mode:
        return Mode.COLOR if self.colour_pages > 0.05 else Mode.GRAY

    def recommend(self) -> tuple[Mode, str]:
        """Pick a ``pdfopt run`` mode aligned with the binarization rules."""
        if self.mean_photo_coverage > 0.55:
            return self._continuous_fallback(), (
                "most of the page area is continuous-tone; binarizing would destroy it"
            )
        if self.oversized_mediabox:
            return self._continuous_fallback(), (
                "oversized MediaBox makes PDF-pt DPI unreliable; avoid automatic binarization "
                "(prefer `pdfopt continuous`)"
            )
        if self.effective_dpi <= 160.0:
            return self._continuous_fallback(), (
                f"low effective DPI (~{self.effective_dpi:g}); binarizing destroys anti-aliased strokes"
            )
        if self.median_ink_p05 > 100.0:
            return self._continuous_fallback(), (
                f"faint exposure (ink p0.5={self.median_ink_p05:.0f} > 100); "
                "use continuous tone (+ optional --text-contrast) instead of binarizing"
            )
        if self.photo_pages >= 0.70 and self.mean_photo_coverage >= 0.10:
            return self._continuous_fallback(), (
                "almost every page flagged continuous-tone regions (likely MRC misdetection); "
                "avoid mixing JBIG2 and JPEG on body text"
            )
        if not self.mostly_has_text and self.mean_photo_coverage < 0.35:
            return Mode.MRC, "printed text scan with crisp ink and localised figures"
        return self._continuous_fallback(), "mixed or already-OCRed content; keeping continuous tone"

    def recommend_workflow(self) -> tuple[str, str]:
        """Higher-level recommendation across `keep`, `continuous`, `ocr`, and `run`."""
        mode, why = self.recommend()
        if (
            self.single_image_pages >= 0.85
            and (
                self.oversized_mediabox
                or (self.photo_pages >= 0.70 and self.mean_photo_coverage >= 0.10)
            )
        ):
            return (
                "pdfopt continuous",
                "single full-page scan with oversized box or MRC region false positives",
            )
        if self.effective_dpi <= 160.0 and self.size <= 80 * 1048576:
            action = "keep-as-is" if self.mostly_has_text else "keep-as-is + pdfopt ocr"
            return action, (
                f"~{self.effective_dpi:g}dpi scan already <= 80MB; re-encoding only loses detail"
            )
        return f"pdfopt run --mode {mode.value}", why


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
        toc_count = len(doc.get_toc())
        idxs = sample_indices(count, samples)
        native: list[float] = []
        effective: list[float] = []
        img_ws: list[int] = []
        img_hs: list[int] = []
        page_ws: list[float] = []
        page_hs: list[float] = []
        oversized_count = 0
        annot_pages = 0
        pages: list[PageProbe] = []

        for i in idxs:
            page = doc[i]
            has_text = bool(page.get_text("text").strip())
            has_annots = bool(list(page.annots() or []))
            if has_annots:
                annot_pages += 1

            m = page_image_metrics(doc, i)
            page_ws.append(m.page_width_in)
            page_hs.append(m.page_height_in)
            if m.nominal_dpi is not None:
                native.append(m.nominal_dpi)
            if m.effective_dpi is not None:
                effective.append(m.effective_dpi)
            if m.main_width_px is not None and m.main_height_px is not None:
                img_ws.append(m.main_width_px)
                img_hs.append(m.main_height_px)
            if m.oversized_mediabox:
                oversized_count += 1

            # Avoid rendering >4K pages during probe if MediaBox is oversized.
            probe_dpi = 150.0
            if m.oversized_mediabox and m.nominal_dpi is not None:
                probe_dpi = min(150.0, max(m.nominal_dpi * 0.6, 48.0))

            rgb, gray, _ = page_render(doc, i, probe_dpi)
            native_exp = (
                _native_exposure(doc, page)
                if (m.image_count == 1 and m.main_width_px and m.main_height_px)
                else None
            )
            if native_exp is not None:
                paper_p80, ink_p05 = native_exp
            else:
                paper_p80, ink_p05 = np.percentile(gray, [80.0, 0.5])
            rects, seed_frac = detect_regions_and_seed_fraction(gray, probe_dpi, cfg, rgb=rgb)
            cov = coverage(rects, gray.shape)
            image_px = (
                (m.main_width_px, m.main_height_px)
                if m.main_width_px and m.main_height_px
                else None
            )
            pages.append(
                PageProbe(
                    index=i,
                    native_dpi=m.nominal_dpi,
                    colourfulness=colourfulness(rgb),
                    seed_fraction=seed_frac,
                    photo_coverage=cov,
                    image_px=image_px,
                    page_size_in=(m.page_width_in, m.page_height_in),
                    oversized_mediabox=m.oversized_mediabox,
                    effective_dpi=m.effective_dpi,
                    ink_p05=float(ink_p05),
                    paper_p80=float(paper_p80),
                    has_text=has_text,
                    has_annots=has_annots,
                    single_fullpage_image=m.single_fullpage_image,
                )
            )

        native_dpi = _snap_dpi(statistics.median(native)) if native else 300.0
        eff_dpi = _snap_dpi(statistics.median(effective)) if effective else native_dpi
        is_oversized = oversized_count > len(idxs) / 2
        median_px = (
            (int(round(statistics.median(img_ws))), int(round(statistics.median(img_hs))))
            if img_ws and img_hs
            else None
        )
        median_in = (
            (float(statistics.median(page_ws)), float(statistics.median(page_hs)))
            if page_ws and page_hs
            else (0.0, 0.0)
        )
        paper_pages = [p for p in pages if p.paper_p80 >= 200.0]
        ink_pool = paper_pages or pages
        median_ink = float(statistics.median(p.ink_p05 for p in ink_pool)) if ink_pool else 0.0
        median_paper = float(statistics.median(p.paper_p80 for p in pages)) if pages else 255.0

        return SourceProbe(
            path=path,
            size=path.stat().st_size,
            page_count=count,
            native_dpi=native_dpi,
            has_text_layer=any(p.has_text for p in pages),
            sampled=pages,
            effective_dpi=eff_dpi,
            oversized_mediabox=is_oversized,
            median_image_px=median_px,
            median_page_size_in=median_in,
            median_ink_p05=median_ink,
            median_paper_p80=median_paper,
            annot_pages=annot_pages,
            toc_count=toc_count,
        )
    finally:
        doc.close()
