"""
课程库管理视图
显示课程列表，支持添加资源和编辑课程
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QTableView,
    QLabel,
    QMessageBox,
    QDialog,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from pathlib import Path
import sys
import datetime as dt

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from gui.models.course_model import CourseTableModel
from gui.dialogs.add_resource_dialog import AddResourceDialog
from gui.dialogs.create_course_dialog import CreateCourseDialog

from config import COURSE_DIR
from workspace import WorkspaceManager
from modifier import DocumentModifier
from parser import DocumentParser
from validator import DocumentValidator


class CourseManagerView(QWidget):
    """课程库管理视图"""

    course_updated = Signal()

    def __init__(self):
        super().__init__()
        self.workspace = WorkspaceManager()
        self._init_ui()
        self.refresh()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(8)

        action_layout = QHBoxLayout()
        action_layout.setSpacing(10)

        edit_btn = QPushButton("编辑课程")
        edit_btn.clicked.connect(self._on_edit_course)
        action_layout.addWidget(edit_btn)

        add_textbook_btn = QPushButton("添加教材")
        add_textbook_btn.clicked.connect(self._on_add_textbook)
        action_layout.addWidget(add_textbook_btn)

        add_exam_btn = QPushButton("添加试卷")
        add_exam_btn.clicked.connect(self._on_add_exam)
        action_layout.addWidget(add_exam_btn)

        add_online_btn = QPushButton("添加网课")
        add_online_btn.clicked.connect(self._on_add_online)
        action_layout.addWidget(add_online_btn)

        action_layout.addStretch()

        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self.refresh)
        action_layout.addWidget(refresh_btn)

        new_course_btn = QPushButton("新建")
        new_course_btn.clicked.connect(self.create_new_course)
        action_layout.addWidget(new_course_btn)

        layout.addLayout(action_layout)

        self.table_view = QTableView()
        self.table_view.setSelectionBehavior(QTableView.SelectionBehavior.SelectRows)
        self.table_view.setSelectionMode(QTableView.SelectionMode.SingleSelection)
        self.table_view.setAlternatingRowColors(True)
        self.table_view.horizontalHeader().setStretchLastSection(True)
        self.table_view.verticalHeader().setVisible(False)
        self.table_view.setEditTriggers(QTableView.EditTrigger.NoEditTriggers)
        self.table_view.doubleClicked.connect(self._on_row_double_clicked)

        layout.addWidget(self.table_view)

        self.status_label = QLabel("")
        self.status_label.setStyleSheet("color: #B0B0B0;")
        layout.addWidget(self.status_label)

    def refresh(self):
        self._load_courses()
        self._update_table()

    def _load_courses(self):
        self._courses = []

        course_files = list(COURSE_DIR.glob("*.md"))

        for course_file in course_files:
            course_name = course_file.stem

            try:
                parser = DocumentParser(str(course_file))
                structure = parser.parse()
                validator = DocumentValidator(structure)
                validator.validate()

                is_valid = structure.is_valid
                course_codes = []

                for section in structure.sections.values():
                    for tab in section.tabs:
                        course_codes.append(tab.course_code)

                mod_time = dt.datetime.fromtimestamp(course_file.stat().st_mtime)

                self._courses.append(
                    {
                        "name": course_name,
                        "codes": course_codes,
                        "is_valid": is_valid,
                        "errors": structure.validation_errors if not is_valid else [],
                        "file_path": course_file,
                        "mod_time": mod_time,
                    }
                )
            except Exception as e:
                self._courses.append(
                    {
                        "name": course_name,
                        "codes": [],
                        "is_valid": False,
                        "errors": [str(e)],
                        "file_path": course_file,
                        "mod_time": dt.datetime.fromtimestamp(
                            course_file.stat().st_mtime
                        ),
                    }
                )

    def _update_table(self):
        self.model = CourseTableModel(self._courses)
        self.table_view.setModel(self.model)

        self.table_view.setColumnWidth(0, 200)
        self.table_view.setColumnWidth(1, 150)
        self.table_view.setColumnWidth(2, 100)
        self.table_view.setColumnWidth(3, 180)
        self.table_view.setColumnWidth(4, 150)

        valid_count = sum(1 for c in self._courses if c["is_valid"])
        self.status_label.setText(
            f"共 {len(self._courses)} 门课程，{valid_count} 个合规"
        )

    def filter_courses(self, text: str):
        if not text:
            self.model.set_courses(self._courses)
            return

        filtered = [
            c
            for c in self._courses
            if text.lower() in c["name"].lower()
            or any(text in code for code in c["codes"])
        ]
        self.model.set_courses(filtered)

    def _get_selected_course(self):
        indexes = self.table_view.selectionModel().selectedRows()
        if not indexes:
            QMessageBox.warning(self, "提示", "请先选择一门课程")
            return None

        row = indexes[0].row()
        return self.model.get_course(row)

    def _on_row_double_clicked(self, index):
        course = self.model.get_course(index.row())
        if course is None:
            return

        if course["is_valid"]:
            self._open_course_editor(course)
        else:
            QMessageBox.information(
                self,
                "文档不合规",
                f"文档 '{course['name']}' 不合规:\n"
                + "\n".join(course["errors"][:3])
                + "\n\n已移入暂存区，请手动处理",
            )
            self.workspace.move_to_staging(course["file_path"])
            self.refresh()

    def _open_course_editor(self, course: dict):
        """打开合规课程编辑 - 复制到暂存区处理"""
        file_path = course["file_path"]

        self.workspace.backup_file(file_path)

        staging_path = self.workspace.move_to_staging(file_path)

        QMessageBox.information(
            self,
            "已移入暂存区",
            f"文档已复制到暂存区:\n{staging_path}\n\n"
            "请在左侧导航点击「暂存区处理」进行编辑，\n"
            "编辑完成后点击「覆盖」将修改写回课程库。",
        )
        self.refresh()

    def _on_edit_course(self):
        """编辑按钮点击"""
        course = self._get_selected_course()
        if course is None:
            return

        if not course["is_valid"]:
            QMessageBox.warning(self, "操作受限", "该文档不合规，请双击移入暂存区处理")
            return

        self._open_course_editor(course)

    def _on_add_textbook(self):
        course = self._get_selected_course()
        if course is None:
            return

        if not course["is_valid"]:
            QMessageBox.warning(self, "操作受限", "该文档不合规，无法直接添加资源")
            return

        dialog = AddResourceDialog(course, "textbook", self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            data = dialog.get_data()
            self._add_textbook_to_course(course, data)

    def _on_add_exam(self):
        course = self._get_selected_course()
        if course is None:
            return

        if not course["is_valid"]:
            QMessageBox.warning(self, "操作受限", "该文档不合规，无法直接添加资源")
            return

        dialog = AddResourceDialog(course, "exam", self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            data = dialog.get_data()
            self._add_exam_to_course(course, data)

    def _on_add_online(self):
        course = self._get_selected_course()
        if course is None:
            return

        if not course["is_valid"]:
            QMessageBox.warning(self, "操作受限", "该文档不合规，无法直接添加资源")
            return

        dialog = AddResourceDialog(course, "online", self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            data = dialog.get_data()
            self._add_online_to_course(course, data)

    def _add_textbook_to_course(self, course: dict, data: dict):
        try:
            modifier = DocumentModifier(course["file_path"])
            modifier.load_and_validate()

            success = modifier.add_textbook(
                data["course_code"],
                data["key"],
                data["textbook_name"],
                data["author"],
                data["publisher"],
                data.get("volume"),
            )

            if success:
                QMessageBox.information(self, "成功", f"已添加教材到 {course['name']}")
                self.refresh()
                self.course_updated.emit()
            else:
                QMessageBox.warning(self, "失败", "添加教材失败")
        except Exception as e:
            QMessageBox.critical(self, "错误", f"添加教材时发生错误:\n{str(e)}")

    def _add_exam_to_course(self, course: dict, data: dict):
        try:
            modifier = DocumentModifier(course["file_path"])
            modifier.load_and_validate()

            success = modifier.add_exam_paper(
                data["course_code"],
                data["key"],
                "试卷+答案",
                data["semester"],
                data["paper_type"],
            )

            if success:
                QMessageBox.information(self, "成功", f"已添加试卷到 {course['name']}")
                self.refresh()
                self.course_updated.emit()
            else:
                QMessageBox.warning(self, "失败", "添加试卷失败")
        except Exception as e:
            QMessageBox.critical(self, "错误", f"添加试卷时发生错误:\n{str(e)}")

    def _add_online_to_course(self, course: dict, data: dict):
        try:
            modifier = DocumentModifier(course["file_path"])
            modifier.load_and_validate()

            success = modifier.add_online_course_with_contributor(
                data["course_code"],
                data["platform"],
                data.get("platform_url", ""),
                data["course_name"],
                data["course_url"],
                data["contributor"],
                data.get("contributor_url"),
            )

            if success:
                QMessageBox.information(self, "成功", f"已添加网课到 {course['name']}")
                self.refresh()
                self.course_updated.emit()
            else:
                QMessageBox.warning(self, "失败", "添加网课失败")
        except Exception as e:
            QMessageBox.critical(self, "错误", f"添加网课时发生错误:\n{str(e)}")

    def create_new_course(self):
        dialog = CreateCourseDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            data = dialog.get_data()
            staging_path = self.workspace.create_course_file(
                data["course_name"], data.get("course_code", "")
            )
            QMessageBox.information(
                self,
                "已创建",
                f"课程文件已创建到暂存区:\n{staging_path}\n请编辑后使其合规",
            )
