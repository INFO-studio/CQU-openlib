"""Check that an output PDF actually opens and every page decodes."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import pikepdf

from .render import open_doc
from .util import have, run

try:
    import pymupdf as fitz
except ImportError:
    import fitz


@dataclass
class Report:
    path: Path
    ok: bool
    page_count: int
    pdf_version: str
    failed_pages: list[int] = field(default_factory=list)
    blank_pages: list[int] = field(default_factory=list)
    structural: str = ""

    def summary(self) -> str:
        bits = [f"{self.page_count} pages", f"PDF {self.pdf_version}"]
        if self.failed_pages:
            bits.append(f"{len(self.failed_pages)} pages failed to decode")
        if self.blank_pages:
            bits.append(f"{len(self.blank_pages)} blank pages")
        if self.structural:
            bits.append(self.structural)
        return ", ".join(bits)


def verify(path: Path, *, expect_pages: int | None = None, deep: bool = True) -> Report:
    with pikepdf.open(path) as pdf:
        version = pdf.pdf_version
    structural = ""
    if have("qpdf"):
        proc = run(["qpdf", "--check", str(path)])
        if proc.returncode != 0:
            structural = "qpdf reported problems"

    doc = open_doc(path)
    failed: list[int] = []
    blank: list[int] = []
    try:
        count = doc.page_count
        if deep:
            for i in range(count):
                try:
                    pix = doc[i].get_pixmap(matrix=fitz.Matrix(0.2, 0.2))
                except Exception:
                    failed.append(i)
                    continue
                samples = pix.samples
                if samples and samples.count(255) == len(samples):
                    blank.append(i)
    finally:
        doc.close()

    ok = not failed and not structural and (expect_pages is None or count == expect_pages)
    return Report(path, ok, count, version, failed, blank, structural)
