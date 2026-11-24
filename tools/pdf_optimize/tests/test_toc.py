from __future__ import annotations

import hashlib
import io
import subprocess
import tempfile
import unittest
from pathlib import Path

import pikepdf
import pymupdf as fitz
from PIL import Image

from pdfopt import cli
from pdfopt.toc import apply_toc, export_toc_pages, parse_toc_text, verify_toc_against_text


def _make_sample_book(path: Path) -> None:
    d = fitz.open()
    im = Image.new("RGB", (120, 160), (245, 245, 245))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=92)
    jpg = buf.getvalue()

    # 8 pages: p1 cover, p2 toc, p3..p8 body (printed 1..6 => offset=2)
    texts = {
        0: "封面",
        1: "目录",
        2: "1 概论\n1.1 历史与发展",
        3: "正文第2页",
        4: "1.2 现代应用",
        5: "2 基础理论",
        6: "2.1 基本原理",
        7: "参考文献",
    }
    for i in range(8):
        pg = d.new_page(width=200, height=300)
        pg.insert_image(pg.rect, stream=jpg)
        pg.insert_text((20, 40), texts[i], fontname="china-s", fontsize=12)
    d.save(path)
    d.close()


def _image_hashes(path: Path) -> list[str]:
    d = fitz.open(path)
    try:
        return [
            hashlib.sha256(d.xref_stream_raw(im[0])).hexdigest()
            for i in range(d.page_count)
            for im in d[i].get_images(full=True)
        ]
    finally:
        d.close()


