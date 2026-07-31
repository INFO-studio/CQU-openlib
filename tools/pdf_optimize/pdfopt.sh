#!/usr/bin/env bash
# Entry point for the pdfopt tool. Everything goes through here.
#
# Setup (once):
#   brew install jbig2enc qpdf
#   brew install tesseract tesseract-lang               # for --ocr
#   cd tools/pdf_optimize && python3 -m venv .venv \
#     && .venv/bin/pip install -r requirements.txt
#   ./pdfopt.sh ocr-setup                        # fetch tessdata_best models
#
#   ./pdfopt.sh probe  book.pdf                  # what is it, which mode fits
#   ./pdfopt.sh plan   book.pdf --max-mb 50      # solve settings from a sample
#   ./pdfopt.sh run    book.pdf --max-mb 50 --ocr
#   ./pdfopt.sh run    book.pdf --pages 1-20     # preview a few pages
#   ./pdfopt.sh verify out/book.pdf
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PY="$ROOT/.venv/bin/python"

if [[ ! -x "$PY" ]]; then
  echo "missing $PY" >&2
  echo "  cd \"$ROOT\" && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

exec "$PY" -m pdfopt "$@"
