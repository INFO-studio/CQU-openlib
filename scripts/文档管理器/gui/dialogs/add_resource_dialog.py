"""
添加资源动态表单对话框
"""

from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QComboBox,
    QPushButton,
    QWidget,
    QFormLayout,
    QMessageBox,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from pathlib import Path
import sys
import re

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils import extract_lanzou_key, validate_course_code


class AddResourceDialog(QDialog):
    """添加资源对话框"""

    def __init__(self, course: dict, resource_type: str, parent=None):
        super().__init__(parent)
        self.course = course
        self.resource_type = resource_type
        self.setWindowTitle(f"添加资源 - {course['name']}")
        self.setMinimumWidth(400)
        self._data = {}
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(15)

        info_label = QLabel(f"课程: {self.course['name']}")
        info_label.setFont(QFont("Microsoft YaHei UI", 11, QFont.Bold))
        layout.addWidget(info_label)

        codes = self.course.get("codes", [])
        if codes:
            codes_label = QLabel(f"可用编号: {', '.join(codes[:3])}")
            codes_label.setStyleSheet("color: #B0B0B0;")
            layout.addWidget(codes_label)

        self._create_form(layout)

        button_layout = QHBoxLayout()

        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)

        button_layout.addStretch()

        self.submit_btn = QPushButton("确定")
        self.submit_btn.clicked.connect(self._on_submit)
        button_layout.addWidget(self.submit_btn)

        layout.addLayout(button_layout)

    def _create_form(self, layout):
        self._form_widgets = {}

        form_widget = QWidget()
        form_layout = QFormLayout(form_widget)
        form_layout.setSpacing(10)

        self.course_code_input = QLineEdit()
        codes = self.course.get("codes", [])
        self.course_code_input.setText(codes[0] if codes else "")
        self.course_code_input.setPlaceholderText("如 MATH10821")
        form_layout.addRow("课程编号:", self.course_code_input)
        self._form_widgets["course_code"] = self.course_code_input

        if self.resource_type == "textbook":
            self._create_textbook_form(form_layout)
        elif self.resource_type == "exam":
            self._create_exam_form(form_layout)
        elif self.resource_type == "online":
            self._create_online_form(form_layout)

        layout.addWidget(form_widget)

    def _create_textbook_form(self, form_layout):
        key_input = QLineEdit()
        key_input.setPlaceholderText("蓝奏云链接或12位密钥")
        form_layout.addRow("密钥/链接:", key_input)
        self._form_widgets["key"] = key_input

        textbook_name_input = QLineEdit()
        textbook_name_input.setPlaceholderText("教材名称")
        form_layout.addRow("教材名:", textbook_name_input)
        self._form_widgets["textbook_name"] = textbook_name_input

        author_input = QLineEdit()
        author_input.setPlaceholderText("主编姓名")
        form_layout.addRow("主编:", author_input)
        self._form_widgets["author"] = author_input

        publisher_input = QLineEdit()
        publisher_input.setPlaceholderText("出版社")
        form_layout.addRow("出版社:", publisher_input)
        self._form_widgets["publisher"] = publisher_input

        volume_combo = QComboBox()
        volume_combo.addItem("无上下册", "")
        volume_combo.addItem("上册", "上册")
        volume_combo.addItem("下册", "下册")
        form_layout.addRow("上下册:", volume_combo)
        self._form_widgets["volume"] = volume_combo

    def _create_exam_form(self, form_layout):
        key_input = QLineEdit()
        key_input.setPlaceholderText("蓝奏云链接或12位密钥")
        form_layout.addRow("密钥/链接:", key_input)
        self._form_widgets["key"] = key_input

        semester_input = QLineEdit()
        semester_input.setPlaceholderText("如 2024秋")
        form_layout.addRow("学期:", semester_input)
        self._form_widgets["semester"] = semester_input

        paper_type_combo = QComboBox()
        paper_type_combo.addItem("A卷", "A卷")
        paper_type_combo.addItem("B卷", "B卷")
        paper_type_combo.addItem("补考卷", "补考卷")
        form_layout.addRow("试卷类型:", paper_type_combo)
        self._form_widgets["paper_type"] = paper_type_combo

    def _create_online_form(self, form_layout):
        platform_combo = QComboBox()
        platform_combo.addItems(["学堂在线", "B站", "慕课网", "其他"])
        platform_combo.setEditable(True)
        form_layout.addRow("平台:", platform_combo)
        self._form_widgets["platform"] = platform_combo

        platform_url_input = QLineEdit()
        platform_url_input.setPlaceholderText("平台主页链接（可选）")
        form_layout.addRow("平台链接:", platform_url_input)
        self._form_widgets["platform_url"] = platform_url_input

        course_name_input = QLineEdit()
        course_name_input.setPlaceholderText("网课课程名")
        form_layout.addRow("课程名:", course_name_input)
        self._form_widgets["course_name"] = course_name_input

        course_url_input = QLineEdit()
        course_url_input.setPlaceholderText("课程链接或蓝奏云密钥")
        form_layout.addRow("课程链接:", course_url_input)
        self._form_widgets["course_url"] = course_url_input

        contributor_input = QLineEdit()
        contributor_input.setPlaceholderText("贡献者名称")
        form_layout.addRow("贡献者:", contributor_input)
        self._form_widgets["contributor"] = contributor_input

        contributor_url_input = QLineEdit()
        contributor_url_input.setPlaceholderText("贡献者主页链接（可选）")
        form_layout.addRow("贡献者链接:", contributor_url_input)
        self._form_widgets["contributor_url"] = contributor_url_input

    def _on_submit(self):
        self._data["course_code"] = self._form_widgets["course_code"].text().strip()

        if not self._data["course_code"]:
            QMessageBox.warning(self, "提示", "请输入课程编号")
            return

        if self.resource_type == "textbook":
            self._validate_textbook()
        elif self.resource_type == "exam":
            self._validate_exam()
        elif self.resource_type == "online":
            self._validate_online()

    def _validate_textbook(self):
        key_raw = self._form_widgets["key"].text().strip()
        key = extract_lanzou_key(key_raw)

        if not key:
            QMessageBox.warning(self, "提示", "请输入有效的蓝奏云链接或12位密钥")
            return

        self._data["key"] = key
        self._data["textbook_name"] = self._form_widgets["textbook_name"].text().strip()
        self._data["author"] = self._form_widgets["author"].text().strip()
        self._data["publisher"] = self._form_widgets["publisher"].text().strip()

        if not self._data["textbook_name"]:
            QMessageBox.warning(self, "提示", "请输入教材名称")
            return

        if not self._data["author"]:
            QMessageBox.warning(self, "提示", "请输入主编姓名")
            return

        if not self._data["publisher"]:
            QMessageBox.warning(self, "提示", "请输入出版社")
            return

        volume_combo = self._form_widgets["volume"]
        self._data["volume"] = volume_combo.currentData()

        self.accept()

    def _validate_exam(self):
        key_raw = self._form_widgets["key"].text().strip()
        key = extract_lanzou_key(key_raw)

        if not key:
            QMessageBox.warning(self, "提示", "请输入有效的蓝奏云链接或12位密钥")
            return

        self._data["key"] = key
        self._data["semester"] = self._form_widgets["semester"].text().strip()

        if not self._data["semester"]:
            QMessageBox.warning(self, "提示", "请输入学期")
            return

        paper_type_combo = self._form_widgets["paper_type"]
        self._data["paper_type"] = paper_type_combo.currentData()

        self.accept()

    def _validate_online(self):
        platform_combo = self._form_widgets["platform"]
        self._data["platform"] = platform_combo.currentText().strip()

        if not self._data["platform"]:
            QMessageBox.warning(self, "提示", "请输入平台名称")
            return

        self._data["platform_url"] = self._form_widgets["platform_url"].text().strip()

        self._data["course_name"] = self._form_widgets["course_name"].text().strip()

        if not self._data["course_name"]:
            QMessageBox.warning(self, "提示", "请输入课程名称")
            return

        course_url_raw = self._form_widgets["course_url"].text().strip()
        key = extract_lanzou_key(course_url_raw)

        if key:
            from utils import build_api_url

            self._data["course_url"] = build_api_url(key)
        else:
            if not course_url_raw.startswith("http"):
                QMessageBox.warning(self, "提示", "请输入有效的课程链接或蓝奏云密钥")
                return
            self._data["course_url"] = course_url_raw

        self._data["contributor"] = self._form_widgets["contributor"].text().strip()

        if not self._data["contributor"]:
            QMessageBox.warning(self, "提示", "请输入贡献者名称")
            return

        self._data["contributor_url"] = (
            self._form_widgets["contributor_url"].text().strip()
        )

        self.accept()

    def get_data(self) -> dict:
        return self._data
