from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pikepdf
import pymupdf as fitz
from PIL import Image

from pdfopt.assemble import assemble
from pdfopt.cache import OcrCache
from pdfopt.encode import Layer, Page
from pdfopt.render import ocr_render_dpi
from pdfopt.textlayer import Line, Word, cjk_font, join_words, parse_tsv, reading_order, write_lines
from pdfopt.verify import verify


class AssembleTextlayerVerifyTest(unittest.TestCase):
    def test_assemble_streams_generator_and_copies_toc_labels(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            src = root / "src.pdf"
            d = fitz.open()
            for i in range(4):
                pg = d.new_page(width=200, height=300)
                pg.insert_text((20, 40), f"Src {i}")
            d.set_toc([[1, "Ch 1", 1], [2, "Sec 1.1", 2], [1, "Ch 2", 3]])
            d.set_page_labels([{"startpage": 0, "prefix": "", "style": "r", "firstpagenum": 1}])
            d.set_metadata({"title": "Sample Title", "author": "Tester"})
            d.save(src)
            d.close()

            im = Image.new("L", (200, 300), 230)
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=80)
            jpg = buf.getvalue()

            def page_gen():
                for idx in range(4):
                    yield Page(idx, 200.0, 300.0, 72.0, [Layer("jpeg", jpg, 200, 300, False, None)], 200, 300)

            out = root / "assembled.pdf"
            count, photos = assemble(page_gen(), out, source_pdf=src, page_indices=[0, 1, 2, 3])
            self.assertEqual((count, photos), (4, 0))

            rep = verify(out, expect_pages=4)
            self.assertTrue(rep.ok, rep.summary())
            self.assertEqual(rep.warnings, [])
            with pikepdf.open(out) as pk:
                self.assertTrue(pk.is_linearized)

            d_out = fitz.open(out)
            try:
                self.assertEqual(d_out.get_toc(), [[1, "Ch 1", 1], [2, "Sec 1.1", 2], [1, "Ch 2", 3]])
                self.assertEqual(len(d_out.get_page_labels()), 1)
                self.assertEqual(d_out.metadata["title"], "Sample Title")
            finally:
                d_out.close()

            # Subset bookmark remapping
            sub_out = root / "sub.pdf"
            assemble(
                [Page(1, 200.0, 300.0, 72.0, [Layer("jpeg", jpg, 200, 300, False, None)], 200, 300),
                 Page(2, 200.0, 300.0, 72.0, [Layer("jpeg", jpg, 200, 300, False, None)], 200, 300)],
                sub_out,
                source_pdf=src,
                page_indices=[1, 2],
            )
            d_sub = fitz.open(sub_out)
            try:
                self.assertEqual(d_sub.get_toc(), [[1, "Sec 1.1", 1], [1, "Ch 2", 2]])
            finally:
                d_sub.close()

    def test_parse_tsv_splits_wide_gaps_and_join_words(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tsv = Path(directory) / "sample.tsv"
            tsv.write_text(
                "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
                "5\t1\t1\t1\t1\t1\t100\t100\t80\t24\t95\t第一章\n"
                "5\t1\t1\t1\t1\t2\t950\t100\t30\t24\t95\t12\n"
                "5\t1\t1\t1\t2\t1\t100\t150\t30\t24\t95\t20\n"
                "5\t1\t1\t1\t2\t2\t132\t150\t30\t24\t95\t24\n"
                "5\t1\t1\t1\t2\t3\t165\t150\t10\t24\t95\t—\n"
                "5\t1\t1\t1\t2\t4\t177\t150\t40\t24\t95\t测试\n",
                encoding="utf-8",
            )
            lines = parse_tsv(tsv, min_conf=25.0)
            # First line must be split into two tight boxes rather than one 880px line.
            self.assertEqual(len(lines), 3)
            self.assertEqual(lines[0].text, "第一章")
            self.assertLess(lines[0].width, 100.0)
            self.assertEqual(lines[1].text, "12")
            self.assertEqual(lines[2].text, "2024—测试")

        eng = join_words([
            Word("Hello", 0, 0, 50, 20, 95),
            Word("world", 62, 0, 120, 20, 95),
        ])
        self.assertEqual(eng, "Hello world")

    def test_reading_order_two_columns_and_skewed_row(self) -> None:
        lines = [
            Line("Right 1", 500, 99, 800, 129, block=2),
            Line("Right 2", 500, 140, 800, 170, block=2),
            Line("Left 1", 100, 100, 400, 130, block=1),
            Line("Left 2", 100, 141, 400, 171, block=1),
        ]
        ordered = reading_order(lines)
        self.assertEqual([l.text for l in ordered], ["Left 1", "Left 2", "Right 1", "Right 2"])

    def test_write_lines_filters_non_bmp_and_scales_to_img_size(self) -> None:
        d = fitz.open()
        pg = d.new_page(width=200, height=300)
        font = cjk_font()
        written = write_lines(
            pg,
            [Line("测试 𠮷 文字", 100, 200, 500, 240)],
            300.0,
            font,
            img_size=(1000, 1500),
        )
        self.assertEqual(written, 1)
        extracted = pg.get_text("text").strip()
        self.assertNotIn("\x00", extracted)
        self.assertIn("测试", extracted)
        blocks = pg.get_text("blocks")
        # x0 = 100/1000 * 200 = 20pt
        self.assertAlmostEqual(blocks[0][0], 20.0, delta=3.0)
        d.close()

    def test_ocr_render_dpi_caps_oversized_mediabox_and_low_dpi(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            # 19.67 x 31.17 in oversized MediaBox with 1888x2992 image
            im = Image.new("L", (1888, 2992), 250)
            b = io.BytesIO()
            im.save(b, format="JPEG", quality=80)
            p1 = root / "oversized.pdf"
            d = fitz.open()
            pg = d.new_page(width=1416.0, height=2244.0)
            pg.insert_image(pg.rect, stream=b.getvalue())
            d.save(p1)
            d.close()

            d_open = fitz.open(p1)
            try:
                dpi_auto = ocr_render_dpi(d_open, 0, None)
                self.assertAlmostEqual(dpi_auto, 96.0, delta=1.5)
                dpi_forced = ocr_render_dpi(d_open, 0, 300.0)
                self.assertLessEqual(dpi_forced * 31.17, 4501.0)
            finally:
                d_open.close()

            # 150 DPI scan should stay at 150 DPI under auto OCR
            im2 = Image.new("L", (1200, 1600), 250)
            b2 = io.BytesIO()
            im2.save(b2, format="JPEG", quality=80)
            p2 = root / "low150.pdf"
            d2 = fitz.open()
            pg2 = d2.new_page(width=576.0, height=768.0)
            pg2.insert_image(pg2.rect, stream=b2.getvalue())
            d2.save(p2)
            d2.close()
            d2_open = fitz.open(p2)
            try:
                self.assertAlmostEqual(ocr_render_dpi(d2_open, 0, None), 150.0, delta=1.5)
            finally:
                d2_open.close()

    def test_ocr_cache_roundtrip_and_verify_checks(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cache = OcrCache(root, "ocr-test")
            lines = [Line("第一行", 10.0, 20.0, 100.0, 45.0, block=1)]
            cache.save(3, lines, (1200, 1600))
            self.assertTrue(cache.has(3))
            loaded, size = cache.load(3)
            self.assertEqual(size, (1200, 1600))
            self.assertEqual(loaded[0].text, "第一行")

            # Corrupt PDF -> ok=False without crashing
            bad = root / "bad.pdf"
            bad.write_bytes(b"not a pdf")
            rep_bad = verify(bad)
            self.assertFalse(rep_bad.ok)
            self.assertIn("failed to open", rep_bad.structural)

            # PDF declaring 1.3 with JPXDecode -> version mismatch error
            jpx_buf = io.BytesIO()
            Image.new("L", (32, 32), 200).save(jpx_buf, format="JPEG2000")
            pdf = pikepdf.Pdf.new()
            st = pikepdf.Stream(pdf, jpx_buf.getvalue())
            st.Type = pikepdf.Name.XObject
            st.Subtype = pikepdf.Name.Image
            st.Width = 32
            st.Height = 32
            st.ColorSpace = pikepdf.Name.DeviceGray
            st.BitsPerComponent = 8
            st.Filter = pikepdf.Name.JPXDecode
            pdf.pages.append(
                pikepdf.Page(
                    pdf.make_indirect(
                        pikepdf.Dictionary(
                            Type=pikepdf.Name.Page,
                            MediaBox=[0, 0, 32, 32],
                            Resources=pikepdf.Dictionary(XObject=pikepdf.Dictionary(Im0=st)),
                            Contents=pikepdf.Stream(pdf, b"q 32 0 0 32 0 0 cm /Im0 Do Q"),
                        )
                    )
                )
            )
            bad_ver = root / "v13_jpx.pdf"
            pdf.save(bad_ver, force_version="1.3")
            pdf.close()
            rep_ver = verify(bad_ver)
            self.assertFalse(rep_ver.ok)
            self.assertIn("JPXDecode", rep_ver.structural)


if __name__ == "__main__":
    unittest.main()
