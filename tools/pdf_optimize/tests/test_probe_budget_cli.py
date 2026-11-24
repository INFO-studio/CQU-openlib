from __future__ import annotations

import io
import os
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pymupdf as fitz
from PIL import Image

from pdfopt import budget, cli, probe
from pdfopt.cache import Cache, source_key
from pdfopt.config import Mode, Params


def _make_scan_pdf(
    path: Path,
    *,
    pages: int,
    page_pt: tuple[float, float],
    img_px: tuple[int, int],
    ink_level: int = 20,
    text_pages: set[int] | None = None,
) -> None:
    d = fitz.open()
    for i in range(pages):
        arr = np.full((img_px[1], img_px[0]), 253, dtype=np.uint8)
        # Draw horizontal text-like bars evenly across page
        for y in range(60, img_px[1] - 60, max(20, img_px[1] // 35)):
            arr[y : y + 4, 60 : img_px[0] - 60] = ink_level
        buf = io.BytesIO()
        Image.fromarray(arr, "L").save(buf, format="JPEG", quality=92)
        pg = d.new_page(width=page_pt[0], height=page_pt[1])
        pg.insert_image(pg.rect, stream=buf.getvalue())
        if text_pages and i in text_pages:
            pg.insert_text((30, 30), f"Ad page {i}", fontsize=14)
    d.save(path)
    d.close()


class ProbeBudgetCliTest(unittest.TestCase):
    def test_oversized_mediabox_and_faint_scan_avoid_mrc(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            oversized = root / "oversized.pdf"
            _make_scan_pdf(
                oversized,
                pages=4,
                page_pt=(1416.0, 2244.0),
                img_px=(1888, 2992),
                ink_level=25,
            )
            info = probe.probe(oversized, samples=4)
            self.assertTrue(info.oversized_mediabox)
            self.assertAlmostEqual(info.native_dpi, 96.0, delta=2.0)
            self.assertGreater(info.effective_dpi, 250.0)
            mode, _ = info.recommend()
            self.assertNotEqual(mode, Mode.MRC)

            faint = root / "faint150.pdf"
            _make_scan_pdf(
                faint,
                pages=4,
                page_pt=(576.0, 760.0),
                img_px=(1200, 1583),
                ink_level=130,
            )
            info_faint = probe.probe(faint, samples=4)
            self.assertGreater(info_faint.median_ink_p05, 100.0)
            mode_faint, _ = info_faint.recommend()
            self.assertNotEqual(mode_faint, Mode.MRC)

    def test_single_ad_text_page_does_not_block_mrc(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            book = root / "book.pdf"
            _make_scan_pdf(
                book,
                pages=8,
                page_pt=(576.0, 760.0),
                img_px=(2400, 3166),
                ink_level=20,
                text_pages={0},
            )
            info = probe.probe(book, samples=8)
            self.assertTrue(info.has_text_layer)
            self.assertFalse(info.mostly_has_text)
            mode, _ = info.recommend()
            self.assertEqual(mode, Mode.MRC)

    def test_budget_respects_native_dpi_locks_subset_and_cleans_scratch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            src = root / "mixed.pdf"
            d = fitz.open()
            for i in range(6):
                pg = d.new_page(width=288, height=384)
                if i < 3:
                    # Blank white pages -> very small JPEG
                    im = Image.new("L", (600, 800), 255)
                else:
                    # High-frequency noisy texture -> much larger JPEG
                    rng = np.random.default_rng(100 + i)
                    im = Image.fromarray(rng.integers(0, 255, (800, 600), dtype=np.uint8), "L")
                b = io.BytesIO()
                im.save(b, format="JPEG", quality=92)
                pg.insert_image(pg.rect, stream=b.getvalue())
            d.save(src)
            d.close()

            p = Params(mode=Mode.GRAY, dpi=150.0, page_dpi=150.0, page_quality=85)
            plan = budget.solve(
                src,
                p,
                [3, 4, 5],
                10 * 1024 * 1024,
                locked_fields={"page_quality"},
                native_dpi=150.0,
            )
            self.assertEqual(plan.params.page_dpi, 150.0)
            self.assertEqual(plan.params.page_quality, 85)

            cands = budget.build_candidates(
                p, locked_fields={"page_quality"}, native_dpi=150.0
            )
            for c in cands:
                self.assertLessEqual(c.page_dpi or 0.0, 150.0)
                self.assertEqual(c.page_quality, 85)

            tmp_root = Path(os.environ.get("TMPDIR", "/tmp"))
            before = {x.name for x in tmp_root.glob("pdfopt-*")}
            est_low = budget.estimate(src, p, [0, 1, 2], samples=3)
            est_high = budget.estimate(src, p, [3, 4, 5], samples=3)
            after = {x.name for x in tmp_root.glob("pdfopt-*")}
            self.assertEqual(before, after, "budget.estimate leaked temporary directory")
            self.assertGreater(est_high.bytes_per_page, est_low.bytes_per_page * 3.0)

    def test_parse_pages_rejects_invalid_and_reversed(self) -> None:
        self.assertEqual(cli.parse_pages("1-3,5", 10), [0, 1, 2, 4])
        for bad in ("20-10", "999-1000", "0", "0-2", "", "abc"):
            with self.assertRaises(SystemExit, msg=f"should reject {bad!r}"):
                cli.parse_pages(bad, 10)

    def test_clean_deletes_only_target_book_cache(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workdir = root / "out"
            book_a = root / "a.pdf"
            book_b = root / "b.pdf"
            book_a.write_bytes(b"%PDF-1.4 A")
            book_b.write_bytes(b"%PDF-1.4 B")

            p = Params(mode=Mode.GRAY, dpi=150.0)
            ca = Cache(workdir / ".pdfopt", source_key(book_a, p))
            ca.write_meta({"source": str(book_a)})
            cb = Cache(workdir / ".pdfopt", source_key(book_b, p))
            cb.write_meta({"source": str(book_b)})

            rc = cli.main(["clean", str(book_a), "--workdir", str(workdir)])
            self.assertEqual(rc, 0)
            self.assertFalse(ca.dir.exists())
            self.assertTrue(cb.dir.exists())

    def test_cmd_ocr_guards_source_overwrite_and_existing_text(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            src = root / "with_text.pdf"
            d = fitz.open()
            pg = d.new_page(width=200, height=200)
            pg.insert_text((20, 40), "Already here")
            d.save(src)
            d.close()

            with self.assertRaises(SystemExit) as cm1:
                cli.main(["ocr", str(src), "--ocr-source", str(src), "--out", str(src)])
            self.assertIn("overwrite", str(cm1.exception))

            out = root / "out.pdf"
            with self.assertRaises(SystemExit) as cm2:
                cli.main(["ocr", str(src), "--out", str(out)])
            self.assertIn("--force", str(cm2.exception))

    def test_mrc_ladder_lowers_min_dpi_unless_locked(self) -> None:
        p_mrc = Params(mode=Mode.MRC, dpi=300.0)
        unlocked = budget.build_candidates(p_mrc, native_dpi=300.0)
        cand_200 = [c for c in unlocked if c.dpi == 200.0]
        self.assertTrue(cand_200)
        self.assertEqual(cand_200[0].bilevel.min_dpi, 200.0)

        locked = budget.build_candidates(
            p_mrc, locked_fields={"bilevel_min_dpi"}, native_dpi=300.0
        )
        cand_200_locked = [c for c in locked if c.dpi == 200.0]
        self.assertTrue(cand_200_locked)
        self.assertEqual(cand_200_locked[0].bilevel.min_dpi, 300.0)

    def test_probe_measures_native_ink_on_300dpi_thin_strokes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            src = root / "thin300.pdf"
            arr = np.full((3200, 2400), 253, dtype=np.uint8)
            # 1-px tall strokes (~1.2% of pixels): 150 DPI downsample averages them >120,
            # while native pixels preserve true ink (~40).
            for y in range(80, 3120, 80):
                arr[y : y + 1, 100:2300] = 40
            buf = io.BytesIO()
            Image.fromarray(arr, "L").save(buf, format="PNG")
            d = fitz.open()
            pg = d.new_page(width=576.0, height=768.0)
            pg.insert_image(pg.rect, stream=buf.getvalue())
            d.save(src)
            d.close()

            info = probe.probe(src, samples=1)
            self.assertLess(info.median_ink_p05, 60.0)
            mode, _ = info.recommend()
            self.assertEqual(mode, Mode.MRC)


if __name__ == "__main__":
    unittest.main()
