"""Modes and tunable parameters.

Everything the pipeline's output depends on lives here, so the cache key can
be derived from it and so there's exactly one place to change a default.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
from dataclasses import dataclass, field
from enum import Enum


class Mode(str, Enum):
    #: Pick per document from a probe. Safe default.
    AUTO = "auto"
    #: 1-bit JBIG2 text layer + continuous-tone patches placed on top.
    #: Best for printed scans. Binarizes, so opt in knowingly.
    MRC = "mrc"
    #: Whole page 1-bit JBIG2. Smallest; destroys every photo.
    BILEVEL = "bilevel"
    #: Whole page grayscale JPEG. No binarization at all.
    GRAY = "gray"
    #: Whole page colour JPEG. Most faithful, largest.
    COLOR = "color"

    def binarizes(self) -> bool:
        return self in (Mode.MRC, Mode.BILEVEL)


@dataclass(frozen=True)
class Detect:
    """Continuous-tone region detection.

    Printed text sits on paper: a text block is mostly paper-white with a
    little ink. A photo block has almost no paper-white anywhere in it —
    including its near-black parts, which a "midtone" test misses entirely
    (dark hair in a portrait scores 0.01 midtone but 0.12 paper-white).
    So paper-white fraction is the discriminator, seeded strictly and then
    grown over contiguous non-paper blocks to pick up a whole photo.
    """

    block_in: float = 0.08  # detector block size, inches
    seed_white: float = 0.25  # block is definitely continuous-tone below this
    grow_white: float = 0.60  # region grows across blocks below this
    seed_mid: float = 0.30  # or: clearly a gradient
    white_level: int = 235  # >= this (normalized) counts as paper
    min_side_in: float = 0.32  # reject thin bars (headings, rules)
    min_area_in2: float = 0.25
    min_fill: float = 0.40  # reject sprawling L-shaped bounding boxes
    pad_in: float = 0.05  # keep anti-aliased figure edges out of the text layer

    #: Optional: also seed on flat low-contrast areas, i.e. pale tints and
    #: watermarks, which otherwise binarize into speckle. Off by default —
    #: on text pages this also fires on 2-4% of blocks holding a single thin
    #: stroke, and a false positive means real text gets JPEGed. Turn it on
    #: for documents with tinted sidebars or a background logo.
    seed_flat_std: float = 0.0  # 0 disables; try 6.0
    seed_flat_max_std: float = 28.0
    seed_flat_max_mean: float = 250.0


@dataclass(frozen=True)
class Bilevel:
    """How the text layer becomes 1 bit.

    One cut level for the whole page cannot tell a faint stroke from the soft
    halo a scanner leaves around a dark one. Put it low enough to drop the
    halo and thin strokes disappear; high enough to keep them and dense
    glyphs fill in — which is how a page ends up higher in contrast but
    harder to read than the greyscale it came from. Sauvola compares each
    pixel with the mean and contrast of its own neighbourhood instead, so one
    setting holds across a faint page and a dark one.
    """

    #: Never threshold below this. At the scan's own 150dpi a stroke 1.5px
    #: wide has to land on 1px or 2px, and grain flips whatever sits near the
    #: cut, so thin strokes break and dense ones merge. Resampling up first
    #: thresholds the same information on a grid fine enough to record where
    #: the edge actually is; it invents nothing.
    min_dpi: float = 300.0
    #: Gaussian sigma, in *source* pixels, applied after resampling. Removes
    #: the stair-stepping the resample introduces and the grain that would
    #: otherwise speckle. Stays well under one stroke width.
    smooth: float = 0.3
    #: Sauvola window, inches — roughly one glyph across.
    window_in: float = 0.10
    #: Sauvola k. Higher is stricter, i.e. thinner strokes.
    k: float = 0.2
    #: Escape hatch: a fixed cut level for the whole page instead of Sauvola.
    global_threshold: int | None = None


@dataclass(frozen=True)
class Tone:
    """Optional: pull a faint scan's paper to white and its ink towards black.

    Keeping a page greyscale keeps the anti-aliasing that tells a reader
    where a stroke edge is, which is why it reads better than any
    thresholding of the same scan. What it also keeps is the scan's own
    exposure — a book photographed slightly hot arrives legible but washed
    out, ink sitting around 150 instead of 30.

    Fixing that is a tone curve, not a threshold: every input level still
    maps to a distinct output level, so nothing merges and no stroke can be
    cut. The anchors have to be measured per page, though. A fixed curve
    overshoots the pale pages and does nothing for the dark ones, and it
    amplifies the halo around dense text into JPEG-visible mush — which is
    also where the bytes go, so guessing costs size as well as looks.
    """

    #: 0 off, 1 maps the measured ink and paper levels all the way to 0/255.
    #: Blended with identity below 1, so this reads as "how much of the way".
    strength: float = 0.0
    #: Drop everything fainter than this fraction of the way from paper to
    #: ink, i.e. flatten it to white. Aimed at show-through — the mirrored
    #: ghost of the next page's type, which is real ink but not *this*
    #: page's. Expanding contrast expands it too, so a faint book gets
    #: dirtier as it gets darker unless this is set with it.
    #:
    #: A fraction of the *measured* range rather than a grey level, because
    #: the two populations are only separable relative to each other: on the
    #: preface page of 新能源材料与器件 show-through bottoms out at 240 while
    #: real strokes reach 130, so 0.2 of the way down (235) erases 99.9% of
    #: the ghost and costs only the outermost halo pixel of real type.
    #: Independent of ``strength`` on purpose — a page can need cleaning
    #: without needing deepening.
    showthrough: float = 0.0
    #: Percentile taken to *be* the paper. On a text page paper is the large
    #: majority of pixels, so anything comfortably inside that mass works;
    #: taking a percentile rather than the maximum ignores specular flecks.
    #: Everything above it clips to pure white, which flattens the grain and
    #: is why a stronger curve can encode *smaller* than the original.
    paper_pct: float = 80.0
    #: Percentile taken to be the ink core, ignoring the darkest specks.
    ink_pct: float = 0.5
    #: Leave the page alone unless the measured paper is at least this
    #: bright. A photo or a full-bleed cover has no paper level to speak of;
    #: its 80th percentile is some mid-tone, and stretching from there would
    #: blow out the highlights of an image that was exposed correctly.
    min_paper: float = 200.0
    #: Likewise skip when ink and paper are already this close together:
    #: there is no faintness to correct, only noise to magnify.
    min_range: float = 32.0


@dataclass(frozen=True)
class Params:
    mode: Mode = Mode.AUTO
    #: Text/page raster DPI. Keep at the scan's native DPI; this is the one
    #: knob that directly trades away legibility.
    dpi: float | None = None
    #: Continuous-tone patches (MRC) — reduce these before touching dpi.
    photo_dpi: float = 150.0
    photo_quality: int = 72
    #: Whole-page JPEG (GRAY/COLOR modes).
    page_dpi: float | None = None
    page_quality: int = 72
    keep_patch_color: bool = True
    bilevel: Bilevel = field(default_factory=Bilevel)
    tone: Tone = field(default_factory=Tone)
    detect: Detect = field(default_factory=Detect)

    def replace(self, **kw) -> Params:
        return dataclasses.replace(self, **kw)

    def fingerprint(self) -> str:
        blob = json.dumps(dataclasses.asdict(self), sort_keys=True, default=str)
        return hashlib.sha256(blob.encode()).hexdigest()[:12]


#: Order in which the budget solver is allowed to give things up. Photo
#: fidelity goes first; text DPI is last, and never below ``dpi_floor``.
LADDER_MRC = [
    {"photo_dpi": 150, "photo_quality": 72},
    {"photo_dpi": 130, "photo_quality": 68},
    {"photo_dpi": 120, "photo_quality": 62},
    {"photo_dpi": 100, "photo_quality": 58},
    {"photo_dpi": 90, "photo_quality": 52},
    {"photo_dpi": 75, "photo_quality": 45},
]

LADDER_PAGE = [
    {"page_dpi": 300, "page_quality": 75},
    {"page_dpi": 250, "page_quality": 70},
    {"page_dpi": 200, "page_quality": 68},
    {"page_dpi": 175, "page_quality": 62},
    {"page_dpi": 150, "page_quality": 58},
    {"page_dpi": 120, "page_quality": 52},
]
