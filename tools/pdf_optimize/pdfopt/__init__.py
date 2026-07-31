"""Shrink scanned PDFs without wrecking the text.

Stages (see ``pipeline``): probe → plan → encode → assemble → ocr → verify.
Each is usable on its own; ``cli`` wires them into ``pdfopt run``.
"""

from .config import Detect, Mode, Params

__all__ = ["Detect", "Mode", "Params", "__version__"]
__version__ = "0.2.0"
