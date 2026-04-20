"""
攻略区编辑器组件
提供富文本编辑功能，支持简单的Markdown格式化按钮
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QTextEdit,
    QPushButton,
    QLabel,
    QToolBar,
    QSizePolicy,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont, QTextCursor
from typing import List


class StrategyEditor(QWidget):
    """攻略区编辑器"""

    content_changed = Signal()

    def __init__(self):
        super().__init__()
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(5)

        header_layout = QHBoxLayout()

        title_label = QLabel("攻略区")
        title_label.setFont(QFont("Microsoft YaHei UI", 11, QFont.Bold))
        title_label.setStyleSheet("color: #FFFFFF;")
        header_layout.addWidget(title_label)

        header_layout.addStretch()

        hint_label = QLabel("填写学习攻略、经验分享等内容")
        hint_label.setStyleSheet("color: #B0B0B0; font-size: 10px;")
        header_layout.addWidget(hint_label)

        layout.addLayout(header_layout)

        toolbar_layout = QHBoxLayout()
        toolbar_layout.setSpacing(8)

        bold_btn = QPushButton("B 加粗")
        bold_btn.setMinimumHeight(28)
        bold_btn.setMinimumWidth(70)
        bold_btn.setStyleSheet("padding: 4px 10px;")
        bold_btn.setToolTip("将选中文字加粗")
        bold_btn.clicked.connect(self._insert_bold)
        toolbar_layout.addWidget(bold_btn)

        list_btn = QPushButton("- 列表")
        list_btn.setMinimumHeight(28)
        list_btn.setMinimumWidth(70)
        list_btn.setStyleSheet("padding: 4px 10px;")
        list_btn.setToolTip("插入列表项")
        list_btn.clicked.connect(self._insert_list)
        toolbar_layout.addWidget(list_btn)

        link_btn = QPushButton("🔗 链接")
        link_btn.setMinimumHeight(28)
        link_btn.setMinimumWidth(70)
        link_btn.setStyleSheet("padding: 4px 10px;")
        link_btn.setToolTip("插入链接")
        link_btn.clicked.connect(self._insert_link)
        toolbar_layout.addWidget(link_btn)

        toolbar_layout.addStretch()

        clear_btn = QPushButton("清空")
        clear_btn.setMinimumHeight(28)
        clear_btn.clicked.connect(self._clear_content)
        toolbar_layout.addWidget(clear_btn)

        layout.addLayout(toolbar_layout)

        self.editor = QTextEdit()
        self.editor.setFont(QFont("Microsoft YaHei UI", 11))
        self.editor.setPlaceholderText(
            "在此填写课程攻略...\n\n"
            "示例:\n"
            "- 课前预习教材重点章节\n"
            "- 认真完成课后习题\n"
            "- 考前复习往年试卷"
        )
        self.editor.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.editor.textChanged.connect(self._on_text_changed)
        layout.addWidget(self.editor)

    def _insert_bold(self):
        cursor = self.editor.textCursor()
        selected_text = cursor.selectedText()
        if selected_text:
            cursor.insertText(f"**{selected_text}**")
        else:
            cursor.insertText("****")
            cursor.movePosition(QTextCursor.Left, QTextCursor.MoveAnchor, 2)
            self.editor.setTextCursor(cursor)

    def _insert_list(self):
        cursor = self.editor.textCursor()
        cursor.insertText("- ")

    def _insert_link(self):
        cursor = self.editor.textCursor()
        selected_text = cursor.selectedText()
        if selected_text:
            cursor.insertText(f"[{selected_text}]()")
        else:
            cursor.insertText("[链接文字](链接地址)")

    def _clear_content(self):
        self.editor.clear()

    def _on_text_changed(self):
        self.content_changed.emit()

    def get_content(self) -> List[str]:
        """获取攻略内容（返回行列表）"""
        text = self.editor.toPlainText()
        if not text.strip():
            return ["- 暂无攻略，欢迎贡献"]

        lines = []
        for line in text.split("\n"):
            if line.strip():
                lines.append(line.rstrip() + "  ")

        if not lines:
            lines = ["- 暂无攻略，欢迎贡献"]

        return lines

    def set_content(self, lines: List[str]):
        """设置攻略内容"""
        if not lines or lines == ["- 暂无攻略，欢迎贡献"]:
            self.editor.clear()
            return

        content = "\n".join(line.rstrip("  ") for line in lines)
        self.editor.setPlainText(content)

    def get_raw_text(self) -> str:
        """获取原始文本"""
        return self.editor.toPlainText()
