"""On-disk store for encoded pages and OCR results.

Encoding a 600-page book takes a while and OCR takes much longer, so each
page's streams are written out as soon as they exist. A re-run with the same
source and the same parameters picks up where it stopped instead of starting
over, and the assemble step can stream pages back lazily rather than holding
the whole book in memory.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from pathlib import Path

from .config import PIPELINE_VERSION, Params
from .encode import Layer, Page
from .textlayer import Line


def _name_hash(src: Path) -> str:
    return hashlib.sha256(src.name.encode("utf-8", errors="replace")).hexdigest()[:6]


def source_key(src: Path, params: Params) -> str:
    st = src.stat()
    return f"v{PIPELINE_VERSION}-{_name_hash(src)}-{st.st_size:x}-{int(st.st_mtime):x}-{params.fingerprint()}"


def ocr_source_key(
    src: Path,
    *,
    langs: str,
    dpi: float | None,
    psm: int | None,
    min_conf: float,
    tessdata_dir: Path | None,
) -> str:
    st = src.stat()
    model_sig: list[tuple[str, int]] = []
    if tessdata_dir and tessdata_dir.is_dir():
        for lang in langs.split("+"):
            p = tessdata_dir / f"{lang}.traineddata"
            model_sig.append((lang, p.stat().st_size if p.exists() else 0))
    payload = {
        "v": PIPELINE_VERSION,
        "langs": langs,
        "dpi": dpi,
        "psm": psm,
        "min_conf": min_conf,
        "models": model_sig,
    }
    fp = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:12]
    return f"ocr-v{PIPELINE_VERSION}-{_name_hash(src)}-{st.st_size:x}-{int(st.st_mtime):x}-{fp}"


class Cache:
    def __init__(self, root: Path, key: str):
        self.dir = root / key
        self.pages_dir = self.dir / "pages"
        self.pages_dir.mkdir(parents=True, exist_ok=True)

    # -- bookkeeping -------------------------------------------------------

    @property
    def meta_path(self) -> Path:
        return self.dir / "meta.json"

    def write_meta(self, meta: dict) -> None:
        self.meta_path.write_text(json.dumps(meta, indent=2, default=str))

    def read_meta(self) -> dict:
        if not self.meta_path.exists():
            return {}
        return json.loads(self.meta_path.read_text())

    # -- pages -------------------------------------------------------------

    def _json_path(self, index: int) -> Path:
        return self.pages_dir / f"{index:06d}.json"

    def has(self, index: int) -> bool:
        p = self._json_path(index)
        if not p.exists():
            return False
        try:
            spec = json.loads(p.read_text())
        except json.JSONDecodeError:
            return False
        return all((self.pages_dir / lay["file"]).exists() for lay in spec["layers"])

    def missing(self, indices: list[int]) -> list[int]:
        return [i for i in indices if not self.has(i)]

    def save(self, page: Page) -> None:
        layers = []
        for n, layer in enumerate(page.layers):
            ext = "jb2" if layer.kind == "jbig2" else "jpg"
            name = f"{page.index:06d}.{n}.{ext}"
            (self.pages_dir / name).write_bytes(layer.data)
            spec = asdict(layer)
            spec.pop("data")
            spec["file"] = name
            layers.append(spec)
        payload = {
            "index": page.index,
            "width_pt": page.width_pt,
            "height_pt": page.height_pt,
            "dpi": page.dpi,
            "render_width": page.render_width,
            "render_height": page.render_height,
            "layers": layers,
        }
        # JSON last: its presence is what marks the page complete.
        tmp = self._json_path(page.index).with_suffix(".json.partial")
        tmp.write_text(json.dumps(payload))
        tmp.replace(self._json_path(page.index))

    def load(self, index: int) -> Page:
        spec = json.loads(self._json_path(index).read_text())
        layers = [
            Layer(
                kind=lay["kind"],
                data=(self.pages_dir / lay["file"]).read_bytes(),
                width=lay["width"],
                height=lay["height"],
                colour=lay["colour"],
                rect_px=tuple(lay["rect_px"]) if lay["rect_px"] else None,
            )
            for lay in spec["layers"]
        ]
        return Page(
            spec["index"],
            spec["width_pt"],
            spec["height_pt"],
            spec["dpi"],
            layers,
            render_width=int(spec.get("render_width", 0)),
            render_height=int(spec.get("render_height", 0)),
        )

    def total_bytes(self, indices: list[int]) -> int:
        total = 0
        for i in indices:
            p = self._json_path(i)
            if not p.exists():
                continue
            for lay in json.loads(p.read_text())["layers"]:
                f = self.pages_dir / lay["file"]
                if f.exists():
                    total += f.stat().st_size
        return total


class OcrCache:
    """Per-page OCR line cache for resumable runs."""

    def __init__(self, root: Path, key: str):
        self.dir = root / key
        self.pages_dir = self.dir / "pages"
        self.pages_dir.mkdir(parents=True, exist_ok=True)

    @property
    def meta_path(self) -> Path:
        return self.dir / "meta.json"

    def write_meta(self, meta: dict) -> None:
        self.meta_path.write_text(json.dumps(meta, indent=2, default=str))

    def read_meta(self) -> dict:
        if not self.meta_path.exists():
            return {}
        return json.loads(self.meta_path.read_text())

    def _json_path(self, index: int) -> Path:
        return self.pages_dir / f"{index:06d}.json"

    def has(self, index: int) -> bool:
        p = self._json_path(index)
        if not p.exists():
            return False
        try:
            data = json.loads(p.read_text())
        except json.JSONDecodeError:
            return False
        return "lines" in data and "img_size" in data

    def save(self, index: int, lines: list[Line], img_size: tuple[int, int]) -> None:
        payload = {
            "index": index,
            "img_size": [int(img_size[0]), int(img_size[1])],
            "lines": [
                {
                    "text": line.text,
                    "x0": line.x0,
                    "y0": line.y0,
                    "x1": line.x1,
                    "y1": line.y1,
                    "block": line.block,
                }
                for line in lines
            ],
        }
        tmp = self._json_path(index).with_suffix(".json.partial")
        tmp.write_text(json.dumps(payload, ensure_ascii=False))
        tmp.replace(self._json_path(index))

    def load(self, index: int) -> tuple[list[Line], tuple[int, int]]:
        spec = json.loads(self._json_path(index).read_text())
        w, h = spec["img_size"]
        lines = [
            Line(
                text=item["text"],
                x0=float(item["x0"]),
                y0=float(item["y0"]),
                x1=float(item["x1"]),
                y1=float(item["y1"]),
                block=int(item.get("block", 0)),
            )
            for item in spec["lines"]
        ]
        return lines, (int(w), int(h))
