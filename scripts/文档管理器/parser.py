"""
文档解析器模块
负责解析Markdown文档，提取结构化数据
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from config import PATTERNS


@dataclass
class ListItem:
    """列表项节点"""

    indent: int
    content: str
    line_number: int
    children: List["ListItem"] = field(default_factory=list)
    parent: Optional["ListItem"] = None

    def find_items_by_keyword(self, keyword: str) -> List["ListItem"]:
        """递归查找包含关键字的列表项"""
        results = []
        if keyword in self.content:
            results.append(self)
        for child in self.children:
            results.extend(child.find_items_by_keyword(keyword))
        return results

    def get_all_children_lines(self) -> List[int]:
        """获取所有子项的行号"""
        lines = []
        for child in self.children:
            lines.append(child.line_number)
            lines.extend(child.get_all_children_lines())
        return lines


@dataclass
class TabBlock:
    """Tab块（课程号对应的资源块）"""

    course_code: str
    line_number: int
    items: List[ListItem] = field(default_factory=list)

    def find_items_by_keyword(self, keyword: str) -> List[ListItem]:
        """查找包含关键字的列表项"""
        results = []
        for item in self.items:
            results.extend(item.find_items_by_keyword(keyword))
        return results


@dataclass
class Section:
    """文档章节"""

    title: str
    line_number: int
    content_lines: List[str] = field(default_factory=list)
    tabs: List[TabBlock] = field(default_factory=list)


@dataclass
class DocumentStructure:
    """文档结构数据模型"""

    file_path: str
    lines: List[str] = field(default_factory=list)
    sections: Dict[str, Section] = field(default_factory=dict)
    has_strategy: bool = False
    has_resource: bool = False
    is_valid: bool = False
    validation_errors: List[str] = field(default_factory=list)

    def get_section(self, name: str) -> Optional[Section]:
        """获取指定章节"""
        return self.sections.get(name)

    def get_tab(self, course_code: str) -> Optional[TabBlock]:
        """获取指定课程号的Tab块"""
        for section in self.sections.values():
            for tab in section.tabs:
                if tab.course_code == course_code:
                    return tab
        return None


class DocumentParser:
    """文档解析器"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.lines: List[str] = []
        self.structure = DocumentStructure(file_path=file_path)

    def parse(self) -> DocumentStructure:
        """解析文档并返回结构化数据"""
        with open(self.file_path, "r", encoding="utf-8") as f:
            self.lines = f.read().splitlines()

        self.structure.lines = self.lines
        self._parse_sections()
        self._parse_tabs()

        return self.structure

    def _parse_sections(self):
        """解析章节（## 开头的一级标题）"""
        current_section: Optional[Section] = None

        for i, line in enumerate(self.lines):
            section_match = re.match(PATTERNS["section_header"], line)
            if section_match:
                title = section_match.group(1).strip()
                current_section = Section(title=title, line_number=i, content_lines=[])
                self.structure.sections[title] = current_section

                if title == "攻略":
                    self.structure.has_strategy = True
                elif title == "资源":
                    self.structure.has_resource = True
            elif current_section:
                current_section.content_lines.append(line)

    def _parse_tabs(self):
        """解析Tab块（=== ":material-book:`课程号`"）"""
        for section in self.structure.sections.values():
            current_tab: Optional[TabBlock] = None
            tab_start_line = -1

            for i, line in enumerate(section.content_lines):
                actual_line_num = section.line_number + 1 + i
                tab_match = re.match(PATTERNS["tab_header"], line)

                if tab_match:
                    if current_tab:
                        self._parse_tab_items(
                            current_tab,
                            tab_start_line,
                            actual_line_num - 1,
                            section.content_lines,
                        )
                    course_code = tab_match.group(1)
                    current_tab = TabBlock(
                        course_code=course_code, line_number=actual_line_num
                    )
                    tab_start_line = i + 1
                    section.tabs.append(current_tab)
                elif i == len(section.content_lines) - 1 and current_tab:
                    self._parse_tab_items(
                        current_tab, tab_start_line, i + 1, section.content_lines
                    )

    def _parse_tab_items(
        self, tab: TabBlock, start: int, end: int, content_lines: List[str]
    ):
        """解析Tab块内的列表项"""
        stack: List[ListItem] = []

        for i in range(start, end):
            if i >= len(content_lines):
                break
            line = content_lines[i]
            item_match = re.match(PATTERNS["list_item"], line)

            if item_match:
                spaces = len(item_match.group(1))
                indent = spaces // 4
                content = item_match.group(2)

                item = ListItem(
                    indent=indent,
                    content=content,
                    line_number=tab.line_number + (i - start) + 1,
                    children=[],
                    parent=None,
                )

                while stack and stack[-1].indent >= indent:
                    stack.pop()

                if stack:
                    item.parent = stack[-1]
                    stack[-1].children.append(item)
                else:
                    tab.items.append(item)

                stack.append(item)

    def find_exam_paper_section(self, course_code: str) -> Optional[tuple]:
        """
        查找指定课程号的期末试卷区域
        返回: (tab_block, exam_paper_item, last_child_line) 或 None
        """
        tab = self.structure.get_tab(course_code)
        if not tab:
            return None

        for item in tab.items:
            if "期末试卷" in item.content or "期中试卷" in item.content:
                last_child_line = item.line_number
                if item.children:
                    all_lines = item.get_all_children_lines()
                    if all_lines:
                        last_child_line = max(all_lines)
                return (tab, item, last_child_line)

        return None

    def find_online_course_section(self, course_code: str) -> Optional[tuple]:
        """
        查找指定课程号的网课区域
        返回: (tab_block, online_course_item) 或 None
        """
        tab = self.structure.get_tab(course_code)
        if not tab:
            return None

        for item in tab.items:
            if "网课" in item.content:
                return (tab, item)

        return None

    def get_line_number_for_insert(
        self, course_code: str, section_type: str = "textbook"
    ) -> Optional[int]:
        """
        获取指定课程号和类型资源的插入位置
        section_type: textbook, exam_paper, online_course
        """
        tab = self.structure.get_tab(course_code)
        if not tab:
            return None

        if section_type == "textbook":
            for item in tab.items:
                if item.content.startswith("[教材"):
                    if item.children:
                        return max(item.get_all_children_lines()) + 1
                    return item.line_number + 1
            return tab.line_number + 1

        return None
