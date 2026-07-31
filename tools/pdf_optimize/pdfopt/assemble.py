"""Build a PDF out of encoded page layers."""

from __future__ import annotations

from pathlib import Path

import pikepdf
from pikepdf import Name

from .encode import Layer, Page
from .util import atomic_write

#: JBIG2Decode arrived in PDF 1.4. Declaring an older version while using it
#: makes strict readers reject the file outright as damaged.
MIN_PDF_VERSION = "1.6"


def _xobject(pdf: pikepdf.Pdf, layer: Layer):
    st = pikepdf.Stream(pdf, layer.data)
    st.Type = Name.XObject
    st.Subtype = Name.Image
    st.Width = layer.width
    st.Height = layer.height
    if layer.kind == "jbig2":
        st.ColorSpace = Name.DeviceGray
        st.BitsPerComponent = 1
        # JBIG2Decode already maps JBIG2's 1=black onto DeviceGray 0=black,
        # so no /Decode inversion here.
        st.Filter = Name.JBIG2Decode
    else:
        st.ColorSpace = Name.DeviceRGB if layer.colour else Name.DeviceGray
        st.BitsPerComponent = 8
        st.Filter = Name.DCTDecode
    return st


def _page_dict(pdf: pikepdf.Pdf, page: Page) -> pikepdf.Dictionary:
    xobjects = {}
    ops: list[str] = []
    for n, layer in enumerate(page.layers):
        key = f"Im{n}"
        xobjects[key] = _xobject(pdf, layer)
        if layer.rect_px is None:
            ops.append(f"q {page.width_pt:.4f} 0 0 {page.height_pt:.4f} 0 0 cm /{key} Do Q")
            continue
        x0, y0, x1, y1 = layer.rect_px
        scale = 72.0 / page.dpi
        w = (x1 - x0) * scale
        h = (y1 - y0) * scale
        x = x0 * scale
        y = page.height_pt - y1 * scale  # PDF origin is bottom-left
        ops.append(f"q {w:.4f} 0 0 {h:.4f} {x:.4f} {y:.4f} cm /{key} Do Q")

    return pikepdf.Dictionary(
        Type=Name.Page,
        MediaBox=[0, 0, round(page.width_pt, 4), round(page.height_pt, 4)],
        Resources=pikepdf.Dictionary(XObject=pikepdf.Dictionary(**xobjects)),
        Contents=pikepdf.Stream(pdf, "\n".join(ops).encode()),
    )


def assemble(pages: list[Page], dst: Path, *, title: str | None = None) -> None:
    pdf = pikepdf.Pdf.new()
    for page in sorted(pages, key=lambda p: p.index):
        pdf.pages.append(pikepdf.Page(pdf.make_indirect(_page_dict(pdf, page))))
    if title:
        with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
            meta["dc:title"] = title
    atomic_write(dst, lambda tmp: pdf.save(tmp, linearize=True, min_version=MIN_PDF_VERSION))
    pdf.close()
