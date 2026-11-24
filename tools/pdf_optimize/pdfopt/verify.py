"""Check that an output PDF actually opens, respects filter versions, and decodes."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import pikepdf
from pikepdf import Name

from .probe import sample_indices
from .render import open_doc
from .util import have, run

try:
    import pymupdf as fitz
except ImportError:
    import fitz


def _parse_version(ver: str) -> tuple[int, int]:
    try:
        a, b = ver.split(".", 1)
        return int(a), int(b)
    except Exception:
        return (1, 0)


def _check_filter_versions(pdf: pikepdf.Pdf) -> str:
    ver = _parse_version(pdf.pdf_version)
    needs_14 = False
    needs_15 = False
    for page in pdf.pages:
        res = page.get("/Resources")
        if res is None and hasattr(page, "Resources"):
            res = page.Resources
        xobjs = res.get("/XObject") if res is not None else None
        if not xobjs:
            continue
        for obj in xobjs.values():
            if not hasattr(obj, "get") or obj.get("/Subtype") != Name.Image:
                continue
            flt = obj.get("/Filter")
            filters = list(flt) if isinstance(flt, pikepdf.Array) else ([flt] if flt is not None else [])
            for f in filters:
                if f == Name.JBIG2Decode:
                    needs_14 = True
                elif f == Name.JPXDecode:
                    needs_15 = True
    if needs_15 and ver < (1, 5):
        return f"PDF {pdf.pdf_version} < 1.5 required for /JPXDecode"
    if needs_14 and ver < (1, 4):
        return f"PDF {pdf.pdf_version} < 1.4 required for /JBIG2Decode"
    return ""


@dataclass
class Report:
    path: Path
    ok: bool
    page_count: int
    pdf_version: str
    failed_pages: list[int] = field(default_factory=list)
    blank_pages: list[int] = field(default_factory=list)
    structural: str = ""
    warnings: list[str] = field(default_factory=list)

    def summary(self) -> str:
        bits = [f"{self.page_count} pages", f"PDF {self.pdf_version}"]
        if self.failed_pages:
            bits.append(f"{len(self.failed_pages)} pages failed to decode")
        if self.blank_pages:
            bits.append(f"{len(self.blank_pages)} blank pages")
        if self.structural:
            bits.append(self.structural)
        if self.warnings:
            bits.append(f"{len(self.warnings)} warning(s)")
        return ", ".join(bits)


def verify(
    path: Path,
    *,
    expect_pages: int | None = None,
    deep: bool = True,
    expect_text: bool = False,
) -> Report:
    warnings: list[str] = []
    structural = ""
    try:
        with pikepdf.open(path) as pdf:
            version = pdf.pdf_version
            structural = _check_filter_versions(pdf)
    except Exception as exc:
        return Report(path, False, 0, "?", structural=f"failed to open: {exc}")

    if have("qpdf"):
        proc = run(["qpdf", "--check", str(path)])
        stderr_lines = [
            ln.strip()
            for ln in proc.stderr.decode(errors="replace").splitlines()
            if ln.strip()
        ]
        if proc.returncode == 3:
            warnings.extend(stderr_lines[:5] or ["qpdf reported warnings"])
        elif proc.returncode != 0:
            err_msg = "; ".join(stderr_lines[:3]) if stderr_lines else "qpdf reported problems"
            structural = f"{structural}; {err_msg}" if structural else err_msg
    else:
        warnings.append("qpdf not installed; structural check skipped")

    try:
        doc = open_doc(path)
    except Exception as exc:
        return Report(
            path,
            False,
            0,
            version,
            structural=f"{structural}; pymupdf open failed: {exc}" if structural else f"pymupdf open failed: {exc}",
            warnings=warnings,
        )

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
        if expect_text and count > 0:
            sample_idxs = sample_indices(count, min(count, 16))
            if not any(doc[i].get_text("text").strip() for i in sample_idxs):
                warnings.append("expected OCR text layer, but sampled pages contained no text")
    finally:
        doc.close()

    ok = not failed and not structural and (expect_pages is None or count == expect_pages)
    return Report(path, ok, count, version, failed, blank, structural, warnings)
