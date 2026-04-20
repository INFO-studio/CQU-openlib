"""
文档修改器模块
负责在文档中添加、修改、删除资源条目
"""

import re
from pathlib import Path
from typing import Optional, List, Tuple
from dataclasses import dataclass

from parser import DocumentParser, DocumentStructure, TabBlock, ListItem
from validator import DocumentValidator
from workspace import WorkspaceManager
from config import RESOURCE_TEMPLATES
from utils import build_api_url, extract_lanzou_key


@dataclass
class ResourceInfo:
    """资源信息"""

    name: str
    url: str
    book_name: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    semester: Optional[str] = None
    paper_type: Optional[str] = None
    contributor_name: Optional[str] = None
    contributor_url: Optional[str] = None


class DocumentModifier:
    """文档修改器"""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.workspace = WorkspaceManager()
        self.parser = DocumentParser(str(file_path))
        self.structure: Optional[DocumentStructure] = None
        self.validator: Optional[DocumentValidator] = None

    def load_and_validate(self) -> Tuple[bool, List[str]]:
        """
        加载并校验文档

        Returns:
            (is_valid, errors)
        """
        self.structure = self.parser.parse()
        self.validator = DocumentValidator(self.structure)
        is_valid = self.validator.validate()
        return is_valid, self.structure.validation_errors

    def _ensure_valid(self):
        """确保文档已加载并校验"""
        if self.structure is None:
            self.load_and_validate()

    def _normalize_lines(self) -> List[str]:
        """规范化文档行（处理占位符文档）"""
        if self.structure is None:
            return []
        lines = self.structure.lines

        first_10 = "\n".join(lines[:10])
        placeholder_keywords = [
            "暂无数据",
            "欢迎贡献",
            "如果您知晓本门课程需要什么教材",
        ]

        if any(k in first_10 for k in placeholder_keywords):
            lines = ["## 攻略  ", "- 暂无攻略，欢迎贡献", "", "## 资源  ", ""]

        normalized = []
        i = 0
        while i < len(lines) and lines[i].strip() == "":
            i += 1

        while i < len(lines):
            raw = lines[i]
            s = raw.lstrip()

            if s.startswith("##") and "资源" in s:
                normalized.append("## 资源  ")
                i += 1
                while i < len(lines) and lines[i].strip() == "":
                    i += 1
                continue

            if re.match(r'^===\s*":material-book:`[^`]+`"', s):
                first = s.find("`")
                last = s.rfind("`")
                if first != -1 and last != -1 and last > first:
                    code = s[first + 1 : last]
                    normalized.append(f'=== ":material-book:`{code}`"  ')
                else:
                    normalized.append('=== ":material-book:``"  ')
                i += 1
                while i < len(lines) and lines[i].strip() == "":
                    i += 1
                continue

            normalized.append(raw)
            i += 1

        return normalized

    def add_textbook(
        self,
        course_code: str,
        key: str,
        textbook_name: str,
        author: str,
        publisher: str,
        volume: Optional[str] = None,
    ) -> bool:
        """
        添加教材资源

        Args:
            course_code: 课程编号
            key: 蓝奏云密钥
            textbook_name: 教材名
            author: 主编
            publisher: 出版社
            volume: 上册/下册

        Returns:
            是否成功
        """
        self._ensure_valid()

        if self.structure is None or not self.structure.is_valid:
            return False

        lines = self._normalize_lines()
        api_url = build_api_url(key)

        volume_str = volume if volume else ""
        resource_line = f"    * [教材{volume_str}]({api_url}) - :material-format-quote-open:`{textbook_name}` - :material-account:`{author}` - :material-printer:`{publisher}`  "

        tab_header = f'=== ":material-book:`{course_code}`"  '

        if not any(l.strip().startswith("## 资源") for l in lines):
            lines.extend(["", "## 资源  ", ""])

        tab_found = False
        insert_at = -1

        for i, line in enumerate(lines):
            if line.strip().startswith(f'=== ":material-book:`{course_code}`'):
                tab_found = True
                scan = i + 1
                last_textbook_line = None

                while scan < len(lines):
                    current = lines[scan]
                    stripped = current.strip()

                    if stripped.startswith(
                        '=== ":material-book:`'
                    ) or stripped.startswith("## "):
                        break

                    if current.startswith("    * [教材"):
                        last_textbook_line = scan
                        scan += 1
                        continue

                    if current.startswith("    * ") or current.startswith("        * "):
                        break

                    scan += 1

                insert_at = (last_textbook_line + 1) if last_textbook_line else (i + 1)
                break

        if tab_found and insert_at >= 0:
            lines.insert(insert_at, resource_line)
        else:
            resource_idx = max(
                (i for i, l in enumerate(lines) if l.strip().startswith("## 资源")),
                default=-1,
            )
            if resource_idx >= 0:
                lines.insert(resource_idx + 1, tab_header)
                lines.insert(resource_idx + 2, resource_line)
            else:
                lines.extend([tab_header, resource_line])

        while lines and lines[0].strip() == "":
            lines.pop(0)

        self.workspace.write_file(self.file_path, "\n".join(lines) + "\n")

        return True

    def add_exam_paper(
        self,
        course_code: str,
        key: str,
        paper_name: str,
        semester: str,
        paper_type: str = "A卷",
    ) -> bool:
        """
        添加试卷资源

        Args:
            course_code: 课程编号
            key: 蓝奏云密钥
            paper_name: 试卷名称
            semester: 学期（如 2024秋）
            paper_type: 试卷类型（A卷/B卷）

        Returns:
            是否成功
        """
        self._ensure_valid()

        if self.structure is None or not self.structure.is_valid:
            return False

        lines = self.structure.lines
        api_url = build_api_url(key)

        resource_line = f"        * [{paper_name}]({api_url}) - :material-calendar:`{semester}` - :material-tag:`{paper_type}`  "

        tab_header_pattern = f'=== ":material-book:`{course_code}`'

        for i, line in enumerate(lines):
            if tab_header_pattern in line:
                scan = i + 1
                exam_section_start = -1
                exam_section_end = -1

                while scan < len(lines):
                    current = lines[scan]
                    stripped = current.strip()

                    if stripped.startswith(
                        '=== ":material-book:`'
                    ) or stripped.startswith("## "):
                        exam_section_end = scan
                        break

                    if current.startswith("    * 期末试卷") or current.startswith(
                        "    * 期中试卷"
                    ):
                        exam_section_start = scan

                    scan += 1

                if exam_section_start >= 0:
                    insert_start = exam_section_start + 1
                    while insert_start < len(lines) and lines[insert_start].startswith(
                        "        * "
                    ):
                        insert_start += 1

                    if exam_section_end == -1:
                        exam_section_end = len(lines)

                    if insert_start < exam_section_end:
                        lines.insert(insert_start, resource_line)
                    else:
                        lines.insert(exam_section_end, resource_line)
                else:
                    scan2 = i + 1
                    while scan2 < len(lines) and not lines[scan2].strip().startswith(
                        '=== ":material-book:`'
                    ):
                        if lines[scan2].strip().startswith("## "):
                            break
                        scan2 += 1
                    lines.insert(scan2, "    * 期末试卷")
                    lines.insert(scan2 + 1, resource_line)

                break

        self.workspace.write_file(self.file_path, "\n".join(lines) + "\n")

        return True

    def add_online_course_with_contributor(
        self,
        course_code: str,
        platform: str,
        platform_url: str,
        course_name: str,
        course_url: str,
        contributor_name: str,
        contributor_url: Optional[str] = None,
    ) -> bool:
        """
        添加带贡献者的网课资源

        Args:
            course_code: 课程编号
            platform: 平台名（如 学堂在线）
            platform_url: 平台链接
            course_name: 课程名
            course_url: 课程链接
            contributor_name: 贡献者名
            contributor_url: 贡献者链接

        Returns:
            是否成功
        """
        self._ensure_valid()

        if self.structure is None or not self.structure.is_valid:
            return False

        lines = self.structure.lines

        contributor_part = (
            f"@[{contributor_name}]({contributor_url})"
            if contributor_url
            else f"@{contributor_name}"
        )

        platform_line = f"    * [{platform}]({platform_url})网课  "
        course_line = f"        * [{course_name}]({course_url}) {contributor_part}  "

        tab_header_pattern = f'=== ":material-book:`{course_code}`'

        for i, line in enumerate(lines):
            if tab_header_pattern in line:
                scan = i + 1
                online_section_start = -1

                while scan < len(lines):
                    current = lines[scan]
                    stripped = current.strip()

                    if stripped.startswith(
                        '=== ":material-book:`'
                    ) or stripped.startswith("## "):
                        break

                    if "网课" in current and current.startswith("    * "):
                        online_section_start = scan

                    scan += 1

                if online_section_start >= 0:
                    insert_at = online_section_start + 1
                    while insert_at < len(lines) and lines[insert_at].startswith(
                        "        * "
                    ):
                        insert_at += 1

                    lines.insert(insert_at, course_line)
                else:
                    scan2 = i + 1
                    end_of_tab = scan2
                    while scan2 < len(lines):
                        if lines[scan2].strip().startswith(
                            '=== ":material-book:`'
                        ) or lines[scan2].strip().startswith("## "):
                            end_of_tab = scan2
                            break
                        scan2 += 1

                    lines.insert(end_of_tab, platform_line)
                    lines.insert(end_of_tab + 1, course_line)

                break

        self.workspace.write_file(self.file_path, "\n".join(lines) + "\n")

        return True

    def add_resource_after_exam_paper(
        self, course_code: str, resource_line: str, exam_type: str = "期末试卷"
    ) -> bool:
        """
        在试卷区域后添加资源（用于追加网课贡献者）

        Args:
            course_code: 课程编号
            resource_line: 资源行内容
            exam_type: 试卷类型（期末试卷/期中试卷）

        Returns:
            是否成功
        """
        self._ensure_valid()

        if self.structure is None or not self.structure.is_valid:
            return False

        lines = self.structure.lines

        tab_header_pattern = f'=== ":material-book:`{course_code}`'

        for i, line in enumerate(lines):
            if tab_header_pattern in line:
                scan = i + 1

                while scan < len(lines):
                    current = lines[scan]
                    stripped = current.strip()

                    if stripped.startswith(
                        '=== ":material-book:`'
                    ) or stripped.startswith("## "):
                        lines.insert(scan, resource_line)
                        break

                    if (
                        current.strip() == f"    * {exam_type}"
                        or f"    * {exam_type}" in current
                    ):
                        scan += 1
                        while scan < len(lines) and lines[scan].startswith(
                            "        * "
                        ):
                            scan += 1

                        if scan < len(lines):
                            lines.insert(scan, resource_line)
                        else:
                            lines.append(resource_line)
                        break

                    scan += 1

                break

        self.workspace.write_file(self.file_path, "\n".join(lines) + "\n")

        return True

    def create_new_tab(self, course_code: str) -> bool:
        """
        创建新的课程Tab

        Args:
            course_code: 课程编号

        Returns:
            是否成功
        """
        self._ensure_valid()

        if self.structure is None:
            return False

        lines = self.structure.lines

        if not any(l.strip().startswith("## 资源") for l in lines):
            lines.extend(["", "## 资源  ", ""])

        resource_idx = max(
            (i for i, l in enumerate(lines) if l.strip().startswith("## 资源")),
            default=len(lines) - 1,
        )

        new_tab_lines = [
            f'=== ":material-book:`{course_code}`"  ',
            "    * [教材]() - :material-format-quote-open:`教材名` - :material-account:`主编` - :material-printer:`出版社`  ",
            "    * 期末试卷",
            "        * [试卷+答案]() - :material-calendar:`学期` - :material-tag:`A卷`  ",
        ]

        insert_at = resource_idx + 1
        for j, new_line in enumerate(new_tab_lines):
            lines.insert(insert_at + j, new_line)

        self.workspace.write_file(self.file_path, "\n".join(lines) + "\n")

        return True
