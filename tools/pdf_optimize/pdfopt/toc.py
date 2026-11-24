"""Read, validate, export-for-inspection, and write PDF bookmarks (TOC) + PageLabels.

Writing bookmarks uses ``pikepdf`` to update the document outline and
``/PageLabels`` without re-encoding a single image stream or touching OCR text.
"""

from __future__ import annotations

import os
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import pikepdf
from pikepdf import Name

from .render import open_doc
from .util import atomic_write

try:
    import pymupdf as fitz
except ImportError:  # pymupdf < 1.24 only ships the old name
    import fitz

MIN_PDF_VERSION = "1.6"

_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_CJK_NOISE_RE = re.compile(r"[\s\u3000·．.…（）()、，,;:：\-—_\"'“”‘’/\\0-9a-zA-Z]")
_LATIN_NOISE_RE = re.compile(r"[^a-z]+")
_LEADING_CHAPTER_RE = re.compile(
    r"^(?:第\s*[0-9一二三四五六七八九十百零]+\s*[章篇部分节]|(?i:Chapter|Appendix|Part|Section)\s+[0-9A-Za-zIVX]+|\d+(?:\.\d+)*|[A-Z]\.\s)\s*"
)
_GENERIC_TITLES = frozenset(
    {
        "本章小结",
        "复习思考题",
        "小结",
        "思考题",
        "习题",
        "概述",
        "引言",
        "introduction",
        "conclusion",
        "summary",
        "overview",
        "exercises",
        "problems",
        "references",
    }
)


@dataclass(frozen=True)
class TocEntry:
    level: int
    title: str
    page: int
    printed_page: int | None = None


@dataclass(frozen=True)
class TocCheck:
    checked: int
    hits: int
    hits_minus_1: int
    hits_plus_1: int
    misses: list[TocEntry] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _strip_title(title: str) -> str:
    return _LEADING_CHAPTER_RE.sub("", title.strip()).strip()


def _is_generic(title: str) -> bool:
    return title.strip().lower() in _GENERIC_TITLES or _strip_title(title).lower() in _GENERIC_TITLES


def _normalize_text(text: str, *, use_cjk: bool) -> str:
    if use_cjk:
        return _CJK_NOISE_RE.sub("", text)
    return _LATIN_NOISE_RE.sub("", text.lower())


def _clean_for_match(title: str) -> tuple[str, bool]:
    use_cjk = bool(_CJK_RE.search(title))
    min_len = 2 if use_cjk else 4
    stripped = _strip_title(title)
    core = _normalize_text(stripped, use_cjk=use_cjk)
    if len(core) >= min_len:
        return core, use_cjk
    fallback = _normalize_text(title, use_cjk=use_cjk)
    return (fallback if len(fallback) >= min_len else ""), use_cjk


