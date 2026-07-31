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
    #: jbig2enc 1bpp threshold; raise for faint scans to get fuller strokes.
    bw_threshold: int = 200
    keep_patch_color: bool = True
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
