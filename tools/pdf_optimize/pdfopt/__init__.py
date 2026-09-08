"""Shrink scanned PDFs without wrecking the text.

Stages (see ``pipeline``): probe → plan → encode → assemble → ocr → verify.
Each is usable on its own; ``cli`` wires them into ``pdfopt run``.
"""

from .config import Bilevel, Detect, Mode, Params, Tone

__all__ = ["Bilevel", "Detect", "Mode", "Params", "Tone", "__version__"]
__version__ = "0.2.0"
