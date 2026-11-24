"""Build a PDF out of encoded page layers."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import pikepdf
from pikepdf import Name

from .encode import Layer, Page
from .util import atomic_write, copy_pdf_metadata

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
    sx = (page.width_pt / page.render_width) if page.render_width > 0 else (72.0 / page.dpi)
    sy = (page.height_pt / page.render_height) if page.render_height > 0 else (72.0 / page.dpi)
    for n, layer in enumerate(page.layers):
        key = f"Im{n}"
        xobjects[key] = _xobject(pdf, layer)
        if layer.rect_px is None:
            ops.append(f"q {page.width_pt:.4f} 0 0 {page.height_pt:.4f} 0 0 cm /{key} Do Q")
            continue
        x0, y0, x1, y1 = layer.rect_px
        w = (x1 - x0) * sx
        h = (y1 - y0) * sy
        x = x0 * sx
        y = page.height_pt - y1 * sy  # PDF origin is bottom-left
        ops.append(f"q {w:.4f} 0 0 {h:.4f} {x:.4f} {y:.4f} cm /{key} Do Q")

    return pikepdf.Dictionary(
        Type=Name.Page,
        MediaBox=[0, 0, round(page.width_pt, 4), round(page.height_pt, 4)],
        Resources=pikepdf.Dictionary(XObject=pikepdf.Dictionary(**xobjects)),
        Contents=pikepdf.Stream(pdf, "\n".join(ops).encode()),
    )


def assemble(
    pages: Iterable[Page],
    dst: Path,
    *,
    source_pdf: Path | None = None,
    page_indices: list[int] | None = None,
    title: str | None = None,
) -> tuple[int, int]:
    """Stream encoded ``pages`` into a linearized PDF, preserving metadata/TOC."""
    pdf = pikepdf.Pdf.new()
    count = 0
    with_photos = 0
    try:
        for page in pages:
            pdf.pages.append(pikepdf.Page(pdf.make_indirect(_page_dict(pdf, page))))
            count += 1
            if any(x.rect_px for x in page.layers):
                with_photos += 1
        if source_pdf is not None:
            copy_pdf_metadata(
                source_pdf,
                pdf,
                page_indices=page_indices,
                fallback_title=title,
            )
        elif title:
            with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
                meta["dc:title"] = title
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
        pdf.close()
    return count, with_photos
