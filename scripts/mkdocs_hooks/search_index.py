"""Build a compact page-navigation index and fix Material's Han segmenter."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import unquote


COURSE_CODE_RE = re.compile(r"`([A-Z][A-Z0-9]{1,12}[A-Z0-9-]*)`")
ZERO_WIDTH_SPACE = "\u200b"
COURSE_PAGE_BOOST = 10.0

# Material 9.6.13 doesn't inspect the final character of a Han query. Keep the
# replacement exact so a changed upstream bundle fails loudly during builds.
WORKER_SEGMENTER_BEFORE = (
    "for(let s=0;s<t.length;s++)for(let o=s+1;o<t.length;o++)"
)
WORKER_SEGMENTER_AFTER = (
    "for(let s=0;s<t.length;s++)for(let o=s+1;o<=t.length;o++)"
)


def on_post_build(config, **kwargs) -> None:
    site_dir = Path(config["site_dir"])
    docs_dir = Path(config["docs_dir"])
    index_path = site_dir / "search" / "search_index.json"

    if not index_path.exists():
        return

    index = json.loads(index_path.read_text(encoding="utf-8"))
    docs = index.get("docs", [])
    if not isinstance(docs, list):
        raise RuntimeError("Material search index has no document list")

    index["docs"] = _compact_entries(docs, docs_dir)
    index_path.write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    _patch_search_worker(site_dir)


def _compact_entries(docs: list[object], docs_dir: Path) -> list[dict]:
    pages: dict[str, list[dict]] = {}

    for item in docs:
        if not isinstance(item, dict):
            continue

        location = item.get("location")
        if not isinstance(location, str):
            continue

        page_location = location.split("#", 1)[0]
        pages.setdefault(page_location, []).append(item)

    compacted: list[dict] = []
    for page_location, entries in pages.items():
        root = next(
            (entry for entry in entries if entry.get("location") == page_location),
            entries[0],
        )

        title = root.get("title", "")
        if not isinstance(title, str):
            title = str(title)

        source_path = _source_path_for_location(docs_dir, page_location)
        keywords = _keywords_for_page(title, root.get("tags"), docs_dir, source_path)

        entry = {
            key: value
            for key, value in root.items()
            if key not in {"location", "text"}
        }
        entry["location"] = page_location
        entry["text"] = " ".join(keywords)
        if "boost" not in entry:
            entry["boost"] = _default_page_boost(title, docs_dir, source_path)
        compacted.append(entry)

    return compacted


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


def _keywords_for_page(
    title: str,
    tags: object,
    docs_dir: Path,
    source_path: Path | None,
) -> list[str]:
    keywords: list[object] = [title]

    if isinstance(tags, list):
        keywords.extend(tags)

    if source_path is not None:
        if source_path.stem != "index":
            keywords.append(source_path.stem)

        try:
            relative_parts = source_path.relative_to(docs_dir).parts
        except ValueError:
            relative_parts = ()

        # Exclude the broad top-level area and the file itself. Nested folders
        # still provide useful college, organization, and topic aliases.
        keywords.extend(
            part
            for part in relative_parts[1:-1]
            if part != "index"
        )

        try:
            markdown = source_path.read_text(encoding="utf-8")
        except OSError:
            markdown = ""
        keywords.extend(COURSE_CODE_RE.findall(markdown))

    return _dedupe(keywords)


def _dedupe(values: list[object]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []

    for value in values:
        normalized = str(value).replace(ZERO_WIDTH_SPACE, "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)

    return deduped


def _default_page_boost(
    title: str,
    docs_dir: Path,
    source_path: Path | None,
) -> float:
    normalized = title.replace(ZERO_WIDTH_SPACE, "").strip()
    boost = 1.0 + 1.0 / (len(normalized) + 1)

    if source_path is not None:
        try:
            relative_parts = source_path.relative_to(docs_dir).parts
        except ValueError:
            relative_parts = ()
        if relative_parts[:1] == ("course",):
            boost *= COURSE_PAGE_BOOST

    return boost


def _patch_search_worker(site_dir: Path) -> None:
    worker_dir = site_dir / "assets" / "javascripts" / "workers"
    workers = sorted(worker_dir.glob("search.*.min.js"))
    if len(workers) != 1:
        raise RuntimeError(
            f"Expected one Material search worker, found {len(workers)}"
        )

    worker_path = workers[0]
    worker = worker_path.read_text(encoding="utf-8")
    before_count = worker.count(WORKER_SEGMENTER_BEFORE)
    after_count = worker.count(WORKER_SEGMENTER_AFTER)

    if before_count == 1 and after_count == 0:
        worker_path.write_text(
            worker.replace(WORKER_SEGMENTER_BEFORE, WORKER_SEGMENTER_AFTER),
            encoding="utf-8",
        )
        return

    # MkDocs serve can call the hook repeatedly without recopying theme assets.
    if before_count == 0 and after_count == 1:
        return

    raise RuntimeError(
        "Material search worker segmenter did not match the pinned 9.6.13 bundle "
        f"(unpatched={before_count}, patched={after_count})"
    )
