"""
GUI包初始化文件
"""

from gui.main_window import MainWindow
from gui.sidebar import Sidebar
from gui.views.dashboard import DashboardView
from gui.views.course_manager import CourseManagerView
from gui.views.staging_area import StagingAreaView
from gui.views.backup_area import BackupAreaView
from gui.models.course_model import CourseTableModel
from gui.dialogs.add_resource_dialog import AddResourceDialog
from gui.dialogs.create_course_dialog import CreateCourseDialog
