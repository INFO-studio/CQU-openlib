"""Build the invisible, searchable text layer ourselves.

Handing the job to ocrmypdf gives a layer where every OCR *word* is a
separately positioned run. PDF text extractors turn the gaps between those
runs into spaces, so Chinese comes back as "浙 江 大 学 医学 院" — searching
for 泌尿系统 then misses ~40% of its real occurrences. The spaces aren't in
the OCR output; they're inferred from geometry.

Since this tool assembles the PDF anyway, it lays the text down itself: one
contiguous run per recognised line, scaled to that line's box. Search and
copy come out clean, and CJK words join without separators while Latin words
keep theirs.
"""

from __future__ import annotations

import csv
import os
import statistics
import subprocess
from dataclasses import dataclass
from pathlib import Path

import pymupdf as fitz

#: Ranges where a character needs no space against its neighbour.
_CJK_RANGES = (
    (0x2000, 0x206F),  # General punctuation (em-dash, ellipsis, curly quotes)
    (0x3000, 0x303F),  # CJK punctuation
    (0x3040, 0x30FF),  # kana
    (0x3400, 0x4DBF),  # ext A
    (0x4E00, 0x9FFF),  # unified ideographs
    (0xF900, 0xFAFF),  # compatibility ideographs
    (0xFF00, 0xFFEF),  # fullwidth forms
    (0x20000, 0x2FA1F),  # ext B..F and compatibility supplement
)

_COMPACT_CHARS = set("0123456789.,-%/+-=×·")
_CLOSING_PUNCT = set(".,;:!?%)]}、。，；：！？）】》")
_OPENING_PUNCT = set("([{\"‘“（【《")


def is_cjk(ch: str) -> bool:
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in _CJK_RANGES)


@dataclass
class Word:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    conf: float


@dataclass
class Line:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    block: int = 0

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0


def _no_space_between(prev: Word, curr: Word) -> bool:
    p_ch = prev.text[-1]
    c_ch = curr.text[0]
    if is_cjk(p_ch) or is_cjk(c_ch):
        return True
    gap = curr.x0 - prev.x1
    h = max(min(prev.y1 - prev.y0, curr.y1 - curr.y0), 1.0)
    if gap < 0.28 * h:
        if p_ch in _COMPACT_CHARS and c_ch in _COMPACT_CHARS:
            return True
        if c_ch in _CLOSING_PUNCT or p_ch in _OPENING_PUNCT:
            return True
    return False


def join_words(words: list[Word]) -> str:
    out: list[str] = []
    prev: Word | None = None
    for w in words:
        if prev is not None and not _no_space_between(prev, w):
            out.append(" ")
        out.append(w.text)
        prev = w
    return "".join(out)


def _split_wide_gaps(words: list[Word]) -> list[list[Word]]:
    """Split a TSV line across wide horizontal gaps (dropped dot leaders / columns)."""
    if len(words) <= 1:
        return [words] if words else []
    median_h = statistics.median(max(w.y1 - w.y0, 1.0) for w in words)
    split_gap = max(3.5 * median_h, 60.0)
    segments: list[list[Word]] = [[words[0]]]
    for w in words[1:]:
        if w.x0 - segments[-1][-1].x1 > split_gap:
            segments.append([w])
        else:
            segments[-1].append(w)
    return segments


