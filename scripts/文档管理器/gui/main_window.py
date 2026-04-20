"""
主窗口组件
左侧导航栏 + 右侧工作区
"""

from PySide6.QtWidgets import (
    QMainWindow,
    QWidget,
    QHBoxLayout,
    QVBoxLayout,
    QStackedWidget,
    QLabel,
    QToolBar,
    QLineEdit,
    QPushButton,
    QStatusBar,
)
from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QIcon, QAction

from gui.sidebar import Sidebar
from gui.views.dashboard import DashboardView
from gui.views.course_manager import CourseManagerView
from gui.views.staging_area import StagingAreaView
from gui.views.backup_area import BackupAreaView


class MainWindow(QMainWindow):
    """主窗口"""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("CQU-openlib 文档管理器")
        self.setMinimumSize(1200, 800)
        self.resize(1400, 900)

        self._init_ui()
        self._init_toolbar()
        self._init_statusbar()

    def _init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        self.sidebar = Sidebar()
        self.sidebar.setFixedWidth(200)
        main_layout.addWidget(self.sidebar)

        self.workspace = QWidget()
        workspace_layout = QVBoxLayout(self.workspace)
        workspace_layout.setContentsMargins(10, 10, 10, 10)

        self.stacked_widget = QStackedWidget()

        self.dashboard_view = DashboardView()
        self.course_manager_view = CourseManagerView()
        self.staging_area_view = StagingAreaView()
        self.backup_area_view = BackupAreaView()

        self.stacked_widget.addWidget(self.dashboard_view)
        self.stacked_widget.addWidget(self.course_manager_view)
        self.stacked_widget.addWidget(self.staging_area_view)
        self.stacked_widget.addWidget(self.backup_area_view)

        workspace_layout.addWidget(self.stacked_widget)
        main_layout.addWidget(self.workspace)

        self.sidebar.navigation_changed.connect(self._on_navigation_changed)

    def _init_toolbar(self):
        toolbar = QToolBar("主工具栏")
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(24, 24))
        self.addToolBar(toolbar)

        search_action = QAction("搜索课程", self)
        toolbar.addAction(search_action)

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("搜索课程名称或编号...")
        self.search_input.setFixedWidth(300)
        toolbar.addWidget(self.search_input)

        self.search_input.textChanged.connect(self._on_search_changed)

        toolbar.addSeparator()

        new_course_action = QAction("新建课程", self)
        new_course_action.triggered.connect(self._on_new_course)
        toolbar.addAction(new_course_action)

        refresh_action = QAction("刷新", self)
        refresh_action.triggered.connect(self._on_refresh)
        toolbar.addAction(refresh_action)

    def _init_statusbar(self):
        self.statusbar = QStatusBar()
        self.setStatusBar(self.statusbar)
        self.statusbar.showMessage("就绪")

    def _on_navigation_changed(self, view_name: str):
        if view_name == "dashboard":
            self.stacked_widget.setCurrentWidget(self.dashboard_view)
            self.statusbar.showMessage("仪表盘")
        elif view_name == "course_manager":
            self.stacked_widget.setCurrentWidget(self.course_manager_view)
            self.statusbar.showMessage("课程库管理")
        elif view_name == "staging_area":
            self.stacked_widget.setCurrentWidget(self.staging_area_view)
            self.statusbar.showMessage("暂存区处理")
        elif view_name == "backup_area":
            self.stacked_widget.setCurrentWidget(self.backup_area_view)
            self.statusbar.showMessage("备份与恢复")

    def _on_search_changed(self, text: str):
        self.course_manager_view.filter_courses(text)

    def _on_new_course(self):
        self.course_manager_view.create_new_course()

    def _on_refresh(self):
        current_view = self.stacked_widget.currentWidget()
        if hasattr(current_view, "refresh"):
            current_view.refresh()
        self.statusbar.showMessage("已刷新", 2000)
