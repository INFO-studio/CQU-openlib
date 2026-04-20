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
        strategy_lines = form_data.get("strategy_lines", [])
        if strategy_lines:
            for strategy_line in strategy_lines:
                if strategy_line.strip():
                    lines.append(strategy_line)
        else:
            lines.append("- 暂无攻略，欢迎贡献")
        lines.append("")

        lines.append("## 资源  ")

        tabs = form_data.get("tabs", {})

        if not tabs:
            lines.append('=== ":material-book:`课程号`"  ')
            lines.append(
                "    * [教材]() - :material-format-quote-open:`教材名` - :material-account:`主编` - :material-printer:`出版社`  "
            )
            lines.append("    * 期末试卷")
            lines.append(
                "        * [试卷+答案]() - :material-calendar:`学期` - :material-domain:`学院` - :material-tag:`A卷`  "
            )
        else:
            for course_code, resources in tabs.items():
                lines.append(f'=== ":material-book:`{course_code}`"  ')

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
                        line = MarkdownGenerator._generate_online_course_line(online)
                        lines.append(line)

        other_sections = form_data.get("other_sections", {})
        for section_name, section_data in other_sections.items():
            if section_data:
                lines.append("")
                lines.append(f"## {section_name}  ")
                other_lines = MarkdownGenerator._generate_other_section_block(
                    section_data
                )
                lines.extend(other_lines)

        return "\n".join(lines) + "\n"

    @staticmethod
    def _generate_textbook_block(textbook: Dict) -> List[str]:
        """生成教材块（含子资源）"""
        lines = []

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

        lines.append("    * " + " - ".join(parts) + "  ")

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

                child_line = f"        * [{child_name}]({child_url})"
                if contrib_part:
                    child_line += f" {contrib_part}"
                child_line += "  "
                lines.append(child_line)
            elif child_type == "备注":
                child_text = child.get("text", "")
                lines.append(f"        * {child_text}  ")

        return lines

    @staticmethod
    def _generate_document_line(doc: Dict) -> str:
        """生成文档行"""
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

        return "    * " + " - ".join(parts) + "  "

    @staticmethod
    def _generate_exam_groups_block(exam_groups: Dict) -> List[str]:
        """生成试卷分组块"""
        lines = []

        for group_name in EXAM_GROUP_ORDER:
            exams = exam_groups.get(group_name, [])
            if not exams:
                continue

            lines.append(f"    * {group_name}")
            for exam in exams:
                exam_lines = MarkdownGenerator._generate_exam_lines(exam)
                lines.extend(exam_lines)

        return lines

    @staticmethod
    def _generate_exam_lines(exam: Dict) -> List[str]:
        """生成试卷行（含视频链接）"""
        lines = []

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

        lines.append("        * " + " - ".join(parts) + "  ")

        video_url = exam.get("video_url", "")
        video_contributor = exam.get("video_contributor", "")
        has_video_contributor_link = exam.get("has_video_contributor_link", False)

        if video_url:
            video_line = f"            * [讲解视频]({video_url})"
            if video_contributor:
                if has_video_contributor_link:
                    video_line += f" @[{video_contributor}](../contributor/{video_contributor}.md)"
                else:
                    video_line += f" @{video_contributor}"
            video_line += "  "
            lines.append(video_line)

        return lines

    @staticmethod
    def _generate_online_course_line(online: Dict) -> str:
        """生成网课行"""
        platform = online.get("platform", "")
        course_url = online.get("course_url", "")
        course_name = online.get("course_name", "")
        contributor = online.get("contributor", "")
        has_contributor_link = online.get("has_contributor_link", False)

        if has_contributor_link and contributor:
            contributor_part = f"@[{contributor}](../contributor/{contributor}.md)"
        else:
            contributor_part = f"@{contributor}" if contributor else ""

        if platform and course_url:
            line = f"        * [{course_name}]({course_url}) {contributor_part}  "
        else:
            line = f"        * {course_name} {contributor_part}  "

        return line

    @staticmethod
    def _generate_other_section_block(section_data: Dict) -> List[str]:
        """生成课外资源块"""
        lines = []

        textbooks = section_data.get("textbooks", [])
        for textbook in textbooks:
            textbook_lines = MarkdownGenerator._generate_textbook_block(textbook)
            lines.extend(textbook_lines)

        documents = section_data.get("documents", [])
        for doc in documents:
            line = MarkdownGenerator._generate_document_line(doc)
            lines.append(line)

        online_courses = section_data.get("online_courses", [])
        for online in online_courses:
            line = f"    * [{online.get('course_name', '')}]({online.get('course_url', '')})"
            contributor = online.get("contributor", "")
            if contributor:
                line += f" @{contributor}"
            line += "  "
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

                    if current_exam and "[讲解视频]" in stripped:
                        video_data = MarkdownGenerator._parse_exam_line(stripped)
                        if video_data and video_data.get("is_video"):
                            current_exam["video_url"] = video_data.get("video_url", "")
                            current_exam["video_contributor"] = video_data.get(
                                "video_contributor", ""
                            )
                            if video_data.get("has_video_contributor_link"):
                                current_exam["has_video_contributor_link"] = True
                            elif video_data.get("video_contributor_url"):
                                current_exam["video_contributor_url"] = video_data.get(
                                    "video_contributor_url", ""
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

        if line.startswith("    * ") and not line.startswith("        * "):
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
            elif "[" in content and "](" in content:
                link_match = re.search(r"\[([^\]]+)\]\(([^)]+)\)", stripped)
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
        elif line.startswith("        * "):
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

        link_match = re.search(r"\[文档\]\(([^)]+)\)", line)
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
