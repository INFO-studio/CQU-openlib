from __future__ import annotations

import argparse
from datetime import date
import hashlib
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, unquote

import clean_training_plans as plans


ENTRY_RE = re.compile(r"\[((?:\\.|[^\]\\])+)\]\((.+?)\)\s*-\s*:l-book:(`+)(.+?)\3")
FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n\n?", re.S)
EMPTY_RESOURCES_RE = re.compile(
    r'\A## 资源\s*\n(?:=== ":l-book:`[^`]+`"\s*\n    暂无资料，欢迎贡献。\s*\n)+'
)
PLACEHOLDER = (
    '## 暂无数据，欢迎贡献\n'
    '!!! info "如果您知晓本门课程需要什么教材，欢迎[填表贡献](/form/textbook)，您只需要告知信息，并不必要持有pdf文件"\n'
    '\n'
    '- Github: [https://github.com/INFO-studio/CQU-openlib](https://github.com/INFO-studio/CQU-openlib)\n'
    '- 站长QQ: `2247977881`\n'
)


def course_path(doc_root: Path, page: str) -> Path:
    if not page.startswith("/course/"):
        raise ValueError(f"无效课程路径：{page}")
    target = doc_root / (page.lstrip("/") + ".md")
    if not target.resolve().is_relative_to((doc_root / "course").resolve()):
        raise ValueError(f"课程路径越界：{page}")
    return target


def course_page(name: str) -> str:
    suffix = ""
    if ("／" in name or "＼" in name) and (match := re.search(r"（[0-9a-f]{8}）$", name)):
        name, suffix = name[:match.start()], match[0]
    name = plans.simplify_course_name(name)
    safe_name = name.replace("/", "／").replace("\\", "＼")
    if not safe_name or safe_name in (".", "..", "index") or safe_name.startswith(".") or re.search(r"[\x00-\x1f]", safe_name):
        raise ValueError(f"无法生成课程文件名：{name!r}")
    if safe_name != name:
        suffix = "（" + hashlib.sha256(name.encode()).hexdigest()[:8] + "）"
    return "/course/" + safe_name + suffix


def is_placeholder(content: str) -> bool:
    body = existing_body(content)
    return not body.strip() or EMPTY_RESOURCES_RE.sub("", body).strip() == PLACEHOLDER.strip()


def with_updated(body: str, previous: str, updated: str) -> str:
    match = FRONTMATTER_RE.match(previous)
    metadata = match[1] if match else ""
    if re.search(r"(?m)^updated:.*$", metadata):
        metadata = re.sub(r"(?m)^updated:.*$", f"updated: {updated}", metadata)
    else:
        metadata = f"{metadata}\nupdated: {updated}".lstrip("\n")
    return f"---\n{metadata}\n---\n\n{body}"


def existing_body(content: str) -> str:
    return FRONTMATTER_RE.sub("", content, count=1)


def complete_links(records: list[plans.CourseRecord], links: plans.CourseLinks) -> None:
    for record in records:
        if record["course_page"]:
            continue
        name, code = record["name"], record["code"]
        if not name or not code:
            raise ValueError("生成课程页需要课程名称和课程号，缺失字段不能推测")
        record["course_page"] = course_page(name)


def obsolete_placeholders(doc_root: Path) -> dict[Path, Path]:
    renames: dict[Path, Path] = {}
    for path in sorted((doc_root / "course").rglob("*.md")):
        if path.stem == "index" or not is_placeholder(path.read_text(encoding="utf-8")):
            continue
        target = path.with_name(course_page(path.stem).removeprefix("/course/") + ".md")
        if target != path:
            renames[path] = target
    return renames


def rewrite_course_links(content: str, renames: dict[Path, Path]) -> str:
    names = {
        old.as_posix().split("/course/", 1)[1].removesuffix(".md"):
        new.as_posix().split("/course/", 1)[1].removesuffix(".md")
        for old, new in renames.items()
    }

    def replace(match: re.Match[str]) -> str:
        name = unquote(match[2])
        if name not in names:
            return match[0]
        target = "".join(quote(char, safe="/.-_~") if ord(char) < 128 else char for char in names[name])
        return match[1] + target + match[3]

    return re.sub(r"(\]\((?:[^\n)]*?/)?course/)([^\n]+?)(\.md(?:#[^\n)]*)?\))", replace, content)


