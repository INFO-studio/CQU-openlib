"""
备份与恢复视图
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QLabel,
    QTreeWidget,
    QTreeWidgetItem,
    QListWidget,
    QSplitter,
    QMessageBox,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from pathlib import Path
from typing import Optional
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import BACKUP_DIR, COURSE_DIR
from workspace import WorkspaceManager


class BackupAreaView(QWidget):
    """备份与恢复视图"""

    def __init__(self):
        super().__init__()
        self.workspace = WorkspaceManager()
        self._current_backup: Optional[Path] = None
        self._current_date: str = ""
        self._init_ui()
        self.refresh()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)

        header_layout = QHBoxLayout()

        title = QLabel("备份与恢复")
        title.setFont(QFont("Microsoft YaHei UI", 16, QFont.Bold))
        title.setStyleSheet("color: #FFFFFF;")
        header_layout.addWidget(title)

        header_layout.addStretch()

        self.backup_count_label = QLabel("共 0 个备份日期")
        self.backup_count_label.setStyleSheet("color: #B0B0B0;")
        header_layout.addWidget(self.backup_count_label)

        layout.addLayout(header_layout)

        splitter = QSplitter(Qt.Horizontal)

        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)

        date_label = QLabel("备份日期")
        date_label.setFont(QFont("Microsoft YaHei UI", 11))
        left_layout.addWidget(date_label)

        self.date_tree = QTreeWidget()
        self.date_tree.setHeaderHidden(True)
        self.date_tree.currentItemChanged.connect(self._on_date_selected)
        left_layout.addWidget(self.date_tree)

        splitter.addWidget(left_panel)

        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)

        file_label = QLabel("备份文件")
        file_label.setFont(QFont("Microsoft YaHei UI", 11))
        right_layout.addWidget(file_label)

        self.file_list = QListWidget()
        self.file_list.currentItemChanged.connect(self._on_file_selected)
        right_layout.addWidget(self.file_list)

        action_layout = QHBoxLayout()

        self.info_label = QLabel("")
        self.info_label.setStyleSheet("color: #B0B0B0;")
        action_layout.addWidget(self.info_label)

        action_layout.addStretch()

        self.restore_btn = QPushButton("一键恢复")
        self.restore_btn.setEnabled(False)
        self.restore_btn.clicked.connect(self._on_restore)
        action_layout.addWidget(self.restore_btn)

        view_btn = QPushButton("查看内容")
        view_btn.clicked.connect(self._on_view_content)
        action_layout.addWidget(view_btn)

        right_layout.addLayout(action_layout)

        splitter.addWidget(right_panel)

        splitter.setSizes([200, 400])

        layout.addWidget(splitter)

    def refresh(self):
        self.date_tree.clear()

        backup_dates = self.workspace.list_backup_dates()

        for date in backup_dates:
            item = QTreeWidgetItem([date])
            backups = self.workspace.list_backups_by_date(date)
            item.setData(0, Qt.UserRole, date)
            item.setData(0, Qt.UserRole + 1, len(backups))
            self.date_tree.addTopLevelItem(item)

        self.backup_count_label.setText(f"共 {len(backup_dates)} 个备份日期")

        if backup_dates:
            self.date_tree.setCurrentItem(self.date_tree.topLevelItem(0))

    def _on_date_selected(self, current, previous):
        if not current:
            return

        date = current.data(0, Qt.UserRole)

        self.file_list.clear()

        backups = self.workspace.list_backups_by_date(date)

        for backup_path in backups:
            self.file_list.addItem(backup_path.name)

        self._current_date = date

    def _on_file_selected(self, current, previous):
        if not current:
            self.restore_btn.setEnabled(False)
            return

        file_name = current.text()
        date = self._current_date

        self._current_backup = BACKUP_DIR / date / file_name

        self.restore_btn.setEnabled(True)

        course_name = file_name.replace(".md.bak", "")
        target_path = COURSE_DIR / f"{course_name}.md"

        status = "存在" if target_path.exists() else "不存在"
        self.info_label.setText(f"目标文件 '{course_name}.md' {status}")

    def _on_restore(self):
        if not self._current_backup:
            return

        file_name = self._current_backup.name
        course_name = file_name.replace(".md.bak", "")
        target_path = COURSE_DIR / f"{course_name}.md"

        reply = QMessageBox.question(
            self,
            "确认恢复",
            f"是否将备份 '{file_name}' 恢复到课程库？\n目标: {course_name}.md\n"
            + (
                "当前文件将被新备份覆盖。" if target_path.exists() else "将创建新文件。"
            ),
            QMessageBox.Yes | QMessageBox.No,
        )

        if reply != QMessageBox.Yes:
            return

        try:
            success = self.workspace.restore_from_backup(
                self._current_backup, target_path
            )

            if success:
                QMessageBox.information(
                    self, "恢复成功", f"备份已恢复到:\n{target_path}"
                )
            else:
                QMessageBox.warning(self, "恢复失败", "无法读取备份文件")
        except Exception as e:
            QMessageBox.critical(self, "错误", f"恢复失败:\n{str(e)}")

    def _on_view_content(self):
        if not self._current_backup:
            return

        try:
            content = self._current_backup.read_text(encoding="utf-8")

            from PySide6.QtWidgets import QDialog, QVBoxLayout, QTextEdit

            dialog = QDialog(self)
            dialog.setWindowTitle(f"查看备份: {self._current_backup.name}")
            dialog.resize(600, 400)

            layout = QVBoxLayout(dialog)

            editor = QTextEdit()
            editor.setPlainText(content)
            editor.setReadOnly(True)
            editor.setFont(QFont("Consolas", 10))
            layout.addWidget(editor)

            dialog.exec()
        except Exception as e:
            QMessageBox.critical(self, "错误", f"无法读取备份:\n{str(e)}")
