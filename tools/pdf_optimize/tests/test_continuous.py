from __future__ import annotations

import hashlib
import io
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pikepdf
from PIL import Image

from pdfopt.continuous import reencode, solve_psnr
from pdfopt.render import open_doc

try:
    import pymupdf as fitz
except ImportError:  # pymupdf < 1.24 only ships the old name
    import fitz


def _jpeg(colour: tuple[int, int, int], size: tuple[int, int] = (96, 128)) -> bytes:
    image = Image.new("RGB", size, colour)
    data = io.BytesIO()
    image.save(data, format="JPEG", quality=90)
    return data.getvalue()


def _image_hash(doc: fitz.Document, index: int) -> str:
    xref = doc[index].get_images(full=True)[0][0]
    return hashlib.sha256(doc.xref_stream_raw(xref)).hexdigest()


class ContinuousTest(unittest.TestCase):
    def test_reencodes_middle_page_and_preserves_cover_streams(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "source.pdf"
            output_path = root / "output.pdf"
            source = fitz.open()
            for colour in ((20, 40, 80), (235, 235, 235), (30, 60, 100)):
                page = source.new_page(width=72, height=96)
                page.insert_image(page.rect, stream=_jpeg(colour))
            source.set_metadata({"title": "Synthetic scan"})
            source.save(source_path)
            source.close()

            result = reencode(
                source_path,
                output_path,
                ratio=24,
                keep_first_colour=1,
                keep_last_colour=1,
            )

            original = open_doc(source_path)
            output = open_doc(output_path)
            try:
                self.assertEqual(result.page_count, 3)
                self.assertEqual(output.page_count, 3)
                self.assertEqual(output.metadata["title"], "Synthetic scan")
                self.assertEqual(_image_hash(original, 0), _image_hash(output, 0))
                self.assertEqual(_image_hash(original, 2), _image_hash(output, 2))
                self.assertEqual(
                    [output.extract_image(output[i].get_images(full=True)[0][0])["ext"] for i in range(3)],
                    ["jpeg", "jpx", "jpeg"],
                )
                self.assertEqual(
                    [
                        (
                            output.extract_image(output[i].get_images(full=True)[0][0])["width"],
                            output.extract_image(output[i].get_images(full=True)[0][0])["height"],
                        )
                        for i in range(3)
                    ],
                    [(96, 128), (96, 128), (96, 128)],
                )
            finally:
                output.close()
                original.close()

    def test_refuses_page_with_text(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "source.pdf"
            source = fitz.open()
            page = source.new_page(width=72, height=96)
            page.insert_image(page.rect, stream=_jpeg((240, 240, 240)))
            page.insert_text((8, 16), "extra text")
            source.save(source_path)
            source.close()

            with self.assertRaisesRegex(ValueError, "has a text layer"):
                reencode(source_path, root / "output.pdf")

    def test_preserves_rotated_cm_transform_and_page_rotation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            src = root / "rot.pdf"
            dst = root / "out.pdf"

            im = Image.new("RGB", (200, 100), (240, 240, 240))
            for y in range(50):
                for x in range(100):
                    im.putpixel((x, y), (30, 30, 30))
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=95)

            d = fitz.open()
            p0 = d.new_page(width=100, height=200)
            p0.insert_image(p0.rect, stream=buf.getvalue(), rotate=90)
            p1 = d.new_page(width=200, height=100)
            p1.insert_image(p1.rect, stream=buf.getvalue())
            p1.set_rotation(180)
            d.save(src)
            d.close()

            reencode(src, dst, ratio=10)
            d_in, d_out = open_doc(src), open_doc(dst)
            try:
                for idx in (0, 1):
                    g_in = np.frombuffer(
                        d_in[idx].get_pixmap(colorspace=fitz.csGRAY).samples, np.uint8
                    ).astype(np.int16)
                    g_out = np.frombuffer(
                        d_out[idx].get_pixmap(colorspace=fitz.csGRAY).samples, np.uint8
                    ).astype(np.int16)
                    self.assertLess(float(np.abs(g_in - g_out).mean()), 5.0)
            finally:
                d_in.close()
                d_out.close()

    def test_decode_array_not_inverted_and_cmyk_cover_byte_exact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            src = root / "special.pdf"
            dst = root / "out.pdf"

            # Page 0: CMYK cover
            im_cmyk = Image.new("CMYK", (100, 120), (0, 200, 200, 0))
            b_cmyk = io.BytesIO()
            im_cmyk.save(b_cmyk, format="JPEG", quality=92)
            d = fitz.open()
            p0 = d.new_page(width=100, height=120)
            p0.insert_image(p0.rect, stream=b_cmyk.getvalue())
            cmyk_pdf = root / "cmyk_only.pdf"
            d.save(cmyk_pdf)
            d.close()

            # Page 1: gray JPEG with /Decode [1 0] (white stored near 0, rendered near 245)
            im_inv = Image.new("L", (100, 120), 10)
            b_inv = io.BytesIO()
            im_inv.save(b_inv, format="JPEG", quality=92)

            with pikepdf.open(cmyk_pdf) as pdf:
                st = pikepdf.Stream(pdf, b_inv.getvalue())
                st.Type = pikepdf.Name.XObject
                st.Subtype = pikepdf.Name.Image
                st.Width = 100
                st.Height = 120
                st.ColorSpace = pikepdf.Name.DeviceGray
                st.BitsPerComponent = 8
                st.Filter = pikepdf.Name.DCTDecode
                st.Decode = pikepdf.Array([1, 0])
                p1 = pikepdf.Dictionary(
                    Type=pikepdf.Name.Page,
                    MediaBox=[0, 0, 100, 120],
                    Resources=pikepdf.Dictionary(XObject=pikepdf.Dictionary(Im0=st)),
                    Contents=pikepdf.Stream(pdf, b"q 100 0 0 120 0 0 cm /Im0 Do Q"),
                )
                pdf.pages.append(pikepdf.Page(pdf.make_indirect(p1)))
                pdf.save(src)

            reencode(src, dst, ratio=10, keep_first_colour=1)
            d_in, d_out = open_doc(src), open_doc(dst)
            try:
                self.assertEqual(_image_hash(d_in, 0), _image_hash(d_out, 0))
                mean_out = float(np.frombuffer(d_out[1].get_pixmap().samples, np.uint8).mean())
                self.assertGreater(mean_out, 230.0)
            finally:
                d_in.close()
                d_out.close()

    def test_psnr_auto_colour_workers_and_toc(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            src = root / "book.pdf"
            rng = np.random.default_rng(11)
            noisy_blank = Image.fromarray(
                np.clip(252 + rng.normal(0, 1.5, (1000, 700)), 0, 255).astype(np.uint8), "L"
            )
            b_blank = io.BytesIO()
            noisy_blank.save(b_blank, format="JPEG", quality=92)

            d = fitz.open()
            for idx, stream in enumerate((
                b_blank.getvalue(),
                _jpeg((20, 180, 40), (700, 1000)),
                b_blank.getvalue(),
            )):
                pg = d.new_page(width=350, height=500)
                pg.insert_image(pg.rect, stream=stream)
            d.set_toc([[1, "Blank", 1], [1, "Colour Plate", 2], [1, "End", 3]])
            d.set_page_labels([{"startpage": 0, "prefix": "", "style": "D", "firstpagenum": 1}])
            d.save(src)
            d.close()

            out_ratio = root / "ratio.pdf"
            out_psnr = root / "psnr.pdf"
            reencode(src, out_ratio, ratio=24, auto_colour=True, workers=2)
            res = reencode(src, out_psnr, ratio=None, psnr=38.0, auto_colour=True, workers=2)

            self.assertEqual(res.kept_colour_pages, 1)
            self.assertLess(out_psnr.stat().st_size, out_ratio.stat().st_size)

            d_in, d_out = open_doc(src), open_doc(out_psnr)
            try:
                self.assertEqual(d_out.get_toc(), [[1, "Blank", 1], [1, "Colour Plate", 2], [1, "End", 3]])
                self.assertEqual(len(d_out.get_page_labels()), 1)
                self.assertEqual(_image_hash(d_in, 1), _image_hash(d_out, 1))
                self.assertEqual(
                    [d_out.extract_image(d_out[i].get_images(full=True)[0][0])["ext"] for i in range(3)],
                    ["jpx", "jpeg", "jpx"],
                )
            finally:
                d_in.close()
                d_out.close()

            solved = solve_psnr(src, 1024 * 1024, auto_colour=True)
            self.assertGreaterEqual(solved, 32.0)
            self.assertLessEqual(solved, 44.0)


if __name__ == "__main__":
    unittest.main()
