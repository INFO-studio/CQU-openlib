"""
仪表盘视图
显示系统概览和统计信息
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QGroupBox,
    QGridLayout,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import COURSE_DIR, STAGING_DIR, BACKUP_DIR
from workspace import WorkspaceManager


class StatCard(QWidget):
    """统计卡片"""

    def __init__(self, title: str, value: str, color: str = "#4CAF50"):
        super().__init__()
        self.setFixedHeight(100)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(15, 10, 15, 10)

        title_label = QLabel(title)
        title_label.setFont(QFont("Microsoft YaHei UI", 10))
        title_label.setStyleSheet("color: #B0B0B0;")

        value_label = QLabel(value)
        value_label.setFont(QFont("Microsoft YaHei UI", 28, QFont.Bold))
        value_label.setStyleSheet(f"color: {color};")
        value_label.setAlignment(Qt.AlignCenter)

        layout.addWidget(title_label)
        layout.addWidget(value_label)

        self.setStyleSheet("""
            StatCard {
                background-color: #353535;
                border-radius: 8px;
            }
        """)


class DashboardView(QWidget):
    """仪表盘视图"""

    def __init__(self):
        super().__init__()
        self.workspace = WorkspaceManager()
        self._init_ui()
        self.refresh()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(20)

        title = QLabel("系统概览")
        title.setFont(QFont("Microsoft YaHei UI", 16, QFont.Bold))
        title.setStyleSheet("color: #FFFFFF;")
        layout.addWidget(title)

        stats_layout = QHBoxLayout()
        stats_layout.setSpacing(15)

        self.total_courses_card = StatCard("课程总数", "0", "#4CAF50")
        self.valid_courses_card = StatCard("合规文档", "0", "#66BB6A")
        self.invalid_courses_card = StatCard("待处理文档", "0", "#FF5722")
        self.staging_files_card = StatCard("暂存区文件", "0", "#FFC107")
        self.backup_count_card = StatCard("备份总数", "0", "#2196F3")

        stats_layout.addWidget(self.total_courses_card)
        stats_layout.addWidget(self.valid_courses_card)
        stats_layout.addWidget(self.invalid_courses_card)
        stats_layout.addWidget(self.staging_files_card)
        stats_layout.addWidget(self.backup_count_card)

        layout.addLayout(stats_layout)

        info_group = QGroupBox("快速操作提示")
        info_layout = QVBoxLayout(info_group)

        tips = [
            "• 使用顶部搜索栏快速查找课程",
            "• 点击左侧导航切换不同管理视图",
            "• 在课程库管理中点击课程行可添加资源",
            "• 不合规文档会自动移入暂存区等待处理",
            "• 备份区按日期组织，可一键恢复",
        ]

        for tip in tips:
            tip_label = QLabel(tip)
            tip_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
            info_layout.addWidget(tip_label)

        layout.addWidget(info_group)

        layout.addStretch()

    def refresh(self):
        course_files = list(COURSE_DIR.glob("*.md"))
        total = len(course_files)

        valid_count = 0
        invalid_count = 0

        from parser import DocumentParser
        from validator import DocumentValidator

        for course_file in course_files:
            try:
                parser = DocumentParser(str(course_file))
                structure = parser.parse()
                validator = DocumentValidator(structure)
                validator.validate()
                if structure.is_valid:
                    valid_count += 1
                else:
                    invalid_count += 1
            except Exception:
                invalid_count += 1

        staging_files = self.workspace.list_staging_files()

        backup_dates = self.workspace.list_backup_dates()
        backup_count = sum(
            len(self.workspace.list_backups_by_date(d)) for d in backup_dates
        )

        self.total_courses_card.findChild(QLabel, "").setText(str(total))
        self._update_card_value(self.total_courses_card, str(total))
        self._update_card_value(self.valid_courses_card, str(valid_count))
        self._update_card_value(self.invalid_courses_card, str(invalid_count))
        self._update_card_value(self.staging_files_card, str(len(staging_files)))
        self._update_card_value(self.backup_count_card, str(backup_count))

    def _update_card_value(self, card: StatCard, value: str):
        for label in card.findChildren(QLabel):
            if label.font().bold():
                label.setText(value)
