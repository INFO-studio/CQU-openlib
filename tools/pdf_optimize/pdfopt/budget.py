"""Pick parameters that land under a size budget.

A full pass over a 600-page book is cheap enough to do once, but not once per
candidate setting. So estimate from a stratified sample, then run for real.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .config import LADDER_MRC, LADDER_PAGE, Mode, Params
from .encode import encode_page, scratch_dir
from .probe import sample_indices
from .render import open_doc
from .util import human

#: Just PDF object overhead. Deliberately *not* padded for sampling error:
#: a sample of a mixed book runs heavy (photo pages are over-represented by
#: area), and padding on top of that throws away photo quality for nothing.
#: The pipeline measures the real size after encoding and steps down if it
#: has to, so the plan only needs to be a good starting point.
ESTIMATE_MARGIN = 1.02


@dataclass
class Estimate:
    params: Params
    bytes_per_page: float
    total_bytes: float

    def fits(self, budget: int) -> bool:
        return self.total_bytes <= budget


@dataclass
class Plan:
    params: Params
    rung: int
    estimate: Estimate


def estimate(src: Path, params: Params, page_count: int, *, samples: int = 28) -> Estimate:
    doc = open_doc(src)
    scratch = scratch_dir()
    try:
        idxs = sample_indices(page_count, samples)
        total = sum(encode_page(doc, i, params, scratch).nbytes for i in idxs)
        per_page = total / max(len(idxs), 1)
    finally:
        doc.close()
    return Estimate(params, per_page, per_page * page_count * ESTIMATE_MARGIN)


def ladder_for(mode: Mode) -> list[dict]:
    if mode is Mode.MRC:
        return LADDER_MRC
    if mode in (Mode.GRAY, Mode.COLOR):
        return LADDER_PAGE
    return [{}]  # BILEVEL has nothing to trade


def solve(
    src: Path,
    params: Params,
    page_count: int,
    budget: int,
    *,
    samples: int = 14,
    on_step=None,
) -> Plan:
    """Walk the mode's ladder until the estimate fits, giving up photo
    fidelity before page DPI. Falls back to the last (smallest) rung so the
    caller can decide whether to proceed."""
    rungs = ladder_for(params.mode)
    last: Plan | None = None
    for i, rung in enumerate(rungs):
        candidate = apply_rung(params, rung)
        est = estimate(src, candidate, page_count, samples=samples)
        if on_step:
            on_step(candidate, est)
        last = Plan(candidate, i, est)
        if est.fits(budget):
            return last
    assert last is not None
    return last


def apply_rung(params: Params, rung: dict) -> Params:
    return params.replace(**rung) if rung else params


def describe(params: Params) -> str:
    if params.mode is Mode.MRC:
        return (
            f"{params.dpi:g}dpi text / {params.photo_dpi:g}dpi photos q{params.photo_quality}"
        )
    if params.mode in (Mode.GRAY, Mode.COLOR):
        return f"{(params.page_dpi or params.dpi):g}dpi page q{params.page_quality}"
    return f"{params.dpi:g}dpi bilevel"


def format_estimate(est: Estimate) -> str:
    return f"{human(est.bytes_per_page)}/page → est {human(est.total_bytes)}"
