"""
暂存区处理视图 - 表单化编辑模式
紧凑布局：删除冗余标题，编辑区占90%+高度
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QLabel,
    QListWidget,
    QSplitter,
    QMessageBox,
    QScrollArea,
    QTabWidget,
    QTextEdit,
    QSizePolicy,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from pathlib import Path
from typing import Optional, Dict
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import STAGING_DIR, COURSE_DIR
from workspace import WorkspaceManager
from gui.widgets.strategy_editor import StrategyEditor
from gui.widgets.resource_builder import ResourceBuilder
from gui.widgets.other_resource_widget import OtherResourceWidget
from gui.utils.markdown_generator import MarkdownGenerator


class StagingAreaView(QWidget):
    """暂存区处理视图 - 紧凑布局"""

    file_validated = Signal(bool)

    def __init__(self):
        super().__init__()
        self.workspace = WorkspaceManager()
        self._current_file: Optional[Path] = None
        self._is_current_valid = False
        self._init_ui()
        self.refresh()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        layout.setSpacing(2)

        splitter = QSplitter(Qt.Orientation.Horizontal)

        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)
        left_layout.setSpacing(2)

        self.file_count_label = QLabel("共 0 个文件")
        self.file_count_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        left_layout.addWidget(self.file_count_label)

        self.file_list = QListWidget()
        self.file_list.currentItemChanged.connect(self._on_file_selected)
        left_layout.addWidget(self.file_list)

        delete_btn = QPushButton("删除")
        delete_btn.setFixedHeight(26)
        delete_btn.clicked.connect(self._on_delete_file)
        left_layout.addWidget(delete_btn)

        splitter.addWidget(left_panel)

        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(2)

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

        self.other_resource_widget = OtherResourceWidget()
        self.other_resource_widget.data_changed.connect(self._on_form_changed)
        other_scroll = QScrollArea()
        other_scroll.setWidgetResizable(True)
        other_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        other_scroll.setStyleSheet("""
            QScrollArea {
                border: none;
                background-color: transparent;
            }
        """)
        other_scroll.setWidget(self.other_resource_widget)
        self.edit_tabs.addTab(other_scroll, "📖 课外资源")

        preview_widget = QWidget()
        preview_layout = QVBoxLayout(preview_widget)
        preview_layout.setContentsMargins(2, 2, 2, 2)

        self.preview_editor = QTextEdit()
        self.preview_editor.setFont(QFont("Consolas", 10))
        self.preview_editor.setReadOnly(True)
        preview_layout.addWidget(self.preview_editor)

        self.edit_tabs.addTab(preview_widget, "👁️ 预览")

        self.edit_tabs.currentChanged.connect(self._on_tab_changed)

        right_layout.addWidget(self.edit_tabs)

        action_layout = QHBoxLayout()
        action_layout.setSpacing(8)

        self.status_label = QLabel("选择文件")
        self.status_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        action_layout.addWidget(self.status_label)

        action_layout.addStretch()

        preview_btn = QPushButton("预览")
        preview_btn.setFixedHeight(26)
        preview_btn.setFixedWidth(65)
        preview_btn.clicked.connect(self._preview_markdown)
        action_layout.addWidget(preview_btn)

        save_btn = QPushButton("保存")
        save_btn.setFixedHeight(26)
        save_btn.setFixedWidth(65)
        save_btn.clicked.connect(self._on_save)
        action_layout.addWidget(save_btn)

        self.replace_btn = QPushButton("覆盖")
        self.replace_btn.setFixedHeight(26)
        self.replace_btn.setFixedWidth(65)
        self.replace_btn.setEnabled(False)
        self.replace_btn.clicked.connect(self._on_replace)
        action_layout.addWidget(self.replace_btn)

        right_layout.addLayout(action_layout)

        splitter.addWidget(right_panel)

        splitter.setSizes([150, 850])

        layout.addWidget(splitter)

    def refresh(self):
        self.file_list.clear()

        staging_files = self.workspace.list_staging_files()

        for file_path in staging_files:
            self.file_list.addItem(file_path.name)

        self.file_count_label.setText(f"共 {len(staging_files)} 个")

        if staging_files:
            self.file_list.setCurrentRow(0)
        else:
            self.clear_form()
            self.other_resource_widget.clear()
            self.status_label.setText("暂存区为空")

    def _on_file_selected(self, current, previous):
        if not current:
            return

        file_name = current.text()
        self._current_file = STAGING_DIR / file_name

        if self._current_file and self._current_file.exists():
            content = self._current_file.read_text(encoding="utf-8")
            self._load_content_to_form(content)

        self._check_validity()

    def _load_content_to_form(self, content: str):
        """将Markdown内容加载到表单"""
        try:
            form_data, issues = MarkdownGenerator.parse_to_form_data(content)

            self.strategy_editor.set_content(form_data.get("strategy_lines", []))

            self.resource_builder.clear()
            tabs = form_data.get("tabs", {})
            for course_code, tab_data in tabs.items():
                tab_data["course_code"] = course_code
                self.resource_builder._add_course_tab(tab_data)

            other_sections = form_data.get("other_sections", {})
            if "课外资源" in other_sections:
                self.other_resource_widget.set_data(other_sections["课外资源"])
            else:
                self.other_resource_widget.clear()

            self.edit_tabs.setCurrentIndex(0)

            if issues:
                from PySide6.QtWidgets import QMessageBox

                QMessageBox.warning(
                    self,
                    "文档解析问题",
                    f"发现以下问题，请手动修正：\n\n" + "\n".join(issues),
                )
                self.status_label.setText("已加载（有问题）")
                self.status_label.setStyleSheet("color: #FF9800;")
            else:
                self.status_label.setText("已加载")
                self.status_label.setStyleSheet("color: #B0B0B0;")
        except Exception as e:
            self.status_label.setText(f"加载失败")
            self.status_label.setStyleSheet("color: #FF5722;")

    def _on_form_changed(self):
        """表单内容变化时更新状态"""
        self._check_validity()

        if self.edit_tabs.currentIndex() == 2:
            self._preview_markdown()

    def _on_tab_changed(self, index):
        """切换Tab时自动更新预览"""
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
        other_sections = {}
        if not self.other_resource_widget.is_empty():
            other_sections["课外资源"] = self.other_resource_widget.get_data()

        return {
            "strategy_lines": self.strategy_editor.get_content(),
            "tabs": self.resource_builder.get_data().get("tabs", {}),
            "other_sections": other_sections,
        }

    def _check_validity(self):
        """检查当前内容是否合规"""
        form_data = self._collect_form_data()

        has_strategy = bool(self.strategy_editor.get_raw_text().strip())
        has_resources = self.resource_builder.has_content()
        has_other_resources = not self.other_resource_widget.is_empty()

        if has_resources:
            tabs = form_data.get("tabs", {})
            for course_code, resources in tabs.items():
                if (
                    not resources.get("textbooks")
                    and not resources.get("exam_groups")
                    and not resources.get("online_courses")
                ):
                    self._is_current_valid = False
                    self.status_label.setText("请为每个课程编号添加资源")
                    self.status_label.setStyleSheet("color: #FFA500;")
                    self.replace_btn.setEnabled(False)
                    return

        self._is_current_valid = has_strategy or has_resources or has_other_resources

        if self._is_current_valid:
            self.status_label.setText("合规 ✓")
            self.status_label.setStyleSheet("color: #4CAF50;")
            self.replace_btn.setEnabled(True)
        else:
            self.status_label.setText("请填写攻略或添加资源")
            self.status_label.setStyleSheet("color: #FFA500;")
            self.replace_btn.setEnabled(False)

    def _on_save(self):
        """保存表单内容到文件"""
        if not self._current_file:
            QMessageBox.warning(self, "提示", "请先选择文件")
            return

        form_data = self._collect_form_data()
        markdown = MarkdownGenerator.generate_from_form_data(form_data)

        self._current_file.write_text(markdown, encoding="utf-8")

        self.preview_editor.setPlainText(markdown)
        self._check_validity()

        self.status_label.setText("已保存 ✓")
        self.status_label.setStyleSheet("color: #4CAF50;")

    def _on_replace(self):
        """覆盖到正式课程库"""
        if not self._current_file or not self._is_current_valid:
            return

        course_name = self._current_file.stem
        target_path = COURSE_DIR / f"{course_name}.md"

        if target_path.exists():
            reply = QMessageBox.question(
                self,
                "确认",
                f"覆盖 '{course_name}.md'？原文件将备份。",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            )
            if reply != QMessageBox.StandardButton.Yes:
                return

        try:
            self.workspace.replace_course_file_from_staging(
                self._current_file, course_name
            )
            QMessageBox.information(self, "成功", f"已覆盖:\n{target_path}")
            self.refresh()
        except Exception as e:
            QMessageBox.critical(self, "错误", f"失败:\n{str(e)}")

    def _on_delete_file(self):
        """删除暂存区文件"""
        current_item = self.file_list.currentItem()
        if not current_item:
            return

        file_name = current_item.text()

        reply = QMessageBox.question(
            self,
            "确认",
            f"删除 '{file_name}'？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )

        if reply == QMessageBox.StandardButton.Yes:
            file_path = STAGING_DIR / file_name
            file_path.unlink()
            self.refresh()

    def clear_form(self):
        self.strategy_editor.set_content([])
        self.resource_builder.clear()
        self.other_resource_widget.clear()
        self.preview_editor.clear()
        self.status_label.setText("")
        self._is_current_valid = False
        self.replace_btn.setEnabled(False)
