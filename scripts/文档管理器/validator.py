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

        if not has_tab:
            self.errors.append("资源区缺少课程Tab语法: === :material-book:`课程号`")

    def _check_no_placeholder(self):
        """检查是否是占位符文档（暂无数据）"""
        first_10_lines = "\n".join(self.structure.lines[:10])
        placeholder_keywords = [
            "暂无数据",
            "欢迎贡献",
            "如果您知晓本门课程需要什么教材",
        ]

        for keyword in placeholder_keywords:
            if keyword in first_10_lines:
                self.errors.append(
                    "提示: 该文档当前为空白模板，请在表单中添加真实的教材、试卷或网课信息。"
                )
                break

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
        placeholder_keywords = ["暂无数据", "欢迎贡献"]
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
