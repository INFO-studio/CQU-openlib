from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import clean_training_plans as plans
import update_site as update
from test_clean_training_plans import clean, row


class UpdateTests(unittest.TestCase):
    def test_sports_links_merge_without_changing_display_names(self):
        links = plans.CourseLinks(
            ["/course/体育", "/course/大学体育核心素质课", "/course/体育心理学"], {}
        )
        for name in (
            "大学体育核心素质课",
            "大学体育核心素质课（1）（英）",
            "体育自选项目1",
            "体育自选项目2",
            "体育自选项目3",
            "体育基础（1）",
            "体育概论",
            "学校体育学",
            "体育专业英语（1）",
        ):
            with self.subTest(name=name):
                data = clean(row(课程名称=name), links=links)
                record = data["records"][0]
                self.assertEqual(record["name"], name)
                self.assertEqual(record["course_page"], "/course/体育")
                self.assertEqual(record["raw_fields"]["课程名称"], name)
                self.assertEqual(update.course_page(name), "/course/体育")
                self.assertIn(
                    f"[{name}](../../../course/体育.md)", plans.render_course(record)
                )
        for name in ("体育心理学", "体育心理学（英）"):
            record = clean(row(课程名称=name), links=links)["records"][0]
            self.assertEqual(record["name"], name)
            self.assertEqual(record["course_page"], "/course/体育心理学")
        with TemporaryDirectory() as directory:
            root = Path(directory)
            old = root / "course/大学体育核心素质课.md"
            old.parent.mkdir()
            old.write_text(update.placeholder, encoding="utf-8")
            target = old.with_name("体育.md")
            target.write_text("## 资源\n体育资料\n", encoding="utf-8")
            self.assertEqual(update.obsolete_placeholders(root), {old: target})

    def test_placeholder_uses_core_name_for_all_variants(self):
        data = clean(
            row(课程名称="新课程I", 课程代码="N1"),
            row(课程名称="新课程II（英）", 课程代码="N2"),
        )
        update.complete_links(data["records"], plans.CourseLinks([], {}))
        self.assertEqual(
            {r["course_page"] for r in data["records"]}, {"/course/新课程"}
        )
        self.assertEqual({r["code"] for r in data["records"]}, {"N1", "N2"})
        self.assertEqual(
            {r["name"] for r in data["records"]}, {"新课程I", "新课程II（英）"}
        )

    def test_conflicting_code_uses_exact_name_without_picking_winner(self):
        links = plans.CourseLinks(
            ["/course/甲", "/course/乙"],
            {
                "courses": {
                    "/course/甲": {"codes": ["X"]},
                    "/course/乙": {"codes": ["X"]},
                }
            },
        )
        data = clean(row(课程名称="乙", 课程代码="X"), links=links)
        update.complete_links(data["records"], links)
        self.assertEqual(data["records"][0]["course_page"], "/course/乙")

    def test_dirty_metadata_does_not_recreate_dirty_pages(self):
        links = plans.CourseLinks(
            ["/course/新课程（英）"],
            {
                "courses": {
                    "/course/新课程（英）": {"codes": ["N1"]},
                }
            },
        )
        data = clean(row(课程名称="新课程（英）", 课程代码="N1"), links=links)
        update.complete_links(data["records"], links)
        self.assertEqual(data["records"][0]["course_page"], "/course/新课程")

    def test_path_safety_and_distinct_slash_names(self):
        data = clean(row(课程名称="甲/乙"), row(课程名称="甲／乙"))
        update.complete_links(data["records"], plans.CourseLinks([], {}))
        self.assertEqual(len({r["course_page"] for r in data["records"]}), 2)
        with self.assertRaises(ValueError):
            update.course_path(Path("/tmp/docs"), "/course/../../escape")
        for name in ("", "（英）", ".隐藏", "..", "index", "甲\n乙"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                update.course_page(name)
        for name in ("专业实习（校内／校外）（06981589）", "UI／UX设计（55d683c5）"):
            self.assertEqual(update.course_page(name), "/course/" + name)

    def test_writes_are_idempotent_preserve_resources_and_fill_broken_links(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            course = root / "course/已有.md"
            course.parent.mkdir()
            course.write_text("## 资源\n已有教材\n", encoding="utf-8")
            old_plan = root / "academic/专业培养方案/旧学院/旧专业.md"
            old_plan.parent.mkdir(parents=True)
            old_content = (
                "* [遗留（1）（英）](../../../course/遗留.md) - :l-book:`OLD1`\n"
            )
            old_plan.write_text(old_content, encoding="utf-8")
            links = plans.CourseLinks(["/course/已有"], {})
            data = clean(
                row(课程名称="已有"), row(课程名称="新课", 课程代码="NEW"), links=links
            )
            bundle: plans.Bundle = {
                **data,
                "markdown_previews": plans.render_previews(data["records"]),
            }
            pending = update.prepare_updates(bundle, root, links)
            self.assertNotIn(course, pending)
            self.assertNotIn(old_plan, pending)
            self.assertIn(root / "course/遗留.md", pending)
            self.assertIn(root / "course/新课.md", pending)
            self.assertGreater(update.write_updates(pending, "2026-09-15"), 0)
            self.assertEqual(update.write_updates(pending, "2026-09-16"), 0)
            self.assertEqual(old_plan.read_text(encoding="utf-8"), old_content)
            self.assertEqual(course.read_text(encoding="utf-8"), "## 资源\n已有教材\n")
            self.assertEqual(
                (root / "course/新课.md").read_text(encoding="utf-8"),
                update.placeholder,
            )
            self.assertNotIn("updated:", update.placeholder)
            self.assertNotIn(":l-book:", update.placeholder)

    def test_migration_normalizes_all_placeholders_and_preserves_actual_content(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            courses = root / "course"
            courses.mkdir()
            old = courses / "新课（1）（英）.md"
            old.write_text(update.placeholder, encoding="utf-8")
            canonical = courses / "新课.md"
            canonical.write_text("## 资源\n实际教材\n", encoding="utf-8")
            empty = courses / "空课.md"
            empty.write_text("", encoding="utf-8")
            old_style = courses / "旧占位.md"
            old_style.write_text(
                "---\nupdated: 2020-01-01\nplaceholder: course\n---\n", encoding="utf-8"
            )
            partial = courses / "另一门（2）.md"
            partial.write_text(
                update.placeholder + "\n已知教材：《书名》\n", encoding="utf-8"
            )
            old_plan = root / "academic/专业培养方案/旧学院/旧专业.md"
            old_plan.parent.mkdir(parents=True)
            old_plan.write_text(
                "* [新课（1）（英）](../../../course/新课（1）（英）.md) - :l-book:`N1`\n",
                encoding="utf-8",
            )
            article = root / "引用.md"
            article.write_text(
                "[新课](course/新课（1）（英）.md)\n[旧课](../course/新课%EF%BC%881%EF%BC%89%EF%BC%88英%EF%BC%89.md#资源)\n",
                encoding="utf-8",
            )
            links = plans.CourseLinks(["/course/新课"], {})
            data = clean(row(课程名称="新课（2）", 课程代码="N2"), links=links)
            bundle: plans.Bundle = {
                **data,
                "markdown_previews": plans.render_previews(data["records"]),
            }
            renames = update.obsolete_placeholders(root)
            self.assertEqual(renames, {old: canonical})
            pending = update.prepare_updates(bundle, root, links)
            update.write_updates(pending, "2026-09-15")
            self.assertEqual(update.prune_placeholders(renames), 1)
            self.assertFalse(old.exists())
            self.assertEqual(
                canonical.read_text(encoding="utf-8"), "## 资源\n实际教材\n"
            )
            self.assertIn("已知教材", partial.read_text(encoding="utf-8"))
            self.assertEqual(empty.read_text(encoding="utf-8"), update.placeholder)
            self.assertEqual(
                old_style.read_text(encoding="utf-8"),
                "---\nupdated: 2020-01-01\nplaceholder: course\n---\n",
            )
            self.assertIn(
                "[新课（1）（英）](../../../course/新课.md)",
                old_plan.read_text(encoding="utf-8"),
            )
            self.assertIn("[新课](course/新课.md)", article.read_text(encoding="utf-8"))
            self.assertIn("../course/新课.md#资源", article.read_text(encoding="utf-8"))
            self.assertEqual(
                update.write_updates(
                    update.prepare_updates(bundle, root, links), "2026-09-16"
                ),
                0,
            )

    def test_nested_placeholders_keep_their_directory_and_links(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            old = root / "course/非限课/基础德语（1）.md"
            old.parent.mkdir(parents=True)
            old.write_text(update.placeholder.rstrip(), encoding="utf-8")
            plain = old.parent / "其他课.md"
            plain.write_text(update.placeholder.rstrip(), encoding="utf-8")
            renames = update.obsolete_placeholders(root)
            target = old.parent / "基础德语.md"
            self.assertEqual(renames, {old: target})
            self.assertEqual(
                update.rewrite_course_links(
                    "[德语](../../../course/非限课/基础德语（1）.md)", renames
                ),
                "[德语](../../../course/非限课/基础德语.md)",
            )
            data = clean(row())
            bundle: plans.Bundle = {
                **data,
                "markdown_previews": plans.render_previews(data["records"]),
            }
            update.write_updates(
                update.prepare_updates(bundle, root, plans.CourseLinks([], {})),
                "2026-09-15",
            )
            self.assertEqual(plain.read_text(encoding="utf-8"), update.placeholder)
            self.assertEqual(target.read_text(encoding="utf-8"), update.placeholder)
            update.prune_placeholders(renames)
            self.assertEqual(update.obsolete_placeholders(root), {})

    def test_prune_refuses_changed_content_and_missing_target(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            old, new = root / "旧.md", root / "新.md"
            old.write_text(update.placeholder, encoding="utf-8")
            with self.assertRaises(ValueError):
                update.prune_placeholders({old: new})
            new.write_text(update.placeholder, encoding="utf-8")
            old.write_text("用户刚补充了资源", encoding="utf-8")
            with self.assertRaises(ValueError):
                update.prune_placeholders({old: new})
            self.assertTrue(old.exists())

    def test_frontmatter_preserves_title_and_description(self):
        previous = (
            "---\ntitle: 标题\ndescription: 描述\nupdated: 2020-01-01\n---\n\n旧正文"
        )
        updated = update.with_updated("新正文", previous, "2026-09-15")
        self.assertIn("title: 标题\ndescription: 描述", updated)
        self.assertIn("updated: 2026-09-15", updated)
        self.assertEqual(update.existing_body(updated), "新正文")

    def test_real_content_removes_placeholder_flag(self):
        previous = "---\nupdated: 2020-01-01\nplaceholder: course\n---\n"
        updated = update.with_updated("## 资源\n真实内容\n", previous, "2026-09-24")
        self.assertNotIn("placeholder:", updated)
        self.assertIn("updated: 2026-09-24", updated)
        self.assertEqual(update.existing_body(updated), "## 资源\n真实内容\n")


if __name__ == "__main__":
    unittest.main()
