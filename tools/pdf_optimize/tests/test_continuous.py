from __future__ import annotations

import hashlib
import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from pdfopt.continuous import reencode
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


if __name__ == "__main__":
    unittest.main()