class TocTest(unittest.TestCase):
    def test_parse_toc_text_indent_dots_offset_and_errors(self) -> None:
        raw = """
        # front matter
        封面 @1
        目录 @2
        1 概论 ...... 1
          1.1 历史与发展 1
            1.1.1 古代 ··· 2
        \t1.2 现代应用...3
        2 基础理论\t\t4
            2.1 基本原理 5
        """
        entries, warnings = parse_toc_text(raw, offset=2, page_count=8)
        self.assertEqual(warnings, [])
        self.assertEqual(
            [(e.level, e.title, e.page, e.printed_page) for e in entries],
            [
                (1, "封面", 1, None),
                (1, "目录", 2, None),
                (1, "1 概论", 3, 1),
                (2, "1.1 历史与发展", 3, 1),
                (3, "1.1.1 古代", 4, 2),
                (2, "1.2 现代应用", 5, 3),
                (1, "2 基础理论", 6, 4),
                (2, "2.1 基本原理", 7, 5),
            ],
        )

        # Decreasing printed page emits warning
        _, dec_warn = parse_toc_text("1 Ch1 5\n2 Ch2 3\n", offset=0, page_count=8)
        self.assertTrue(dec_warn)

        # Inconsistent indentation raises ValueError
        with self.assertRaisesRegex(ValueError, "inconsistent indentation"):
            parse_toc_text("1 Ch1 1\n    1.1 Sub 1\n  1.2 Bad 2\n")

        # Out-of-range page raises ValueError
        with self.assertRaisesRegex(ValueError, "out of range"):
            parse_toc_text("1 Ch1 7\n", offset=2, page_count=8)

    def test_apply_toc_lossless_inplace_and_offset_check(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            book = root / "book.pdf"
            _make_sample_book(book)
            orig_hashes = _image_hashes(book)

            toc_txt = (
                "封面 @1\n"
                "目录 @2\n"
                "1 概论 1\n"
                "  1.1 历史与发展 1\n"
                "  1.2 现代应用 3\n"
                "2 基础理论 4\n"
                "  2.1 基本原理 5\n"
                "参考文献 6\n"
            )
            good_entries, _ = parse_toc_text(toc_txt, offset=2, page_count=8)
            good_check = verify_toc_against_text(book, good_entries)
            self.assertEqual(good_check.checked, 3)
            self.assertEqual(good_check.hits, 3)
            self.assertEqual(good_check.warnings, [])

            # Wrong offset by +1 triggers offset suspect warning when >=5 specific entries
            wide_txt = (
                "1 概论 1\n"
                "  1.1 历史与发展 1\n"
                "  1.2 现代应用 3\n"
                "2 基础理论 4\n"
                "  2.1 基本原理 5\n"
                "  2.2 参考文献 6\n"
                "  2.3 概论 1\n"
                "  2.4 现代应用 3\n"
            )
            bad_entries, _ = parse_toc_text(wide_txt, offset=3, page_count=9)
            bad_check = verify_toc_against_text(book, bad_entries)
            self.assertGreater(bad_check.hits_minus_1, bad_check.hits)
            self.assertTrue(any("offset suspect" in w for w in bad_check.warnings))

            # In-place apply preserves every image stream SHA-256 and OCR text
            apply_toc(book, book, good_entries, body_start_page=3)
            self.assertEqual(_image_hashes(book), orig_hashes)
            rc = subprocess.run(["qpdf", "--check", str(book)], capture_output=True).returncode
            self.assertEqual(rc, 0)
            with pikepdf.open(book) as pk:
                self.assertTrue(pk.is_linearized)

            d = fitz.open(book)
            try:
                self.assertEqual(
                    d.get_toc(simple=True),
                    [
                        [1, "封面", 1],
                        [1, "目录", 2],
                        [1, "1 概论", 3],
                        [2, "1.1 历史与发展", 3],
                        [2, "1.2 现代应用", 5],
                        [1, "2 基础理论", 6],
                        [2, "2.1 基本原理", 7],
                        [1, "参考文献", 8],
                    ],
                )
                self.assertEqual(
                    d.get_page_labels(),
                    [
                        {"startpage": 0, "prefix": "", "firstpagenum": 1, "style": "r"},
                        {"startpage": 2, "prefix": "", "firstpagenum": 1, "style": "D"},
                    ],
                )
                self.assertIn("历史与发展", d[2].get_text("text"))
            finally:
                d.close()

    def test_cli_toc_pages_apply_show(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            book = root / "book.pdf"
            _make_sample_book(book)

            pages_dir = root / "imgs"
            self.assertEqual(
                cli.main(["toc", "pages", str(book), "--pages", "1-3", "--out-dir", str(pages_dir)]),
                0,
            )
            self.assertEqual(sorted(p.name for p in pages_dir.iterdir()), ["p001.jpg", "p002.jpg", "p003.jpg"])

            toc_file = root / "toc.txt"
            toc_file.write_text("封面 @1\n1 概论 1\n  1.1 历史与发展 1\n", encoding="utf-8")
            out_pdf = root / "with_toc.pdf"
            self.assertEqual(
                cli.main([
                    "toc", "apply", str(book),
                    "--from", str(toc_file),
                    "--offset", "2",
                    "--page-labels",
                    "--out", str(out_pdf),
                ]),
                0,
            )
            self.assertEqual(cli.main(["toc", "show", str(out_pdf)]), 0)

    def test_verify_toc_english_titles_and_offset_check(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            book = Path(directory) / "english_book.pdf"
            d = fitz.open()
            texts = {
                0: "Cover",
                1: "Contents",
                2: "1 The Engineering Profession\n1.1 Introduction",
                3: "1.2 The Technology Team\nDetails about engineering teams.",
                4: "1.3 Kirchhoff's Laws\nCurrent and voltage loops.",
                5: "2 Engineering Economics\n2.1 Cash-Flow Diagram",
                6: "2.2 Present Worth and Future Worth",
                7: "Appendix A\nUnit Conversions",
            }
            for i in range(8):
                pg = d.new_page(width=300, height=400)
                pg.insert_text((20, 40), texts[i], fontname="helv", fontsize=12)
            d.save(book)
            d.close()

            toc_txt = (
                "Cover @1\n"
                "Contents @2\n"
                "1 The Engineering Profession 1\n"
                "  1.1 Introduction 1\n"
                "  1.2 The Technology Team 2\n"
                "  1.3 Kirchhoff's Laws 3\n"
                "2 Engineering Economics 4\n"
                "  2.1 Cash-Flow Diagram 4\n"
                "  2.2 Present Worth and Future Worth 5\n"
                "  Appendix A 6\n"
            )
            good_entries, _ = parse_toc_text(toc_txt, offset=2, page_count=8)
            good_check = verify_toc_against_text(book, good_entries)
            # Generic 1.1 Introduction is excluded; 5 specific entries checked
            self.assertEqual(good_check.checked, 5)
            self.assertEqual(good_check.hits, 5)
            self.assertEqual(good_check.warnings, [])

            bad_entries, _ = parse_toc_text(toc_txt, offset=3, page_count=9)
            bad_check = verify_toc_against_text(book, bad_entries)
            self.assertEqual(bad_check.checked, 5)
            self.assertEqual(bad_check.hits, 0)
            self.assertEqual(bad_check.hits_minus_1, 5)
            self.assertTrue(any("offset suspect" in w for w in bad_check.warnings))


if __name__ == "__main__":
    unittest.main()
