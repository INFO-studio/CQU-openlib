"""
Markdown生成器
从表单数据生成合规的Markdown文档
支持：试卷分组、教材子资源、课外资源结构化
"""

from typing import Dict, List, Tuple
from pathlib import Path
import sys
import re
import copy

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

EXAM_GROUP_ORDER = ["期中试卷", "期末试卷", "小测"]


class MarkdownGenerator:
    """Markdown文档生成器"""

    @staticmethod
    def _append_blank_line(lines: List[str]):
        """追加一个空行，并避免连续空行膨胀。"""
        if lines and lines[-1] == "":
            return
        lines.append("")

    @staticmethod
    def _is_markdown_list_line(line: str) -> bool:
        return bool(re.match(r"^\s*(?:[-*+]|\d+[.)])\s+", line.strip()))

    @staticmethod
    def _normalize_strategy_lines(strategy_lines: List[str]) -> List[str]:
        """规范攻略区列表，避免 Python-Markdown 把列表标记当普通文本。"""
        normalized = []

        for raw_line in strategy_lines:
            line = raw_line.rstrip()
            if not line.strip():
                MarkdownGenerator._append_blank_line(normalized)
                continue

            line = re.sub(r"^(\s*)-\s+", r"\1* ", line)
            is_list = MarkdownGenerator._is_markdown_list_line(line)
            is_top_level = len(line) == len(line.lstrip())

            if is_list and is_top_level and normalized:
                previous = next((item for item in reversed(normalized) if item), "")
                if previous and not MarkdownGenerator._is_markdown_list_line(previous):
                    MarkdownGenerator._append_blank_line(normalized)

            normalized.append(line + "  ")

        return normalized

    @staticmethod
    def generate_from_form_data(form_data: Dict) -> str:
        """
        从表单数据生成合规的Markdown文档

        Args:
            form_data: {
                "strategy_lines": ["攻略行1", "攻略行2"],
                "tabs": {
                    "MATH10821": {
                        "textbooks": [{...}],
                        "textbook_answers": [...],
                        "documents": [...],
                        "exam_groups": {
                            "期末试卷": [...],
                            "期中试卷": [...],
                            "小测": [...]
                        },
                        "online_courses": [...]
                    }
                },
                "other_sections": {
                    "课外资源": {
                        "textbooks": [...],
                        "textbook_answers": [...],
                        "documents": [...],
                        "online_courses": []
                    }
                }
            }

        Returns:
            合规的Markdown文本
        """
        lines = []

        lines.append("## 攻略  ")
        lines.append("")
        strategy_lines = form_data.get("strategy_lines", [])
        if strategy_lines:
            lines.extend(MarkdownGenerator._normalize_strategy_lines(strategy_lines))
        else:
            lines.append("* 暂无攻略，欢迎贡献  ")
        MarkdownGenerator._append_blank_line(lines)

        lines.append("## 资源  ")
        lines.append("")

        tabs = form_data.get("tabs", {})

        if not tabs:
            lines.append('=== ":material-book:`课程号`"  ')
            lines.append("")
            lines.append(
                "    * [教材]() - :material-format-quote-open:`教材名` - :material-account:`主编` - :material-printer:`出版社`  "
            )
            lines.append("    * 期末试卷")
            lines.append(
                "        * [试卷+答案]() - :material-calendar:`学期` - :material-domain:`学院` - :material-tag:`A卷`  "
            )
        else:
            for tab_index, (course_code, resources) in enumerate(tabs.items()):
                if tab_index > 0:
                    MarkdownGenerator._append_blank_line(lines)
                lines.append(f'=== ":material-book:`{course_code}`"  ')
                lines.append("")

                textbooks = resources.get("textbooks", [])
                for textbook in textbooks:
                    textbook_lines = MarkdownGenerator._generate_textbook_block(
                        textbook
                    )
                    lines.extend(textbook_lines)

                documents = resources.get("documents", [])
                for doc in documents:
                    line = MarkdownGenerator._generate_document_line(doc)
                    lines.append(line)

                exam_groups = resources.get("exam_groups", {})
                exam_group_lines = MarkdownGenerator._generate_exam_groups_block(
                    exam_groups
                )
                lines.extend(exam_group_lines)

                online_courses = resources.get("online_courses", [])
                if online_courses:
                    lines.append("    * 网课")
                    for online in online_courses:
                        line = MarkdownGenerator._generate_online_course_line(
                            online, indent_level=2
                        )
                        lines.append(line)

        other_sections = form_data.get("other_sections", {})
        for section_name, section_data in other_sections.items():
            if section_data:
                MarkdownGenerator._append_blank_line(lines)
                lines.append(f"## {section_name}  ")
                lines.append("")
                other_lines = MarkdownGenerator._generate_other_section_block(
                    section_data
                )
                lines.extend(other_lines)

        return "\n".join(lines) + "\n"

    @staticmethod
    def _generate_textbook_block(textbook: Dict, indent_level: int = 1) -> List[str]:
        """生成教材块（含子资源）"""
        lines = []
        indent = "    " * indent_level
        child_indent = "    " * (indent_level + 1)

        url = textbook.get("url", "")
        name = textbook.get("name", "")
        author = textbook.get("author", "")
        publisher = textbook.get("publisher", "")
        volume = textbook.get("volume", "")

        display_name = f"教材{volume}" if volume else "教材"

        parts = []
        link_part = f"[{display_name}]({url})"
        parts.append(link_part)

        if name:
            parts.append(f":material-format-quote-open:`{name}`")
        if author:
            parts.append(f":material-account:`{author}`")
        if publisher:
            parts.append(f":material-printer:`{publisher}`")

        lines.append(indent + "* " + " - ".join(parts) + "  ")

        children = textbook.get("children", [])
        for child in children:
            child_type = child.get("type", "")
            if child_type == "习题解答":
                child_url = child.get("url", "")
                child_name = child.get("name", "")
                contributor = child.get("contributor", "")
                has_link = child.get("has_contributor_link", False)

                if has_link and contributor:
                    contrib_part = f"@[{contributor}](../contributor/{contributor}.md)"
                elif contributor:
                    contrib_part = f"@{contributor}"
                else:
                    contrib_part = ""

                child_line = f"{child_indent}* [{child_name}]({child_url})"
                if contrib_part:
                    child_line += f" {contrib_part}"
                child_line += "  "
                lines.append(child_line)
            elif child_type == "备注":
                child_text = child.get("text", "")
                lines.append(f"{child_indent}* {child_text}  ")

        return lines

    @staticmethod
    def _generate_document_line(doc: Dict, indent_level: int = 1) -> str:
        """生成文档行"""
        indent = "    " * indent_level
        url = doc.get("url", "")
        name = doc.get("name", "")
        contributor = doc.get("contributor", "")
        has_contributor_link = doc.get("has_contributor_link", False)

        if has_contributor_link and contributor:
            contributor_part = f"@[{contributor}](../contributor/{contributor}.md)"
        else:
            contributor_part = f"@{contributor}" if contributor else ""

        parts = []
        link_part = f"[文档]({url})"
        parts.append(link_part)

        if name:
            parts.append(f":material-file-document:`{name}`")
        if contributor_part:
            parts.append(contributor_part)

        return indent + "* " + " - ".join(parts) + "  "

    @staticmethod
    def _generate_exam_groups_block(
        exam_groups: Dict, indent_level: int = 1
    ) -> List[str]:
        """生成试卷分组块"""
        lines = []
        indent = "    " * indent_level

        for group_name in EXAM_GROUP_ORDER:
            exams = exam_groups.get(group_name, [])
            if not exams:
                continue

            lines.append(f"{indent}* {group_name}")
            for exam in exams:
                exam_lines = MarkdownGenerator._generate_exam_lines(
                    exam, indent_level + 1
                )
                lines.extend(exam_lines)

        return lines

    @staticmethod
    def _build_contributor_suffix(
        contributor: str,
        has_link: bool = False,
        contributor_url: str = "",
    ) -> str:
        if not contributor:
            return ""
        if has_link:
            return f" @[{contributor}](../contributor/{contributor}.md)"
        if contributor_url:
            return f" @[{contributor}]({contributor_url})"
        return f" @{contributor}"

    @staticmethod
    def _collect_exam_children(exam: Dict) -> List[Dict]:
        children = exam.get("children") or exam.get("subresources") or []
        if children:
            return [child for child in children if child]

        video_url = exam.get("video_url", "")
        if not video_url:
            return []

        return [
            {
                "type": "讲解视频",
                "name": "讲解视频",
                "url": video_url,
                "contributor": exam.get("video_contributor", ""),
                "has_contributor_link": exam.get("has_video_contributor_link", False),
                "contributor_url": exam.get("video_contributor_url", ""),
            }
        ]

    @staticmethod
    def _generate_exam_child_line(child: Dict, indent: str) -> str:
        child_type = child.get("type", "")
        text = child.get("text", "")

        if child_type == "备注" and text:
            return f"{indent}* {text}  "

        name = (
            child.get("name")
            or child.get("title")
            or ("讲解视频" if child_type == "讲解视频" else "")
            or child_type
            or "子资源"
        )
        url = child.get("url") or child.get("video_url") or child.get("course_url", "")
        contributor = child.get("contributor") or child.get("video_contributor", "")
        has_link = child.get("has_contributor_link") or child.get(
            "has_video_contributor_link", False
        )
        contributor_url = child.get("contributor_url") or child.get(
            "video_contributor_url", ""
        )

        if url:
            line = f"{indent}* [{name}]({url})"
        else:
            line = f"{indent}* {name}"

        line += MarkdownGenerator._build_contributor_suffix(
            contributor, has_link, contributor_url
        )
        return line + "  "

    @staticmethod
    def _generate_exam_lines(exam: Dict, indent_level: int = 2) -> List[str]:
        """生成试卷行（含多个子资源）"""
        lines = []
        indent = "    " * indent_level
        child_indent = "    " * (indent_level + 1)

        url = exam.get("url", "")
        name = exam.get("name", "试卷+答案")
        semester = exam.get("semester", "")
        college = exam.get("college", "")
        paper_type = exam.get("paper_type", "A卷")

        parts = []
        link_part = f"[{name}]({url})"
        parts.append(link_part)

        if semester:
            parts.append(f":material-calendar:`{semester}`")
        if college:
            parts.append(f":material-domain:`{college}`")
        if paper_type:
            parts.append(f":material-tag:`{paper_type}`")

        lines.append(indent + "* " + " - ".join(parts) + "  ")

        for child in MarkdownGenerator._collect_exam_children(exam):
            lines.append(
                MarkdownGenerator._generate_exam_child_line(child, child_indent)
            )

        return lines

    @staticmethod
    def _generate_online_course_line(online: Dict, indent_level: int = 1) -> str:
        """生成网课行"""
        indent = "    " * indent_level
        course_url = online.get("course_url", "")
        course_name = online.get("course_name", "")
        contributor = online.get("contributor", "")
        has_contributor_link = online.get("has_contributor_link", False)

        if has_contributor_link and contributor:
            contributor_part = f"@[{contributor}](../contributor/{contributor}.md)"
        else:
            contributor_part = f"@{contributor}" if contributor else ""

        if course_url:
            line = f"{indent}* [{course_name}]({course_url}) {contributor_part}  "
        else:
            line = f"{indent}* {course_name} {contributor_part}  "

        return line

    @staticmethod
    def _generate_other_section_block(section_data: Dict) -> List[str]:
        """生成课外资源块"""
        lines = []

        textbooks = section_data.get("textbooks", [])
        for textbook in textbooks:
            textbook_lines = MarkdownGenerator._generate_textbook_block(
                textbook, indent_level=0
            )
            lines.extend(textbook_lines)

        documents = section_data.get("documents", [])
        for doc in documents:
            line = MarkdownGenerator._generate_document_line(doc, indent_level=0)
            lines.append(line)

        online_courses = section_data.get("online_courses", [])
        for online in online_courses:
            line = MarkdownGenerator._generate_online_course_line(
                online, indent_level=0
            )
            lines.append(line)

        return lines

    @staticmethod
    def parse_to_form_data(markdown_content: str) -> Tuple[Dict, List[str]]:
        """
        将Markdown内容解析为表单数据

        Returns:
            (form_data, issues): 表单数据和问题列表
        """
        lines = markdown_content.split("\n")
        issues = []

        form_data = {"strategy_lines": [], "tabs": {}, "other_sections": {}}

        current_section = None
        current_section_name = ""
        current_tab_code = None
        current_exam_group = None
        current_exam = None
        current_textbook = None
        current_parent = None
        line_num = 0

        for idx, line in enumerate(lines, start=1):
            line_num = idx
            stripped = line.strip()

            if stripped.startswith("## 攻略"):
                current_section = "strategy"
                current_section_name = "攻略"
                continue

            if stripped.startswith("## 资源"):
                current_section = "resource"
                current_section_name = "资源"
                current_exam_group = None
                current_textbook = None
                continue

            if stripped.startswith("## ") and stripped not in [
                "## 攻略",
                "## 攻略  ",
                "## 资源",
                "## 资源  ",
            ]:
                section_name = stripped[3:].strip()
                current_section = "other"
                current_section_name = section_name
                if section_name not in form_data["other_sections"]:
                    form_data["other_sections"][section_name] = {
                        "textbooks": [],
                        "documents": [],
                        "online_courses": [],
                    }
                continue

            if current_section == "strategy":
                if stripped and not stripped.startswith("##"):
                    form_data["strategy_lines"].append(line.rstrip() + "  ")
                continue

            if current_section == "other":
                MarkdownGenerator._parse_other_section_line(
                    line, stripped, form_data, current_section_name, issues, line_num
                )
                continue

            if current_section == "resource":
                if stripped.startswith('=== ":material-book:`'):
                    match = stripped
                    start = match.find("`") + 1
                    end = match.rfind("`")
                    if start < end:
                        current_tab_code = match[start:end]
                        if current_tab_code not in form_data["tabs"]:
                            form_data["tabs"][current_tab_code] = {
                                "textbooks": [],
                                "documents": [],
                                "exam_groups": {},
                                "online_courses": [],
                            }
                        current_exam_group = None
                        current_textbook = None
                    continue

                if not current_tab_code:
                    continue

                indent = len(line) - len(line.lstrip())

                if line.startswith("    * ") and not line.startswith("        * "):
                    content = stripped[2:].strip()

                    if (
                        current_parent == "网课"
                        and "[" in content
                        and "](" in content
                        and "[教材" not in stripped
                        and "[文档]" not in stripped
                    ):
                        online_data = MarkdownGenerator._parse_online_course_line(
                            stripped
                        )
                        if online_data:
                            form_data["tabs"][current_tab_code][
                                "online_courses"
                            ].append(online_data)
                        continue

                    current_parent = content

                    if content in EXAM_GROUP_ORDER:
                        current_exam_group = content
                        if (
                            current_exam_group
                            not in form_data["tabs"][current_tab_code]["exam_groups"]
                        ):
                            form_data["tabs"][current_tab_code]["exam_groups"][
                                current_exam_group
                            ] = []
                        current_textbook = None
                        current_exam = None
                    elif content == "网课":
                        current_exam_group = None
                        current_textbook = None
                        current_exam = None
                    elif "[教材解答]" in stripped:
                        issues.append(
                            f"第 {line_num} 行：'[教材解答]' 格式已废弃，请改为教材子资源"
                        )
                        current_exam_group = None
                        current_textbook = None
                        current_exam = None
                    elif "[文档]" in stripped:
                        current_exam_group = None
                        current_textbook = None
                        current_exam = None
                        doc_data = MarkdownGenerator._parse_document_line(stripped)
                        if doc_data:
                            form_data["tabs"][current_tab_code]["documents"].append(
                                doc_data
                            )
                    elif "[教材" in stripped:
                        current_exam_group = None
                        textbook_data = MarkdownGenerator._parse_textbook_line(stripped)
                        if textbook_data:
                            textbook_data["children"] = []
                            form_data["tabs"][current_tab_code]["textbooks"].append(
                                textbook_data
                            )
                            current_textbook = textbook_data
                            current_exam = None
                    else:
                        current_exam_group = None
                        current_textbook = None
                        current_exam = None
                    continue

                if line.startswith("        * ") and not line.startswith(
                    "            * "
                ):
                    content = stripped[2:].strip()

                    if current_exam_group:
                        if "[" in content and "]" in content and "(" in content:
                            exam_data = MarkdownGenerator._parse_exam_line(stripped)
                            if exam_data and not exam_data.get("is_video"):
                                form_data["tabs"][current_tab_code]["exam_groups"][
                                    current_exam_group
                                ].append(exam_data)
                                current_exam = exam_data
                            elif exam_data.get("is_video"):
                                issues.append(
                                    f"第 {line_num} 行：'[讲解视频]' 应为试卷子资源（三级缩进），请修改文档格式"
                                )
                        else:
                            issues.append(
                                f"第 {line_num} 行：试卷分组 '{current_exam_group}' 下存在非标准格式条目"
                            )
                    elif current_textbook:
                        if "[" in content and "](" in content:
                            link_match = re.search(r"\[([^\]]+)\]\(([^)]+)\)", stripped)
                            if link_match:
                                child_data = {
                                    "type": "习题解答",
                                    "name": link_match.group(1),
                                    "url": link_match.group(2),
                                }
                                key_match = re.search(
                                    r"key=([A-Za-z0-9]{12})", child_data["url"]
                                )
                                if key_match:
                                    child_data["key"] = key_match.group(1)

                                contributor_match = re.search(
                                    r"@\[?([^\]\s@]+)\]?(?:\(([^)]+)\))?", stripped
                                )
                                if contributor_match:
                                    child_data["contributor"] = contributor_match.group(
                                        1
                                    )
                                    if contributor_match.group(2):
                                        contributor_url = contributor_match.group(2)
                                        if contributor_url.startswith(
                                            "../contributor/"
                                        ):
                                            child_data["has_contributor_link"] = True
                                        else:
                                            child_data["contributor_url"] = (
                                                contributor_url
                                            )

                                current_textbook["children"].append(child_data)
                        else:
                            child_data = {"type": "备注", "text": content}
                            current_textbook["children"].append(child_data)
                    elif current_parent and "网课" in current_parent:
                        online_data = MarkdownGenerator._parse_online_course_line(
                            stripped
                        )
                        if online_data:
                            form_data["tabs"][current_tab_code][
                                "online_courses"
                            ].append(online_data)
                    else:
                        issues.append(
                            f"第 {line_num} 行：二级列表项 '{content[:30]}...' 缺少归属父项"
                        )
                    continue

                if line.startswith("            * "):
                    content = stripped[2:].strip()

                    if current_exam:
                        child_data = MarkdownGenerator._parse_exam_child_line(stripped)
                        if child_data:
                            current_exam.setdefault("children", []).append(child_data)
                            MarkdownGenerator._sync_legacy_exam_child(
                                current_exam, child_data
                            )
                    elif current_textbook:
                        issues.append(
                            f"第 {line_num} 行：教材子项应为二级缩进（8空格），请修改文档格式"
                        )
                    elif current_parent and "网课" in current_parent:
                        pass
                    else:
                        issues.append(
                            f"第 {line_num} 行：三级列表项 '{content[:30]}...' 缺少归属父项"
                        )
                    continue

        return form_data, issues

    @staticmethod
    def _parse_exam_child_line(line: str) -> Dict:
        """解析试卷子资源行，支持讲解视频和任意链接资源。"""
        content = line.strip()
        if content.startswith("* "):
            content = content[2:].strip()

        link_match = re.search(r"\[([^\]]+)\]\(([^)]+)\)", content)
        if not link_match:
            return {"type": "备注", "text": content} if content else {}

        name = link_match.group(1)
        url = link_match.group(2)
        data = {
            "type": "讲解视频" if name == "讲解视频" else "子资源",
            "name": name,
            "url": url,
        }

        key_match = re.search(r"key=([A-Za-z0-9]{12})", url)
        if key_match:
            data["key"] = key_match.group(1)

        contributor_match = re.search(r"@\[?([^\]\s@]+)\]?(?:\(([^)]+)\))?", content)
        if contributor_match:
            data["contributor"] = contributor_match.group(1)
            if contributor_match.group(2):
                contributor_url = contributor_match.group(2)
                if contributor_url.startswith("../contributor/"):
                    data["has_contributor_link"] = True
                else:
                    data["contributor_url"] = contributor_url

        return data

    @staticmethod
    def _sync_legacy_exam_child(exam: Dict, child: Dict):
        """把第一个讲解视频同步到旧字段，兼容旧 UI/脚本。"""
        if child.get("name") != "讲解视频" or exam.get("video_url"):
            return

        exam["video_url"] = child.get("url", "")
        exam["video_contributor"] = child.get("contributor", "")
        if child.get("has_contributor_link"):
            exam["has_video_contributor_link"] = True
        if child.get("contributor_url"):
            exam["video_contributor_url"] = child.get("contributor_url", "")

    @staticmethod
    def _parse_other_section_line(
        line: str,
        stripped: str,
        form_data: Dict,
        section_name: str,
        issues: List[str],
        line_num: int,
    ):
        """解析课外资源行"""
        if not stripped:
            return

        is_top_level = (line.startswith("* ") and not line.startswith("    * ")) or (
            line.startswith("    * ") and not line.startswith("        * ")
        )
        is_child_level = line.startswith("    * ") or line.startswith("        * ")

        if is_top_level:
            content = stripped[2:].strip()

            if "[教材" in stripped:
                textbook_data = MarkdownGenerator._parse_textbook_line(stripped)
                if textbook_data:
                    textbook_data["children"] = []
                    form_data["other_sections"][section_name]["textbooks"].append(
                        textbook_data
                    )
            elif "[教材解答]" in stripped:
                issues.append(
                    f"第 {line_num} 行：'[教材解答]' 格式已废弃，请改为教材子资源"
                )
            elif "[文档]" in stripped:
                doc_data = MarkdownGenerator._parse_document_line(stripped)
                if doc_data:
                    form_data["other_sections"][section_name]["documents"].append(
                        doc_data
                    )
            elif "[" in content and "](" in content:
                link_match = re.search(r"\[([^\]]+)\]\(([^)]*)\)", stripped)
                if link_match:
                    link_name = link_match.group(1)
                    link_url = link_match.group(2)

                    contributor_match = re.search(
                        r"@\[?([^\]\s@]+)\]?(?:\(([^)]+)\))?", stripped
                    )
                    contributor = (
                        contributor_match.group(1) if contributor_match else ""
                    )
                    contributor_url = (
                        contributor_match.group(2)
                        if contributor_match and contributor_match.group(2)
                        else ""
                    )

                    doc_data = {
                        "type": "document",
                        "name": link_name,
                        "url": link_url,
                        "contributor": contributor,
                    }
                    if contributor_url:
                        if contributor_url.startswith("../contributor/"):
                            doc_data["has_contributor_link"] = True
                        else:
                            doc_data["contributor_url"] = contributor_url

                    key_match = re.search(r"key=([A-Za-z0-9]{12})", link_url)
                    if key_match:
                        doc_data["key"] = key_match.group(1)
                    form_data["other_sections"][section_name]["documents"].append(
                        doc_data
                    )
            elif stripped.startswith("-"):
                doc_data = {
                    "type": "document",
                    "name": content[1:].strip() if content.startswith("-") else content,
                    "url": "",
                    "contributor": "",
                }
                form_data["other_sections"][section_name]["documents"].append(doc_data)
        elif is_child_level:
            content = stripped[2:].strip()
            textbooks = form_data["other_sections"][section_name]["textbooks"]
            if textbooks:
                last_textbook = textbooks[-1]
                if "[" in content and "](" in content:
                    link_match = re.search(r"\[([^\]]+)\]\(([^)]+)\)", stripped)
                    if link_match:
                        child_data = {
                            "type": "习题解答",
                            "name": link_match.group(1),
                            "url": link_match.group(2),
                        }
                        key_match = re.search(
                            r"key=([A-Za-z0-9]{12})", child_data["url"]
                        )
                        if key_match:
                            child_data["key"] = key_match.group(1)

                        contributor_match = re.search(
                            r"@\[?([^\]\s@]+)\]?(?:\(([^)]+)\))?", stripped
                        )
                        if contributor_match:
                            child_data["contributor"] = contributor_match.group(1)
                            if contributor_match.group(2):
                                contributor_url = contributor_match.group(2)
                                if contributor_url.startswith("../contributor/"):
                                    child_data["has_contributor_link"] = True
                                else:
                                    child_data["contributor_url"] = contributor_url

                        last_textbook["children"].append(child_data)
                else:
                    child_data = {"type": "备注", "text": content}
                    last_textbook["children"].append(child_data)

    @staticmethod
    def _parse_textbook_line(line: str) -> Dict:
        """解析教材行"""
        data = {"type": "textbook"}

        link_match = re.search(r"\[教材([^]]*)\]\(([^)]+)\)", line)
        if link_match:
            volume = link_match.group(1).strip()
            if volume:
                data["volume"] = volume
            url = link_match.group(2)
            data["url"] = url

            key_match = re.search(r"key=([A-Za-z0-9]{12})", url)
            if key_match:
                data["key"] = key_match.group(1)

        name_match = re.search(r":material-format-quote-open:`([^`]+)`", line)
        if name_match:
            data["name"] = name_match.group(1)

        author_match = re.search(r":material-account:`([^`]+)`", line)
        if author_match:
            data["author"] = author_match.group(1)

        publisher_match = re.search(r":material-printer:`([^`]+)`", line)
        if publisher_match:
            data["publisher"] = publisher_match.group(1)

        return data

    @staticmethod
    def _parse_exam_line(line: str) -> Dict:
        """解析试卷行"""
        data = {"type": "exam"}

        if "讲解视频" in line:
            data["is_video"] = True
            link_match = re.search(r"\[讲解视频\]\(([^)]+)\)", line)
            if link_match:
                data["video_url"] = link_match.group(1)
                key_match = re.search(r"key=([A-Za-z0-9]{12})", data["video_url"])
                if key_match:
                    data["video_key"] = key_match.group(1)

            contributor_match = re.search(r"@\[?([^\]\s@]+)\]?(?:\(([^)]+)\))?", line)
            if contributor_match:
                data["video_contributor"] = contributor_match.group(1)
                if contributor_match.group(2):
                    contributor_url = contributor_match.group(2)
                    if contributor_url.startswith("../contributor/"):
                        data["has_video_contributor_link"] = True
                    else:
                        data["video_contributor_url"] = contributor_url
            return data

        link_match = re.search(r"\[([^]]+)\]\(([^)]+)\)", line)
        if link_match:
            data["name"] = link_match.group(1)
            url = link_match.group(2)
            data["url"] = url

            key_match = re.search(r"key=([A-Za-z0-9]{12})", url)
            if key_match:
                data["key"] = key_match.group(1)

        semester_match = re.search(r":material-calendar:`([^`]+)`", line)
        if semester_match:
            data["semester"] = semester_match.group(1)

        college_match = re.search(r":material-domain:`([^`]+)`", line)
        if college_match:
            data["college"] = college_match.group(1)

        type_match = re.search(r":material-tag:`([^`]+)`", line)
        if type_match:
            data["paper_type"] = type_match.group(1)

        return data

    @staticmethod
    def _parse_document_line(line: str) -> Dict:
        """解析文档行"""
        data = {"type": "document"}

        link_match = re.search(r"\[文档\]\(([^)]*)\)", line)
        if link_match:
            url = link_match.group(1)
            data["url"] = url

            key_match = re.search(r"key=([A-Za-z0-9]{12})", url)
            if key_match:
                data["key"] = key_match.group(1)

        name_match = re.search(r":material-file-document:`([^`]+)`", line)
        if name_match:
            data["name"] = name_match.group(1)

        contributor_match = re.search(r"@\[?([^\]\s@]+)\]?(?:\(([^)]+)\))?", line)
        if contributor_match:
            data["contributor"] = contributor_match.group(1)
            if contributor_match.group(2):
                contributor_url = contributor_match.group(2)
                if contributor_url.startswith("../contributor/"):
                    data["has_contributor_link"] = True
                else:
                    data["contributor_url"] = contributor_url

        return data

    @staticmethod
    def _parse_online_course_line(line: str) -> Dict:
        """解析网课行"""
        data = {"type": "online_course"}

        link_match = re.search(r"\[([^]]+)\]\(([^)]+)\)", line)
        if link_match:
            data["course_name"] = link_match.group(1)
            url = link_match.group(2)
            data["course_url"] = url

            key_match = re.search(r"key=([A-Za-z0-9]{12})", url)
            if key_match:
                data["key"] = key_match.group(1)

        contributor_match = re.search(r"@\[?([^\]\s@]+)\]?(?:\(([^)]+)\))?", line)
        if contributor_match:
            data["contributor"] = contributor_match.group(1)
            if contributor_match.group(2):
                contributor_url = contributor_match.group(2)
                if contributor_url.startswith("../contributor/"):
                    data["has_contributor_link"] = True
                else:
                    data["contributor_url"] = contributor_url

        return data
