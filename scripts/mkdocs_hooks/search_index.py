"""Post-process the MkDocs search index for better Chinese lookup and size.

The default Material search index can miss short Chinese titles when tokenization
is sparse, and very long pages can bloat the payload shipped to every visitor.
This hook keeps the public pages unchanged while making the generated index more
predictable.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import unquote


MAX_TEXT_LENGTH = 12000
COURSE_CODE_RE = re.compile(r"`([A-Z][A-Z0-9]{1,12}[A-Z0-9-]*)`")
TRAINING_PLAN_PARTS = ("academic", "专业培养方案")


def on_post_build(config, **kwargs) -> None:
    site_dir = Path(config["site_dir"])
    docs_dir = Path(config["docs_dir"])
    index_path = site_dir / "search" / "search_index.json"

    if not index_path.exists():
        return

    index = json.loads(index_path.read_text(encoding="utf-8"))
    docs = index.get("docs", [])
    if not isinstance(docs, list):
        return

    for entry in docs:
        if not isinstance(entry, dict):
            continue

        location = entry.get("location", "")
        title = entry.get("title", "")
        text = entry.get("text", "")
        if not isinstance(location, str) or not isinstance(text, str):
            continue

        source_path = _source_path_for_location(docs_dir, location)
        keywords = _keywords_for_entry(title, docs_dir, source_path)

        if _is_training_plan(docs_dir, source_path):
            text = " ".join(keywords)
        elif keywords:
            text = f"{text}\n{' '.join(keywords)}"

        if len(text) > MAX_TEXT_LENGTH:
            text = text[:MAX_TEXT_LENGTH]

        entry["text"] = text

    index_path.write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def _source_path_for_location(docs_dir: Path, location: str) -> Path | None:
    path_part = unquote(location.split("#", 1)[0]).strip("/")

    if not path_part:
        candidate = docs_dir / "index.md"
    else:
        candidate = docs_dir / path_part / "index.md"

    if candidate.exists():
        return candidate

    if path_part:
        candidate = docs_dir / f"{path_part}.md"
        if candidate.exists():
            return candidate

    return None


def _keywords_for_entry(
    title: str, docs_dir: Path, source_path: Path | None
) -> list[str]:
    keywords: list[str] = []

    if title:
        keywords.append(title)

    if source_path is not None:
        stem = source_path.stem
        if stem != "index":
            keywords.append(stem)

        try:
            relative_parts = source_path.relative_to(docs_dir).parts
        except ValueError:
            relative_parts = ()

        if _parts_start_with(relative_parts, TRAINING_PLAN_PARTS):
            keywords.extend(part for part in relative_parts[2:-1] if part != "index")
            return _dedupe(keywords)

        try:
            markdown = source_path.read_text(encoding="utf-8")
        except OSError:
            markdown = ""

        keywords.extend(COURSE_CODE_RE.findall(markdown))

    return _dedupe(keywords)


def _is_training_plan(docs_dir: Path, source_path: Path | None) -> bool:
    if source_path is None:
        return False

    try:
        return _parts_start_with(source_path.relative_to(docs_dir).parts, TRAINING_PLAN_PARTS)
    except ValueError:
        return False


def _parts_start_with(parts: tuple[str, ...], prefix: tuple[str, ...]) -> bool:
    return parts[: len(prefix)] == prefix


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []

    for value in values:
        value = value.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        deduped.append(value)

    return deduped