def parse_tsv(path: Path, *, min_conf: float) -> list[Line]:
    """Group tesseract's word rows into lines, splitting across wide blank gaps."""
    groups: dict[tuple[int, int, int], list[Word]] = {}
    order: list[tuple[int, int, int]] = []
    with path.open(newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            if row.get("level") != "5":
                continue
            text = (row.get("text") or "").strip()
            if not text:
                continue
            try:
                conf = float(row["conf"])
                left, top = float(row["left"]), float(row["top"])
                width, height = float(row["width"]), float(row["height"])
            except (KeyError, TypeError, ValueError):
                continue
            if conf < min_conf:
                continue
            key = (int(row["block_num"]), int(row["par_num"]), int(row["line_num"]))
            if key not in groups:
                groups[key] = []
                order.append(key)
            groups[key].append(Word(text, left, top, left + width, top + height, conf))

    lines: list[Line] = []
    for key in order:
        ws = sorted(groups[key], key=lambda w: w.x0)
        for seg in _split_wide_gaps(ws):
            text = join_words(seg)
            if not text.strip():
                continue
            lines.append(
                Line(
                    text,
                    min(w.x0 for w in seg),
                    min(w.y0 for w in seg),
                    max(w.x1 for w in seg),
                    max(w.y1 for w in seg),
                    key[0],
                )
            )
    return reading_order(lines)


def _sort_lines_in_band(lines: list[Line]) -> list[Line]:
    """Sort lines top-to-bottom, treating same-row skewed segments left-to-right."""
    if len(lines) <= 1:
        return list(lines)
    by_cy = sorted(lines, key=lambda l: ((l.y0 + l.y1) / 2.0, l.x0))
    bands: list[list[Line]] = [[by_cy[0]]]
    for ln in by_cy[1:]:
        cur = bands[-1]
        band_cy = sum((x.y0 + x.y1) / 2.0 for x in cur) / len(cur)
        band_h = max(statistics.median(max(x.height, 1.0) for x in cur), 1.0)
        ln_cy = (ln.y0 + ln.y1) / 2.0
        if abs(ln_cy - band_cy) <= 0.55 * band_h:
            cur.append(ln)
        else:
            bands.append([ln])
    return [ln for band in bands for ln in sorted(band, key=lambda x: x.x0)]


def _order_blocks(block_items: list[tuple[float, float, float, float, list[Line]]]) -> list[Line]:
    if len(block_items) <= 1:
        return [ln for _, _, _, _, ls in block_items for ln in ls]

    # Peel off any full-width header blocks strictly above the rest, then check
    # whether the remaining blocks form two clean, vertically overlapping columns.
    by_top = sorted(block_items, key=lambda b: (b[1], b[0]))
    xs_ends = sorted({b[2] for b in by_top})
    best_split: tuple[float, list, list] | None = None
    for x_split in xs_ends:
        left = [b for b in by_top if b[2] <= x_split]
        right = [b for b in by_top if b[0] >= x_split]
        if len(left) + len(right) != len(by_top) or not left or not right:
            continue
        left_lines = sum(len(b[4]) for b in left)
        right_lines = sum(len(b[4]) for b in right)
        if left_lines < 2 or right_lines < 2:
            continue
        ly0, ly1 = min(b[1] for b in left), max(b[3] for b in left)
        ry0, ry1 = min(b[1] for b in right), max(b[3] for b in right)
        if min(ly1, ry1) > max(ly0, ry0):
            best_split = (x_split, left, right)
            break

    if best_split is not None:
        _, left, right = best_split
        return _order_blocks(left) + _order_blocks(right)

    # Single-column or mixed layout: group blocks with close top edges into rows.
    median_h = statistics.median(max(ln.height, 1.0) for b in by_top for ln in b[4])
    rows: list[list[tuple[float, float, float, float, list[Line]]]] = [[by_top[0]]]
    for blk in by_top[1:]:
        row_y = min(b[1] for b in rows[-1])
        if abs(blk[1] - row_y) <= 0.6 * median_h:
            rows[-1].append(blk)
        else:
            rows.append([blk])
    ordered: list[Line] = []
    for row in rows:
        for blk in sorted(row, key=lambda b: b[0]):
            ordered.extend(blk[4])
    return ordered


def reading_order(lines: list[Line]) -> list[Line]:
    """Put blocks, and lines inside them, into human reading order."""
    if not lines:
        return []
    blocks: dict[int, list[Line]] = {}
    for line in lines:
        blocks.setdefault(line.block, []).append(line)

    block_items = []
    for blines in blocks.values():
        sorted_blines = _sort_lines_in_band(blines)
        block_items.append(
            (
                min(l.x0 for l in sorted_blines),
                min(l.y0 for l in sorted_blines),
                max(l.x1 for l in sorted_blines),
                max(l.y1 for l in sorted_blines),
                sorted_blines,
            )
        )
    return _order_blocks(block_items)


def ocr_image(
    image: Path,
    *,
    langs: str,
    tessdata_dir: Path | None,
    psm: int | None,
    min_conf: float,
    scratch: Path,
) -> list[Line]:
    base = scratch / "ocr"
    cmd = ["tesseract", str(image), str(base), "-l", langs]
    if tessdata_dir:
        cmd += ["--tessdata-dir", str(tessdata_dir)]
    if psm is not None:
        cmd += ["--psm", str(psm)]
    cmd.append("tsv")
    env = {**os.environ, "OMP_THREAD_LIMIT": "1"}
    proc = subprocess.run(cmd, capture_output=True, env=env)
    stderr = proc.stderr.decode(errors="replace")
    tsv = base.with_suffix(".tsv")
    # tesseract exits 0 even when a language (or a sub-language such as
    # chi_sim_vert) fails to load, and then simply recognises nothing. Treat
    # that as the error it is instead of silently shipping an empty layer.
    if proc.returncode != 0 or not tsv.exists() or "Failed loading" in stderr:
        raise RuntimeError(f"tesseract failed: {stderr.strip()[:300] or 'no output'}")
    try:
        return parse_tsv(tsv, min_conf=min_conf)
    finally:
        tsv.unlink(missing_ok=True)


# --------------------------------------------------------------------------


def _bmp_only(text: str) -> str:
    """Filter non-BMP codepoints (PyMuPDF's CJK CID fonts emit \\x00 for them)."""
    return "".join(ch for ch in text if ord(ch) <= 0xFFFF)


def write_lines(
    page: fitz.Page,
    lines: list[Line],
    dpi: float,
    font: fitz.Font,
    *,
    img_size: tuple[int, int] | None = None,
) -> int:
    """Draw ``lines`` invisibly, one run each. Returns lines actually written."""
    if not lines:
        return 0
    if img_size is not None and img_size[0] > 0 and img_size[1] > 0:
        sx = page.rect.width / img_size[0]
        sy = page.rect.height / img_size[1]
    else:
        sx = sy = 72.0 / dpi
    writer = fitz.TextWriter(page.rect)
    written = 0
    for line in lines:
        text = _bmp_only(line.text)
        if not text.strip():
            continue
        width_pt = max(line.width * sx, 0.1)
        height_pt = max(line.height * sy, 0.1)
        unit = font.text_length(text, fontsize=1.0)
        if unit <= 0:
            continue
        # Match the run's width to its box while capping fontsize to line height
        # so sparse lines never inflate selection rectangles across neighbours.
        size = min(max(width_pt / unit, 0.5), height_pt * 1.35)
        x = line.x0 * sx
        baseline = line.y1 * sy - height_pt * 0.18
        try:
            writer.append(fitz.Point(x, baseline), text, font=font, fontsize=size)
        except Exception:
            continue  # a glyph the font can't map; drop that line, keep the page
        written += 1
    if written:
        writer.write_text(page, render_mode=3)  # 3 = render nothing, still selectable
    return written


def cjk_font() -> fitz.Font:
    return fitz.Font("china-s")
