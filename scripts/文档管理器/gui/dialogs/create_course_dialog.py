"""
创建课程对话框
"""

from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFormLayout,
    QMessageBox,
    QWidget,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from pathlib import Path
import sys
import re

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import COURSE_DIR
from utils import validate_course_code


class CreateCourseDialog(QDialog):
    """创建课程对话框"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("创建新课程")
        self.setMinimumWidth(350)
        self._data = {}
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(15)

        title_label = QLabel("创建新课程文件")
        title_label.setFont(QFont("Microsoft YaHei UI", 12, QFont.Bold))
        layout.addWidget(title_label)

        note_label = QLabel("新课程将创建到暂存区，编辑后使其合规")
        note_label.setStyleSheet("color: #B0B0B0; font-size: 10px;")
        layout.addWidget(note_label)

        form_widget = QWidget()
        form_layout = QFormLayout(form_widget)
        form_layout.setSpacing(10)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("如 高等数学")
        form_layout.addRow("课程名称:", self.name_input)

        self.code_input = QLineEdit()
        self.code_input.setPlaceholderText("如 MATH10821（可选）")
        form_layout.addRow("课程编号:", self.code_input)

        layout.addWidget(form_widget)

        self.name_input.textChanged.connect(self._on_name_changed)

        button_layout = QHBoxLayout()

        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)

        button_layout.addStretch()

        submit_btn = QPushButton("创建")
        submit_btn.clicked.connect(self._on_submit)
        button_layout.addWidget(submit_btn)

        layout.addLayout(button_layout)

    def _on_name_changed(self, text):
        pass

    def _on_submit(self):
        course_name = self.name_input.text().strip()

        if not course_name:
            QMessageBox.warning(self, "提示", "请输入课程名称")
            return

        existing_file = COURSE_DIR / f"{course_name}.md"
        if existing_file.exists():
            QMessageBox.warning(
                self, "提示", f"课程 '{course_name}' 已存在\n如需更新请直接编辑该课程"
            )
            return

        course_code = self.code_input.text().strip()

        if course_code:
            if not validate_course_code(course_code):
                QMessageBox.warning(
                    self, "提示", "课程编号格式有误，应为类似 ABC12345 的格式"
                )
                return

        self._data["course_name"] = course_name
        self._data["course_code"] = course_code

        self.accept()

    def get_data(self) -> dict:
        return self._data
