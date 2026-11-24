"""Small shared helpers."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def human(n: float) -> str:
    n = float(n)
    if n >= 1048576:
        return f"{n / 1048576:.1f}MB"
    if n >= 1024:
        return f"{n / 1024:.0f}KB"
    return f"{n:.0f}B"


def mb(n: float) -> float:
    return n / 1048576


def have(tool: str) -> bool:
    return shutil.which(tool) is not None


def run(cmd: list[str], *, log: Path | None = None) -> subprocess.CompletedProcess:
    if log is None:
        return subprocess.run(cmd, capture_output=True)
    with log.open("ab") as lf:
        lf.write(b"$ " + " ".join(cmd).encode() + b"\n")
        return subprocess.run(cmd, stdout=lf, stderr=subprocess.STDOUT)


def atomic_write(dst: Path, write) -> None:
    """Write via a temp file next to dst, then rename.

    An interrupted run leaves a *.partial file, never a half-written dst —
    which is how you end up with a "damaged" PDF that opens in nothing.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=dst.stem + ".", suffix=".partial" + dst.suffix, dir=dst.parent)
    os.close(fd)
    tmp = Path(name)
    try:
        write(tmp)
        os.chmod(tmp, 0o644)  # mkstemp gives 0600, which breaks sharing/serving
        os.replace(tmp, dst)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def copy_atomic(src: Path, dst: Path) -> None:
    if src.resolve() == dst.resolve():
        return
    atomic_write(dst, lambda tmp: shutil.copyfile(src, tmp))


def copy_pdf_metadata(
    src_path: Path,
    dst_pdf,
    *,
    page_indices: list[int] | None = None,
    fallback_title: str | None = None,
) -> None:
    """Copy bookmarks (with subset remapping), PageLabels, and DocInfo onto a pikepdf.Pdf."""
    import pikepdf

    from .render import open_doc

    src_doc = open_doc(src_path)
    try:
        src_count = src_doc.page_count
        toc = src_doc.get_toc(simple=True)
    finally:
        src_doc.close()

    full_doc = page_indices is None or (
        len(page_indices) == src_count and page_indices == list(range(src_count))
    )
    page_map = None if full_doc else {old_idx: new_idx for new_idx, old_idx in enumerate(page_indices)}

    if toc and len(dst_pdf.pages) > 0:
        entries: list[tuple[int, str, int]] = []
        for level, title, pno in toc:
            old_idx = int(pno) - 1
            if page_map is not None:
                if old_idx not in page_map:
                    continue
                target_idx = page_map[old_idx]
            else:
                target_idx = max(0, min(old_idx, len(dst_pdf.pages) - 1))
            entries.append((max(1, int(level)), str(title), target_idx))
        if entries:
            with dst_pdf.open_outline() as outline:
                stack: list[tuple[int, list]] = [(0, outline.root)]
                for level, title, target_idx in entries:
                    item = pikepdf.OutlineItem(title, target_idx)
                    while len(stack) > 1 and stack[-1][0] >= level:
                        stack.pop()
                    stack[-1][1].append(item)
                    stack.append((level, item.children))

    with pikepdf.open(src_path) as spdf:
        if full_doc and "/PageLabels" in spdf.Root:
            pl = spdf.Root.PageLabels
            dst_pdf.Root.PageLabels = dst_pdf.copy_foreign(
                pl if pl.is_indirect else spdf.make_indirect(pl)
            )
        for key in ("/Title", "/Author", "/Subject", "/Keywords", "/Creator", "/Producer"):
            if key in spdf.docinfo:
                dst_pdf.docinfo[key] = str(spdf.docinfo[key])

    if fallback_title and "/Title" not in dst_pdf.docinfo:
        dst_pdf.docinfo["/Title"] = fallback_title

    title_val = str(dst_pdf.docinfo["/Title"]) if "/Title" in dst_pdf.docinfo else fallback_title
    if title_val:
        with dst_pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
            if not meta.get("dc:title"):
                meta["dc:title"] = title_val
