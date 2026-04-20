"""
课程编辑对话框
复用暂存区的表单编辑组件，编辑合规课程
"""

from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QTabWidget,
    QScrollArea,
    QTextEdit,
    QSizePolicy,
    QWidget,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from pathlib import Path
from typing import Dict
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from gui.widgets.strategy_editor import StrategyEditor
from gui.widgets.resource_builder import ResourceBuilder
from gui.utils.markdown_generator import MarkdownGenerator


class CourseEditorDialog(QDialog):
    """课程编辑对话框 - 表单化编辑合规课程"""

    def __init__(self, course: Dict, parent=None):
        super().__init__(parent)
        self._course = course
        self._course_file: Path = course["file_path"]
        self._init_ui()
        self._load_content()

    def _init_ui(self):
        self.setWindowTitle(f"编辑课程: {self._course['name']}")
        self.setMinimumSize(800, 600)
        self.resize(900, 650)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(8)

        header_layout = QHBoxLayout()

        name_label = QLabel(f"课程: {self._course['name']}")
        name_label.setFont(QFont("Microsoft YaHei UI", 12, QFont.Weight.Bold))
        name_label.setStyleSheet("color: #FFFFFF;")
        header_layout.addWidget(name_label)

        codes_text = ", ".join(self._course.get("codes", []))
        if codes_text:
            codes_label = QLabel(f"编号: {codes_text}")
            codes_label.setStyleSheet("color: #B0B0B0;")
            header_layout.addWidget(codes_label)

        header_layout.addStretch()

        self.status_label = QLabel("合规 ✓")
        self.status_label.setStyleSheet("color: #4CAF50;")
        header_layout.addWidget(self.status_label)

        layout.addLayout(header_layout)

        self.edit_tabs = QTabWidget()
        self.edit_tabs.setFont(QFont("Microsoft YaHei UI", 10))
        self.edit_tabs.setDocumentMode(True)
        self.edit_tabs.setSizePolicy(
            QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding
        )
        self.edit_tabs.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #3A3A3A;
                border-radius: 4px;
            }
            QTabBar::tab {
                padding: 6px 16px;
                margin-right: 1px;
            }
        """)

        self.resource_builder = ResourceBuilder()
        self.resource_builder.data_changed.connect(self._on_form_changed)

        resource_scroll = QScrollArea()
        resource_scroll.setWidgetResizable(True)
        resource_scroll.setHorizontalScrollBarPolicy(
            Qt.ScrollBarPolicy.ScrollBarAlwaysOff
        )
        resource_scroll.setStyleSheet("""
            QScrollArea {
                border: none;
                background-color: transparent;
            }
        """)
        resource_scroll.setWidget(self.resource_builder)
        self.edit_tabs.addTab(resource_scroll, "📚 资源配置")

        self.strategy_editor = StrategyEditor()
        self.strategy_editor.content_changed.connect(self._on_form_changed)
        self.edit_tabs.addTab(self.strategy_editor, "📝 攻略编辑")

        preview_widget = QWidget()
        preview_layout = QVBoxLayout(preview_widget)
        preview_layout.setContentsMargins(2, 2, 2, 2)

        self.preview_editor = QTextEdit()
        self.preview_editor.setFont(QFont("Consolas", 10))
        self.preview_editor.setReadOnly(True)
        preview_layout.addWidget(self.preview_editor)

        self.edit_tabs.addTab(preview_widget, "👁️ 预览")

        self.edit_tabs.currentChanged.connect(self._on_tab_changed)

        layout.addWidget(self.edit_tabs)

        action_layout = QHBoxLayout()
        action_layout.setSpacing(10)

        preview_btn = QPushButton("预览")
        preview_btn.setFixedHeight(28)
        preview_btn.clicked.connect(self._preview_markdown)
        action_layout.addWidget(preview_btn)

        action_layout.addStretch()

        cancel_btn = QPushButton("取消")
        cancel_btn.setFixedHeight(28)
        cancel_btn.clicked.connect(self.reject)
        action_layout.addWidget(cancel_btn)

        save_btn = QPushButton("保存")
        save_btn.setFixedHeight(28)
        save_btn.clicked.connect(self._on_save)
        action_layout.addWidget(save_btn)

        layout.addLayout(action_layout)

    def _load_content(self):
        """加载课程文件内容到表单"""
        if not self._course_file.exists():
            self.status_label.setText("文件不存在")
            self.status_label.setStyleSheet("color: #FF5722;")
            return

        content = self._course_file.read_text(encoding="utf-8")

        try:
            form_data = MarkdownGenerator.parse_to_form_data(content)

            self.strategy_editor.set_content(form_data.get("strategy_lines", []))

            self.resource_builder.clear()
            tabs = form_data.get("tabs", {})
            for course_code, tab_data in tabs.items():
                tab_data["course_code"] = course_code
                self.resource_builder._add_course_tab(tab_data)

            self.edit_tabs.setCurrentIndex(0)
            self.status_label.setText("已加载 ✓")
            self.status_label.setStyleSheet("color: #4CAF50;")
        except Exception as e:
            self.status_label.setText(f"加载失败")
            self.status_label.setStyleSheet("color: #FF5722;")

    def _on_form_changed(self):
        """表单内容变化"""
        if self.edit_tabs.currentIndex() == 2:
            self._preview_markdown()

    def _on_tab_changed(self, index):
        """切换Tab"""
        if index == 2:
            self._preview_markdown()

    def _preview_markdown(self):
        """预览生成的Markdown"""
        form_data = self._collect_form_data()
        markdown = MarkdownGenerator.generate_from_form_data(form_data)
        self.preview_editor.setPlainText(markdown)
        self.edit_tabs.setCurrentIndex(2)

    def _collect_form_data(self) -> Dict:
        """收集表单数据"""
        return {
            "strategy_lines": self.strategy_editor.get_content(),
            "tabs": self.resource_builder.get_data().get("tabs", {}),
        }

    def _on_save(self):
        """保存修改到课程文件"""
        form_data = self._collect_form_data()
        markdown = MarkdownGenerator.generate_from_form_data(form_data)

        self._course_file.write_text(markdown, encoding="utf-8")

        self.preview_editor.setPlainText(markdown)
        self.status_label.setText("已保存 ✓")
        self.status_label.setStyleSheet("color: #4CAF50;")

        self.accept()
