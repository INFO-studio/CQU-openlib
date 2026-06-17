"""
文档校验器模块
负责检查文档是否符合标准结构
"""

import re
from typing import List
from parser import DocumentStructure
from config import PATTERNS, REQUIRED_SECTIONS


class DocumentValidator:
    """文档校验器"""

    TEMPLATE_COURSE_CODES = {"", "课程号", "COURSE_CODE"}
    TEMPLATE_RESOURCE_TOKENS = {
        "`教材名`",
        "`主编`",
        "`出版社`",
        "`学期`",
        "(贡献者链接)",
        "[网课名称](",
        "[链接文字](",
    }

    def __init__(self, structure: DocumentStructure):
        self.structure = structure
        self.errors: List[str] = []

    def validate(self) -> bool:
        """
        校验文档结构是否合规
        返回: True表示合规，False表示不合规
        """
        self.errors = []

        self._check_required_sections()
        self._check_tab_syntax()
        self._check_no_placeholder()
        self._check_template_placeholders()

        self.structure.validation_errors = self.errors
        self.structure.is_valid = len(self.errors) == 0

        return self.structure.is_valid

    def _check_required_sections(self):
        """检查必须的章节"""
        for section_name in REQUIRED_SECTIONS:
            if not self.structure.get_section(section_name):
                self.errors.append(f"缺少必要章节: ## {section_name}")

    def _check_tab_syntax(self):
        """检查资源区是否包含Tab语法"""
        resource_section = self.structure.get_section("资源")
        if not resource_section:
            return

        has_tab = False
        for line in resource_section.content_lines:
            if re.match(PATTERNS["tab_header"], line):
                has_tab = True
                break

        if not has_tab and not self._has_real_strategy_content():
            self.errors.append("资源区缺少课程Tab语法: === :material-book:`课程号`")

    def _check_no_placeholder(self):
        """检查是否是占位符文档（暂无数据）"""
        first_10_lines = "\n".join(self.structure.lines[:10])
        placeholder_keywords = ["暂无数据", "如果您知晓本门课程需要什么教材"]

        for keyword in placeholder_keywords:
            if keyword in first_10_lines:
                self.errors.append(
                    "提示: 该文档当前为空白模板，请在表单中添加真实的教材、试卷或网课信息。"
                )
                break

        if "欢迎贡献" in first_10_lines and not self._has_real_resource_content():
            self.errors.append(
                "提示: 该文档当前为空白模板，请在表单中添加真实的教材、试卷或网课信息。"
            )

    def _check_template_placeholders(self):
        """检查文档管理器模板残留项。"""
        resource_section = self.structure.get_section("资源")
        if not resource_section:
            return

        for tab in resource_section.tabs:
            if tab.course_code.strip() in self.TEMPLATE_COURSE_CODES:
                self.errors.append("资源区仍包含占位课程号，请填写真实课程编号。")
                return

            for item in self._iter_items(tab.items):
                if any(token in item.content for token in self.TEMPLATE_RESOURCE_TOKENS):
                    self.errors.append(
                        "资源区仍包含模板占位内容，请替换为真实资源信息。"
                    )
                    return

    def _has_real_resource_content(self) -> bool:
        """判断资源区是否已经包含非模板资源。"""
        resource_section = self.structure.get_section("资源")
        if not resource_section:
            return False

        for tab in resource_section.tabs:
            if tab.course_code.strip() in self.TEMPLATE_COURSE_CODES:
                continue

            for item in self._iter_items(tab.items):
                content = item.content.strip()
                if not content or content in {"期末试卷", "期中试卷", "网课"}:
                    continue
                if any(token in content for token in self.TEMPLATE_RESOURCE_TOKENS):
                    continue
                return True

        return False

    def _has_real_strategy_content(self) -> bool:
        """判断攻略区是否包含用户填写的实际内容。"""
        strategy_section = self.structure.get_section("攻略")
        if not strategy_section:
            return False

        for line in strategy_section.content_lines:
            content = line.strip().lstrip("*-+").strip()
            if not content:
                continue
            if "暂无攻略" in content or "欢迎贡献" in content:
                continue
            return True

        return False

    def _iter_items(self, items):
        for item in items:
            yield item
            yield from self._iter_items(item.children)

    def get_validation_report(self) -> str:
        """获取校验报告"""
        if self.structure.is_valid:
            return "[ 校验 ] 文档结构合规 ✓"

        report = "[ 校验 ] 文档需要完善:\n"
        for i, error in enumerate(self.errors, 1):
            report += f"  {i}. {error}\n"
        report += "\n建议: 在暂存区表单中填写攻略和添加资源，保存后自动生成合规文档"

        return report

    @staticmethod
    def is_empty_document(content: str) -> bool:
        """快速检查是否是空白/占位符文档"""
        placeholder_keywords = ["暂无数据", "如果您知晓本门课程需要什么教材"]
        for keyword in placeholder_keywords:
            if keyword in content[:200]:
                return True
        return False

    @staticmethod
    def has_resource_section(content: str) -> bool:
        """快速检查是否有资源章节"""
        return "## 资源" in content

    @staticmethod
    def has_tab_syntax(content: str) -> bool:
        """快速检查是否有Tab语法"""
        pattern = r'===\s*":material-book:`[^`]+`"'
        return bool(re.search(pattern, content))
