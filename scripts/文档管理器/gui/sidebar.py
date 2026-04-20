"""
侧边导航栏组件
"""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QPushButton, QLabel
from PySide6.QtCore import Signal, Qt
from PySide6.QtGui import QFont


class NavigationButton(QPushButton):
    """导航按钮"""

    def __init__(self, text: str, icon_text: str = "", view_name: str = ""):
        super().__init__()
        self.view_name = view_name
        self._active = False

        self.setText(f"{icon_text}  {text}")
        self.setFont(QFont("Microsoft YaHei UI", 11))
        self.setFixedHeight(45)
        self.setCursor(Qt.PointingHandCursor)

        self.setStyleSheet("""
            NavigationButton {
                border: none;
                border-radius: 8px;
                padding: 8px 12px;
                text-align: left;
                background-color: transparent;
                color: #B0B0B0;
            }
            NavigationButton:hover {
                background-color: #3A3A3A;
                color: #FFFFFF;
            }
            NavigationButton[active="true"] {
                background-color: #4CAF50;
                color: #FFFFFF;
            }
        """)

    def set_active(self, active: bool):
        self._active = active
        self.setProperty("active", active)
        self.style().unpolish(self)
        self.style().polish(self)


class Sidebar(QWidget):
    """侧边导航栏"""

    navigation_changed = Signal(str)

    def __init__(self):
        super().__init__()
        self._current_active = None
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 20, 10, 20)
        layout.setSpacing(5)

        title_label = QLabel("文档管理器")
        title_label.setFont(QFont("Microsoft YaHei UI", 14, QFont.Bold))
        title_label.setAlignment(Qt.AlignCenter)
        title_label.setStyleSheet("color: #FFFFFF; padding: 10px;")
        layout.addWidget(title_label)

        layout.addSpacing(20)

        self.dashboard_btn = NavigationButton("仪表盘", "📊", "dashboard")
        self.dashboard_btn.clicked.connect(self._on_dashboard_clicked)
        layout.addWidget(self.dashboard_btn)

        self.course_btn = NavigationButton("课程库管理", "📚", "course_manager")
        self.course_btn.clicked.connect(self._on_course_clicked)
        layout.addWidget(self.course_btn)

        self.staging_btn = NavigationButton("暂存区处理", "📝", "staging_area")
        self.staging_btn.clicked.connect(self._on_staging_clicked)
        layout.addWidget(self.staging_btn)

        self.backup_btn = NavigationButton("备份与恢复", "💾", "backup_area")
        self.backup_btn.clicked.connect(self._on_backup_clicked)
        layout.addWidget(self.backup_btn)

        layout.addStretch()

        version_label = QLabel("v1.0.0")
        version_label.setAlignment(Qt.AlignCenter)
        version_label.setStyleSheet("color: #606060; font-size: 10px;")
        layout.addWidget(version_label)

        self._set_active(self.dashboard_btn)

    def _set_active(self, button: NavigationButton):
        if self._current_active:
            self._current_active.set_active(False)
        button.set_active(True)
        self._current_active = button

    def _on_dashboard_clicked(self):
        self._set_active(self.dashboard_btn)
        self.navigation_changed.emit("dashboard")

    def _on_course_clicked(self):
        self._set_active(self.course_btn)
        self.navigation_changed.emit("course_manager")

    def _on_staging_clicked(self):
        self._set_active(self.staging_btn)
        self.navigation_changed.emit("staging_area")

    def _on_backup_clicked(self):
        self._set_active(self.backup_btn)
        self.navigation_changed.emit("backup_area")
