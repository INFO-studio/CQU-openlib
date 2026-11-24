from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pymupdf as fitz
from PIL import Image

from pdfopt.assemble import assemble
from pdfopt.config import Bilevel, Detect, Mode, Params, Tone
from pdfopt.detect import coverage, find_regions
from pdfopt.encode import bilevel_mask, encode_page, jbig2_stream, tone_lut
from pdfopt.util import have
from pdfopt.verify import verify


class DetectEncodeTest(unittest.TestCase):
    def test_noisy_blank_page_not_flagged_as_photo(self) -> None:
        rng = np.random.default_rng(7)
        blank = np.clip(252 + rng.normal(0, 1.5, (1650, 1275)), 0, 255).astype(np.uint8)
        rects = find_regions(blank, 150.0, Detect())
        self.assertEqual(rects, [])
        self.assertEqual(coverage(rects, blank.shape), 0.0)

    def test_adjacent_regions_never_overlap_after_pad(self) -> None:
        gray = np.full((600, 600), 255, dtype=np.uint8)
        gray[120:240, 120:240] = 120
        gray[120:240, 252:372] = 120
        rects = find_regions(gray, 150.0, Detect())
        self.assertGreaterEqual(len(rects), 1)
        for i in range(len(rects)):
            for j in range(i + 1, len(rects)):
                ax0, ay0, ax1, ay1 = rects[i]
                bx0, by0, bx1, by1 = rects[j]
                ox = max(0, min(ax1, bx1) - max(ax0, bx0))
                oy = max(0, min(ay1, by1) - max(ay0, by0))
                self.assertEqual(ox * oy, 0)
        cov = coverage(rects, gray.shape)
        self.assertGreater(cov, 0.0)
        self.assertLessEqual(cov, 1.0)

    def test_chrominance_detects_coloured_line_plot_on_white(self) -> None:
        rgb = np.full((600, 600, 3), 255, dtype=np.uint8)
        # Draw a red & blue curve grid inside a 200x200 box on pure white background.
        for x in range(150, 350):
            y1 = 220 + int(30 * np.sin((x - 150) / 15.0))
            y2 = 280 + int(30 * np.cos((x - 150) / 15.0))
            rgb[y1 - 3 : y1 + 3, x] = (220, 30, 30)
            rgb[y2 - 3 : y2 + 3, x] = (20, 70, 220)
        for y in range(170, 340, 12):
            rgb[y : y + 2, 150:350] = (210, 40, 40)
        gray = ((rgb[:, :, 0].astype(np.uint16) * 77 + rgb[:, :, 1].astype(np.uint16) * 150 + rgb[:, :, 2].astype(np.uint16) * 29) >> 8).astype(np.uint8)
        rects = find_regions(gray, 150.0, Detect(), rgb=rgb)
        self.assertTrue(rects, "expected coloured plot to be detected via chroma seed")

    def test_tone_lut_is_monotonic_without_hard_jumps(self) -> None:
        gray = np.concatenate([np.full(100, 130, np.uint8), np.full(9900, 254, np.uint8)])
        for strength in (0.0, 0.5, 1.0):
            lut = tone_lut(gray, Tone(strength=strength, showthrough=0.20))
            assert lut is not None
            diffs = np.diff(lut.astype(int))
            self.assertGreaterEqual(int(diffs.min()), 0)
            self.assertLessEqual(int(diffs.max()), 4)

    @unittest.skipUnless(have("jbig2"), "jbig2enc not installed")
    def test_mrc_text_contrast_keeps_colour_patch_untainted_and_verifies(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            # Build a page with faint gray text at top and a vivid colour photo patch at bottom.
            img = Image.new("RGB", (600, 800), (253, 253, 253))
            arr = np.array(img)
            # Faint ink stripes in top region
            for y in range(60, 240, 24):
                arr[y : y + 6, 60:540] = (140, 140, 140)
            # Vivid orange/teal photo block in bottom region
            arr[400:680, 120:480] = (210, 110, 40)
            arr[450:630, 180:420] = (40, 150, 170)
            buf = io.BytesIO()
            Image.fromarray(arr).save(buf, format="JPEG", quality=95)

            src = root / "page.pdf"
            d = fitz.open()
            pg = d.new_page(width=288, height=384)
            pg.insert_image(pg.rect, stream=buf.getvalue())
            d.save(src)
            d.close()

            params = Params(
                mode=Mode.MRC,
                dpi=150.0,
                tone=Tone(strength=1.0, showthrough=0.2),
            )
            doc = fitz.open(src)
            page = encode_page(doc, 0, params, root)
            doc.close()

            jpeg_layers = [lay for lay in page.layers if lay.kind == "jpeg"]
            self.assertTrue(jpeg_layers, "expected colour photo patch")
            self.assertTrue(jpeg_layers[0].colour)
            patch_img = Image.open(io.BytesIO(jpeg_layers[0].data))
            patch_arr = np.asarray(patch_img)
            # Colour patch must stay vivid orange/teal, not blown to white by text tone_lut.
            self.assertLess(float(patch_arr.mean()), 190.0)

            out = root / "out.pdf"
            assemble([page], out)
            rep = verify(out, expect_pages=1)
            self.assertTrue(rep.ok, rep.summary())

    @unittest.skipUnless(have("jbig2"), "jbig2enc not installed")
    def test_bilevel_mask_and_pbm_jbig2_stream(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            gray = np.full((300, 303), 250, dtype=np.uint8)
            gray[50:90, 40:200] = 30
            bmp, out_dpi = bilevel_mask(gray, 150.0, Bilevel())
            self.assertEqual(out_dpi, 300.0)
            self.assertEqual(bmp.shape[0], 600)
            jb = jbig2_stream(bmp, out_dpi, Path(directory))
            self.assertGreater(len(jb), 20)


if __name__ == "__main__":
    unittest.main()
