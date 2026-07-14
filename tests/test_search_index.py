from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import quote

from scripts.mkdocs_hooks import search_index


class SearchIndexHookTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.docs_dir = self.root / "docs"
        self.site_dir = self.root / "site"
        self.index_path = self.site_dir / "search" / "search_index.json"
        self.worker_path = (
            self.site_dir
            / "assets"
            / "javascripts"
            / "workers"
            / "search.test.min.js"
        )
        self.index_path.parent.mkdir(parents=True)
        self.worker_path.parent.mkdir(parents=True)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_post_build_compacts_pages_and_keeps_navigation_keywords(self) -> None:
        course_path = self.docs_dir / "course" / "大学物理.md"
        course_path.parent.mkdir(parents=True)
        course_path.write_text(
            '=== ":material-book:`PHYS10013`"\n正文不应进入索引\n',
            encoding="utf-8",
        )

        encoded_location = quote("course/大学物理/", safe="/")
        index = {
            "config": {"lang": ["zh"], "separator": r"[\s\u200b\-]+"},
            "docs": [
                {
                    "location": encoded_location,
                    "title": "大学\u200b物理",
                    "text": "需要删除的正文",
                    "tags": ["课程", 2026],
                    "boost": 3,
                },
                {
                    "location": f"{encoded_location}#_1",
                    "title": "资源",
                    "text": "也需要删除的小节正文",
                },
            ],
        }
        self.index_path.write_text(json.dumps(index), encoding="utf-8")
        self.worker_path.write_text(
            f"prefix;{search_index.WORKER_SEGMENTER_BEFORE};suffix",
            encoding="utf-8",
        )

        search_index.on_post_build(
            {"site_dir": self.site_dir, "docs_dir": self.docs_dir}
        )

        result = json.loads(self.index_path.read_text(encoding="utf-8"))
        self.assertEqual(len(result["docs"]), 1)
        entry = result["docs"][0]
        self.assertEqual(entry["location"], encoded_location)
        self.assertEqual(entry["title"], "大学\u200b物理")
        self.assertEqual(entry["tags"], ["课程", 2026])
        self.assertEqual(entry["boost"], 3)
        self.assertEqual(
            entry["text"],
            "大学物理 课程 2026 PHYS10013",
        )
        self.assertNotIn("正文", entry["text"])
        self.assertNotIn("资源", entry["text"])

        worker = self.worker_path.read_text(encoding="utf-8")
        self.assertNotIn(search_index.WORKER_SEGMENTER_BEFORE, worker)
        self.assertEqual(worker.count(search_index.WORKER_SEGMENTER_AFTER), 1)

    def test_default_boost_slightly_prefers_the_shorter_exact_title(self) -> None:
        docs = [
            {"location": "course/physics/", "title": "大学物理", "text": ""},
            {
                "location": "course/physics-lab/",
                "title": "大学物理\u200b实验",
                "text": "",
            },
        ]

        entries = search_index._compact_entries(docs, self.docs_dir)

        self.assertGreater(entries[0]["boost"], entries[1]["boost"])
        self.assertLess(entries[0]["boost"], 1.25)

    def test_default_boost_prioritizes_course_pages_for_course_codes(self) -> None:
        course_source = self.docs_dir / "course" / "大学物理.md"
        plan_source = self.docs_dir / "academic" / "专业培养方案" / "化学.md"
        course_source.parent.mkdir(parents=True)
        plan_source.parent.mkdir(parents=True)
        course_source.write_text("`PHYS10013`", encoding="utf-8")
        plan_source.write_text("`PHYS10013`", encoding="utf-8")
        docs = [
            {
                "location": quote("course/大学物理/", safe="/"),
                "title": "大学物理",
                "text": "",
            },
            {
                "location": quote(
                    "academic/专业培养方案/化学/", safe="/"
                ),
                "title": "化学",
                "text": "",
            },
        ]

        entries = search_index._compact_entries(docs, self.docs_dir)

        self.assertGreater(entries[0]["boost"], entries[1]["boost"] * 5)
        self.assertIn("PHYS10013", entries[0]["text"])

    def test_nested_path_and_unicode_anchor_resolve_to_source(self) -> None:
        source = self.docs_dir / "academic" / "专业培养方案" / "物理学院" / "应用物理学.md"
        source.parent.mkdir(parents=True)
        source.write_text("课程 `PHYS20001`", encoding="utf-8")
        location = quote(
            "academic/专业培养方案/物理学院/应用物理学/", safe="/"
        )

        resolved = search_index._source_path_for_location(
            self.docs_dir, f"{location}#课程"
        )
        keywords = search_index._keywords_for_page(
            "应用\u200b物理学", None, self.docs_dir, resolved
        )

        self.assertEqual(resolved, source)
        self.assertEqual(
            keywords,
            ["应用物理学", "专业培养方案", "物理学院", "PHYS20001"],
        )

    def test_worker_patch_is_idempotent(self) -> None:
        self.worker_path.write_text(
            search_index.WORKER_SEGMENTER_AFTER,
            encoding="utf-8",
        )

        search_index._patch_search_worker(self.site_dir)

        self.assertEqual(
            self.worker_path.read_text(encoding="utf-8"),
            search_index.WORKER_SEGMENTER_AFTER,
        )

    def test_worker_patch_rejects_unknown_bundle(self) -> None:
        self.worker_path.write_text("unknown worker", encoding="utf-8")

        with self.assertRaisesRegex(RuntimeError, "pinned 9.6.13"):
            search_index._patch_search_worker(self.site_dir)

    def test_worker_patch_rejects_duplicate_marker(self) -> None:
        marker = search_index.WORKER_SEGMENTER_BEFORE
        self.worker_path.write_text(f"{marker};{marker}", encoding="utf-8")

        with self.assertRaisesRegex(RuntimeError, "unpatched=2"):
            search_index._patch_search_worker(self.site_dir)


if __name__ == "__main__":
    unittest.main()