def parse_toc_text(
    text: str,
    *,
    offset: int = 0,
    page_count: int | None = None,
) -> tuple[list[TocEntry], list[str]]:
    """Parse an indented TOC list into ``TocEntry`` items.

    Format per non-empty, non-``#`` line:
      ``<indent><title>[dots/spaces]<page>`` or ``<indent><title> @<abs_pdf_page>``

    Leading tabs expand to two spaces; indentation depth defines bookmark nesting.
    """
    entries: list[TocEntry] = []
    warnings: list[str] = []
    indent_stack: list[int] = []
    last_printed: int | None = None
    last_pdf_page: int | None = None

    for line_no, raw in enumerate(text.splitlines(), start=1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        expanded = raw.expandtabs(2)
        indent = len(expanded) - len(expanded.lstrip(" "))
        stripped = expanded.strip()

        m_abs = re.match(r"^(.+?)\s*@(\d+)\s*$", stripped)
        if m_abs:
            title = m_abs.group(1).rstrip(" .·…．\t")
            pdf_page = int(m_abs.group(2))
            printed_page: int | None = None
        else:
            m_rel = re.match(r"^(.+?)[\s.·…．]+(\d+)\s*$", stripped)
            if not m_rel:
                raise ValueError(
                    f"line {line_no}: expected '<title> <page>' or '<title> @<pdf_page>', got {stripped!r}"
                )
            title = m_rel.group(1).rstrip(" .·…．\t")
            printed_page = int(m_rel.group(2))
            pdf_page = printed_page + offset

        if not title:
            raise ValueError(f"line {line_no}: empty bookmark title")

        if not indent_stack:
            indent_stack.append(indent)
            level = 1
        elif indent > indent_stack[-1]:
            indent_stack.append(indent)
            level = len(indent_stack)
        else:
            while indent_stack and indent < indent_stack[-1]:
                indent_stack.pop()
            if not indent_stack or indent != indent_stack[-1]:
                raise ValueError(f"line {line_no}: inconsistent indentation ({indent} spaces)")
            level = len(indent_stack)

        if pdf_page < 1 or (page_count is not None and pdf_page > page_count):
            bound = f"1..{page_count}" if page_count is not None else ">= 1"
            raise ValueError(f"line {line_no}: target page {pdf_page} out of range ({bound}) for {title!r}")

        if printed_page is not None:
            if last_printed is not None and printed_page < last_printed:
                warnings.append(
                    f"line {line_no}: printed page {printed_page} < previous {last_printed} ({title})"
                )
            last_printed = printed_page

        if last_pdf_page is not None and pdf_page < last_pdf_page:
            warnings.append(
                f"line {line_no}: PDF page {pdf_page} < previous {last_pdf_page} ({title})"
            )
        last_pdf_page = pdf_page

        entries.append(TocEntry(level=level, title=title, page=pdf_page, printed_page=printed_page))

    if not entries:
        raise ValueError("TOC input contained no bookmark entries")
    return entries, warnings


def verify_toc_against_text(pdf_path: Path, entries: list[TocEntry]) -> TocCheck:
    """Cross-check TOC target pages (and ±1 neighbors) against extracted PDF text."""
    doc = open_doc(pdf_path)
    try:
        count = doc.page_count
        pool = [e for e in entries if e.printed_page is not None] or list(entries)
        # Prefer specific section headings (level >= 2, non-generic) to avoid false hits
        # from chapter running headers on neighboring pages.
        specific = [
            e
            for e in pool
            if e.level >= 2 and not _is_generic(e.title) and _clean_for_match(e.title)[0]
        ]
        targets = (
            specific
            if len(specific) >= 3
            else [e for e in pool if not _is_generic(e.title) and _clean_for_match(e.title)[0]]
        )

        raw_cache: dict[int, str] = {}
        norm_cache: dict[tuple[int, bool], str] = {}

        def page_clean_text(pno_1based: int, *, use_cjk: bool) -> str:
            if pno_1based < 1 or pno_1based > count:
                return ""
            key = (pno_1based, use_cjk)
            if key not in norm_cache:
                if pno_1based not in raw_cache:
                    raw_cache[pno_1based] = doc[pno_1based - 1].get_text("text")
                norm_cache[key] = _normalize_text(raw_cache[pno_1based], use_cjk=use_cjk)
            return norm_cache[key]

        # Probe whether PDF has any text layer at all
        has_any_text = any(
            page_clean_text(e.page, use_cjk=use_cjk)
            or page_clean_text(e.page - 1, use_cjk=use_cjk)
            or page_clean_text(e.page + 1, use_cjk=use_cjk)
            for e in targets[:12]
            for _, use_cjk in (_clean_for_match(e.title),)
        )
        if not targets or not has_any_text:
            return TocCheck(
                checked=0,
                hits=0,
                hits_minus_1=0,
                hits_plus_1=0,
                warnings=["no searchable text layer found on sampled target pages; OCR offset check skipped"],
            )

        hits = hits_m1 = hits_p1 = 0
        misses: list[TocEntry] = []
        for entry in targets:
            needle, use_cjk = _clean_for_match(entry.title)
            if not needle:
                continue
            if needle in page_clean_text(entry.page, use_cjk=use_cjk):
                hits += 1
            else:
                misses.append(entry)
            if needle in page_clean_text(entry.page - 1, use_cjk=use_cjk):
                hits_m1 += 1
            if needle in page_clean_text(entry.page + 1, use_cjk=use_cjk):
                hits_p1 += 1

        checked = len(targets)
        warnings: list[str] = []
        if checked >= 5 and (hits_m1 > hits or hits_p1 > hits):
            better = "offset - 1" if hits_m1 >= hits_p1 else "offset + 1"
            best_hits = max(hits_m1, hits_p1)
            warnings.append(
                f"offset suspect: {hits}/{checked} hits at given offset vs {best_hits}/{checked} at {better}"
            )
        return TocCheck(checked, hits, hits_m1, hits_p1, misses, warnings)
    finally:
        doc.close()


def export_toc_pages(
    src: Path,
    out_dir: Path,
    pages: list[int],
    *,
    dpi: float = 130.0,
) -> list[Path]:
    """Render 0-based ``pages`` to JPEGs for manual/visual TOC inspection."""
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = open_doc(src)
    written: list[Path] = []
    try:
        mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        for idx in pages:
            if idx < 0 or idx >= doc.page_count:
                continue
            pix = doc[idx].get_pixmap(matrix=mat, alpha=False)
            dst = out_dir / f"p{idx + 1:03d}.jpg"
            pix.save(dst)
            written.append(dst)
    finally:
        doc.close()
    return written


def apply_toc(
    src: Path,
    dst: Path,
    entries: list[TocEntry],
    *,
    body_start_page: int | None = None,
) -> None:
    """Write ``entries`` (and optional ``/PageLabels``) without touching image streams."""
    if not entries:
        raise ValueError("cannot apply empty TOC")

    in_place = src.resolve() == dst.resolve()
    pdf = pikepdf.open(src)
    try:
        total = len(pdf.pages)
        for entry in entries:
            if entry.page < 1 or entry.page > total:
                raise ValueError(f"bookmark page {entry.page} out of range 1..{total} ({entry.title})")

        with pdf.open_outline() as outline:
            outline.root.clear()
            stack: list[tuple[int, list]] = [(0, outline.root)]
            for entry in entries:
                item = pikepdf.OutlineItem(entry.title, entry.page - 1)
                while len(stack) > 1 and stack[-1][0] >= entry.level:
                    stack.pop()
                stack[-1][1].append(item)
                stack.append((entry.level, item.children))

        if body_start_page is not None:
            if body_start_page < 1 or body_start_page > total:
                raise ValueError(f"body_start_page {body_start_page} out of range 1..{total}")
            nums: list = []
            if body_start_page > 1:
                nums.extend([0, pikepdf.Dictionary(S=Name.r)])
            nums.extend([body_start_page - 1, pikepdf.Dictionary(S=Name.D)])
            pdf.Root.PageLabels = pdf.make_indirect(pikepdf.Dictionary(Nums=pikepdf.Array(nums)))

        if in_place:
            dst.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp_name = tempfile.mkstemp(
                prefix=dst.stem + ".", suffix=".partial" + dst.suffix, dir=dst.parent
            )
            os.close(fd)
            tmp = Path(tmp_name)
            try:
                pdf.save(
                    tmp,
                    linearize=True,
                    min_version=MIN_PDF_VERSION,
                    object_stream_mode=pikepdf.ObjectStreamMode.generate,
                )
                pdf.close()
                os.chmod(tmp, 0o644)
                os.replace(tmp, dst)
            except BaseException:
                tmp.unlink(missing_ok=True)
                raise
        else:
            atomic_write(
                dst,
                lambda tmp: pdf.save(
                    tmp,
                    linearize=True,
                    min_version=MIN_PDF_VERSION,
                    object_stream_mode=pikepdf.ObjectStreamMode.generate,
                ),
            )
    finally:
        try:
            pdf.close()
        except Exception:
            pass
