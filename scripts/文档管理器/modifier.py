"""
文档修改器模块
负责在文档中添加、修改、删除资源条目
"""

import re
from pathlib import Path
from typing import Optional, List, Tuple
from dataclasses import dataclass

from parser import DocumentParser, DocumentStructure
from validator import DocumentValidator
from workspace import WorkspaceManager
from utils import build_api_url


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
        lines = list(self.structure.lines)

        first_10 = "\n".join(lines[:10])
        is_placeholder = any(
            k in first_10 for k in ["暂无数据", "如果您知晓本门课程需要什么教材"]
        )

        if not is_placeholder and "欢迎贡献" in first_10:
            validator = DocumentValidator(self.structure)
            is_placeholder = (
                not validator._has_real_resource_content()
                and not validator._has_real_strategy_content()
            )

        if is_placeholder:
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

    def _find_tab_bounds(self, lines: List[str], course_code: str) -> Optional[Tuple[int, int]]:
        """查找课程Tab在文档中的起止行。"""
        tab_start = -1
        tab_prefix = f'=== ":material-book:`{course_code}`'

        for i, line in enumerate(lines):
            if line.strip().startswith(tab_prefix):
                tab_start = i
                break

        if tab_start < 0:
            return None

        tab_end = len(lines)
        for i in range(tab_start + 1, len(lines)):
            stripped = lines[i].strip()
            if stripped.startswith('=== ":material-book:`') or stripped.startswith("## "):
                tab_end = i
                break

        return tab_start, tab_end

    def _ensure_tab(self, lines: List[str], course_code: str) -> Tuple[int, int]:
        """确保资源区内存在指定课程Tab，并返回Tab边界。"""
        bounds = self._find_tab_bounds(lines, course_code)
        if bounds:
            return bounds

        if not any(l.strip().startswith("## 资源") for l in lines):
            lines.extend(["", "## 资源  ", ""])

        resource_idx = max(
            (i for i, l in enumerate(lines) if l.strip().startswith("## 资源")),
            default=len(lines) - 1,
        )
        insert_at = resource_idx + 1

        while insert_at < len(lines) and lines[insert_at].strip() == "":
            insert_at += 1

        lines.insert(insert_at, f'=== ":material-book:`{course_code}`"  ')
        return insert_at, insert_at + 1

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

        tab_start, tab_end = self._ensure_tab(lines, course_code)
        last_textbook_line = None

        for scan in range(tab_start + 1, tab_end):
            current = lines[scan]
            if current.startswith("    * [教材"):
                last_textbook_line = scan
                continue
            if current.startswith("    * ") or current.startswith("        * "):
                break

        if last_textbook_line is not None:
            lines.insert(last_textbook_line + 1, resource_line)
        else:
            lines.insert(tab_start + 1, resource_line)

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

        lines = self._normalize_lines()
        api_url = build_api_url(key)

        resource_line = f"        * [{paper_name}]({api_url}) - :material-calendar:`{semester}` - :material-tag:`{paper_type}`  "

        tab_start, tab_end = self._ensure_tab(lines, course_code)
        exam_section_start = -1
        exam_section_end = tab_end

        for scan in range(tab_start + 1, tab_end):
            current = lines[scan]
            if current.startswith("    * 期末试卷") or current.startswith("    * 期中试卷"):
                exam_section_start = scan
                next_top = scan + 1
                while next_top < tab_end and not lines[next_top].startswith("    * "):
                    next_top += 1
                exam_section_end = next_top
                break

        if exam_section_start >= 0:
            insert_at = exam_section_start + 1
            while insert_at < exam_section_end and lines[insert_at].startswith("        * "):
                insert_at += 1
            lines.insert(insert_at, resource_line)
        else:
            lines.insert(tab_end, "    * 期末试卷")
            lines.insert(tab_end + 1, resource_line)

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

        lines = self._normalize_lines()

        contributor_part = (
            f"@[{contributor_name}]({contributor_url})"
            if contributor_url
            else f"@{contributor_name}"
        )

        platform_line = f"    * [{platform}]({platform_url})网课  "
        course_line = f"        * [{course_name}]({course_url}) {contributor_part}  "

        tab_start, tab_end = self._ensure_tab(lines, course_code)
        online_section_start = -1
        online_section_end = tab_end

        for scan in range(tab_start + 1, tab_end):
            current = lines[scan]
            if "网课" in current and current.startswith("    * "):
                online_section_start = scan
                next_top = scan + 1
                while next_top < tab_end and not lines[next_top].startswith("    * "):
                    next_top += 1
                online_section_end = next_top
                break

        if online_section_start >= 0:
            insert_at = online_section_start + 1
            while insert_at < online_section_end and lines[insert_at].startswith("        * "):
                insert_at += 1
            lines.insert(insert_at, course_line)
        else:
            lines.insert(tab_end, platform_line)
            lines.insert(tab_end + 1, course_line)

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

        lines = self._normalize_lines()

        tab_start, tab_end = self._ensure_tab(lines, course_code)
        insert_at = tab_end

        for scan in range(tab_start + 1, tab_end):
            current = lines[scan]
            if current.strip() == f"* {exam_type}" or current.strip() == f"    * {exam_type}":
                insert_at = scan + 1
                while insert_at < tab_end and lines[insert_at].startswith("        * "):
                    insert_at += 1
                break

        lines.insert(insert_at, resource_line)

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

        lines = self._normalize_lines()

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
