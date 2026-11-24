"""Pick parameters that land under a size budget.

A full pass over a 600-page book is cheap enough to do once, but not once per
candidate setting. So estimate from a stratified sample, then run for real.
"""

from __future__ import annotations

import dataclasses
import shutil
from dataclasses import dataclass, field
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
    candidates: list[Params] = field(default_factory=list)


def estimate(
    src: Path,
    params: Params,
    pages: list[int] | int,
    *,
    samples: int = 28,
) -> Estimate:
    page_list = list(range(pages)) if isinstance(pages, int) else list(pages)
    page_count = len(page_list)
    if page_count == 0:
        return Estimate(params, 0.0, 0.0)

    doc = open_doc(src)
    scratch = scratch_dir()
    try:
        idxs = [page_list[i] for i in sample_indices(page_count, samples)]
        total = sum(encode_page(doc, i, params, scratch).nbytes for i in idxs)
        per_page = total / max(len(idxs), 1)
    finally:
        doc.close()
        shutil.rmtree(scratch, ignore_errors=True)
    return Estimate(params, per_page, per_page * page_count * ESTIMATE_MARGIN)


def ladder_for(mode: Mode) -> list[dict]:
    if mode is Mode.MRC:
        return LADDER_MRC
    if mode in (Mode.GRAY, Mode.COLOR):
        return LADDER_PAGE
    return [{}]  # BILEVEL has nothing to trade


def build_candidates(
    params: Params,
    *,
    locked_fields: set[str] | None = None,
    native_dpi: float | None = None,
) -> list[Params]:
    """Build ordered, deduplicated candidates honouring user overrides and native DPI."""
    locked = locked_fields or set()
    candidates: list[Params] = [params]
    seen: set[str] = {params.fingerprint()}

    dpi_scale = params.dpi_scale if params.dpi_scale > 0 else 1.0
    base_render_dpi = native_dpi or params.dpi or 300.0
    phys_native = base_render_dpi * dpi_scale

    for rung in ladder_for(params.mode):
        if not rung:
            continue
        patch: dict = {}
        for k, v in rung.items():
            if k in locked:
                continue
            if k in ("dpi", "page_dpi") and "dpi" in locked:
                continue
            if k == "page_dpi" and "page_dpi" in locked:
                continue

            if k == "photo_dpi":
                clamped = min(float(v), phys_native, float(params.photo_dpi))
                patch[k] = round(clamped, 2)
            elif k == "photo_quality":
                patch[k] = min(int(v), int(params.photo_quality))
            elif k == "dpi":
                target_phys = min(float(v), phys_native)
                cur_phys = (params.dpi or base_render_dpi) * dpi_scale
                target_phys = min(target_phys, cur_phys)
                patch[k] = round(target_phys / dpi_scale, 3)
                if (
                    target_phys < cur_phys
                    and "bilevel_min_dpi" not in locked
                    and params.bilevel.min_dpi > target_phys
                ):
                    patch["bilevel"] = dataclasses.replace(params.bilevel, min_dpi=target_phys)
            elif k == "page_dpi":
                target_phys = min(float(v), phys_native)
                cur_phys = (params.page_dpi or params.dpi or base_render_dpi) * dpi_scale
                target_phys = min(target_phys, cur_phys)
                patch[k] = round(target_phys / dpi_scale, 3)
            elif k == "page_quality":
                patch[k] = min(int(v), int(params.page_quality))
            else:
                patch[k] = v

        if not patch:
            continue
        cand = params.replace(**patch)
        fp = cand.fingerprint()
        if fp not in seen:
            seen.add(fp)
            candidates.append(cand)
    return candidates


def solve(
    src: Path,
    params: Params,
    pages: list[int] | int,
    budget: int,
    *,
    samples: int = 14,
    on_step=None,
    locked_fields: set[str] | None = None,
    native_dpi: float | None = None,
) -> Plan:
    """Walk candidates until the estimate fits, keeping user locks and native DPI."""
    candidates = build_candidates(params, locked_fields=locked_fields, native_dpi=native_dpi)
    last: Plan | None = None
    for i, candidate in enumerate(candidates):
        est = estimate(src, candidate, pages, samples=samples)
        if on_step:
            on_step(candidate, est)
        last = Plan(candidate, i, est, candidates)
        if est.fits(budget):
            return last
    assert last is not None
    return last


def apply_rung(params: Params, rung: dict) -> Params:
    return params.replace(**rung) if rung else params


def text_dpi(params: Params) -> str:
    """Physical text DPI, and the DPI it is thresholded at when those differ."""
    dpi = (params.dpi or 0.0) * params.dpi_scale
    threshold_at = max(dpi, params.bilevel.min_dpi)
    if threshold_at > dpi + 0.5:
        return f"{dpi:g}→{threshold_at:g}dpi"
    return f"{dpi:g}dpi"


def describe(params: Params) -> str:
    tone = f" +{params.tone.strength * 100:g}% contrast" if params.tone.strength > 0 else ""
    if params.tone.showthrough > 0:
        tone += f" −{params.tone.showthrough * 100:g}% show-through"
    if params.mode is Mode.MRC:
        return (
            f"{text_dpi(params)} text / {params.photo_dpi:g}dpi photos "
            f"q{params.photo_quality}{tone}"
        )
    if params.mode in (Mode.GRAY, Mode.COLOR):
        eff = (params.page_dpi or params.dpi or 0.0) * params.dpi_scale
        return f"{eff:g}dpi page q{params.page_quality}{tone}"
    return f"{text_dpi(params)} bilevel{tone}"


def format_estimate(est: Estimate) -> str:
    return f"{human(est.bytes_per_page)}/page → est {human(est.total_bytes)}"