def prepare_updates(bundle: plans.Bundle, doc_root: Path, links: plans.CourseLinks) -> dict[Path, str]:
    complete_links(bundle["records"], links)
    previews = plans.render_previews(bundle["records"])
    updates = {doc_root / relative: body for relative, body in previews.items()}
    renames = obsolete_placeholders(doc_root)
    required = set(renames.values())
    for record in bundle["records"]:
        page = record["course_page"]
        assert page is not None
        required.add(course_path(doc_root, page))
    plan_root = doc_root / "academic/专业培养方案"
    for path in sorted(doc_root.rglob("*.md")):
        if path in renames:
            continue
        previous = path.read_text(encoding="utf-8")
        body = updates.get(path, existing_body(previous))
        body = rewrite_course_links(body, renames)
        if path.is_relative_to(plan_root):
            for match in ENTRY_RE.finditer(body):
                href = unquote(match[2])
                if "/course/" in href:
                    page = "/course/" + href.split("/course/", 1)[1].removesuffix(".md")
                    required.add(course_path(doc_root, page))
        if path.is_relative_to(doc_root / "course") and is_placeholder(previous):
            body = PLACEHOLDER
        if body != existing_body(previous) or (body == PLACEHOLDER and previous != PLACEHOLDER):
            updates[path] = body
    for path in sorted(required):
        if not path.exists() or is_placeholder(path.read_text(encoding="utf-8")):
            updates[path] = PLACEHOLDER
    return updates


def write_updates(updates: dict[Path, str], updated: str) -> int:
    changed = 0
    for path, body in sorted(updates.items()):
        previous = path.read_text(encoding="utf-8") if path.exists() else ""
        if body == PLACEHOLDER:
            content = body
        elif existing_body(previous) == body:
            continue
        else:
            content = with_updated(body, previous, updated)
        if previous == content:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        changed += 1
    return changed


def prune_placeholders(renames: dict[Path, Path]) -> int:
    for old, new in renames.items():
        if not new.is_file() or not is_placeholder(old.read_text(encoding="utf-8")):
            raise ValueError(f"不能删除课程页：{old}")
    for old in renames:
        old.unlink()
    return len(renames)


def main() -> None:
    parser = argparse.ArgumentParser(description="预览或写入培养方案、统一课程占位页，并刷新课程号元数据。")
    parser.add_argument("--write", action="store_true", help="显式写入站点；默认只输出数量摘要")
    parser.add_argument("--prune-placeholders", action="store_true", help="删除已迁移到核心名称的旧纯占位页，需同时指定 --write")
    parser.add_argument("--date", default=date.today().isoformat(), help="内容更新日期 YYYY-MM-DD")
    parser.add_argument("--expect-rows", type=int)
    args = parser.parse_args()
    if args.prune_placeholders and not args.write:
        parser.error("--prune-placeholders 需要 --write")
    date.fromisoformat(args.date)
    bundle = plans.build_bundle()
    if args.expect_rows is not None and bundle["summary"]["input_rows"] != args.expect_rows:
        parser.error("输入行数不符，未写入站点")
    doc_root = plans.REPO_ROOT / "public/doc"
    links = plans.CourseLinks.from_repo(plans.REPO_ROOT)
    renames = obsolete_placeholders(doc_root)
    updates = prepare_updates(bundle, doc_root, links)
    summary = {
        **bundle["summary"],
        "course_placeholders": sum(path.is_relative_to(doc_root / "course") for path in updates),
        "obsolete_placeholders": len(renames),
        "planned_files": len(updates),
    }
    if args.write:
        summary["changed_files"] = write_updates(updates, args.date)
        if args.prune_placeholders:
            summary["removed_placeholders"] = prune_placeholders(renames)
        subprocess.run(["pnpm", "codes:extract"], cwd=plans.REPO_ROOT, check=True)
    print(plans.serialize(summary), end="")


if __name__ == "__main__":
    main()
