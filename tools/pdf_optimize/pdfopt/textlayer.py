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
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import pymupdf as fitz

#: Ranges where a character needs no space against its neighbour.
_CJK_RANGES = (
    (0x3000, 0x303F),  # CJK punctuation
    (0x3040, 0x30FF),  # kana
    (0x3400, 0x4DBF),  # ext A
    (0x4E00, 0x9FFF),  # unified ideographs
    (0xF900, 0xFAFF),  # compatibility ideographs
    (0xFF00, 0xFFEF),  # fullwidth forms
)


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


def join_words(words: list[Word]) -> str:
    out: list[str] = []
    for w in words:
        if out and not (is_cjk(out[-1][-1]) or is_cjk(w.text[0])):
            out.append(" ")
        out.append(w.text)
    return "".join(out)


def parse_tsv(path: Path, *, min_conf: float) -> list[Line]:
    """Group tesseract's word rows into lines."""
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
        text = join_words(ws)
        if not text.strip():
            continue
        lines.append(
            Line(
                text,
                min(w.x0 for w in ws),
                min(w.y0 for w in ws),
                max(w.x1 for w in ws),
                max(w.y1 for w in ws),
                key[0],
            )
        )
    return reading_order(lines)


def reading_order(lines: list[Line]) -> list[Line]:
    """Put blocks, and lines inside them, into the order a person would read.

    A portrait or figure in the margin makes tesseract split the page into
    several blocks and emit them in an order of its own, which lands verbatim
    in the PDF and comes back out of copy-paste scrambled. Blocks preserve
    column structure, so ordering blocks top-to-bottom then left-to-right
    fixes stacked layouts without interleaving genuine columns.
    """
    blocks: dict[int, list[Line]] = {}
    for line in lines:
        blocks.setdefault(line.block, []).append(line)
    ordered = sorted(blocks.values(), key=lambda b: (min(l.y0 for l in b), min(l.x0 for l in b)))
    return [line for block in ordered for line in sorted(block, key=lambda l: (l.y0, l.x0))]


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
    proc = subprocess.run(cmd, capture_output=True)
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


def write_lines(page: fitz.Page, lines: list[Line], dpi: float, font: fitz.Font) -> int:
    """Draw ``lines`` invisibly, one run each. Returns lines actually written."""
    if not lines:
        return 0
    scale = 72.0 / dpi
    writer = fitz.TextWriter(page.rect)
    written = 0
    for line in lines:
        text = line.text
        if not text.strip():
            continue
        width_pt = max(line.width * scale, 0.1)
        height_pt = max(line.height * scale, 0.1)
        unit = font.text_length(text, fontsize=1.0)
        if unit <= 0:
            continue
        # Match the run's width to the box we found it in, so selection
        # highlights land roughly on the glyphs underneath.
        size = min(max(width_pt / unit, 0.5), height_pt * 3.0)
        x = line.x0 * scale
        baseline = line.y1 * scale - height_pt * 0.18
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
