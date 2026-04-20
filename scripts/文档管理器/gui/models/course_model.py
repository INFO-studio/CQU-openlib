"""
课程表格数据模型
"""

from PySide6.QtCore import QAbstractTableModel, Qt, QModelIndex
from PySide6.QtGui import QColor, QFont
from typing import List, Dict, Optional
import datetime as dt


class CourseTableModel(QAbstractTableModel):
    """课程表格数据模型"""

    COLUMNS = ["课程名称", "课程编号", "合规状态", "最后修改", "操作"]

    def __init__(self, courses: Optional[List[Dict]] = None):
        super().__init__()
        self._courses: List[Dict] = courses or []
        self._valid_color = QColor(76, 175, 80)
        self._invalid_color = QColor(244, 67, 54)

    def set_courses(self, courses: List[Dict]):
        self._courses = courses
        self.layoutChanged.emit()

    def rowCount(self, parent=QModelIndex()):
        return len(self._courses)

    def columnCount(self, parent=QModelIndex()):
        return len(self.COLUMNS)

    def headerData(self, section, orientation, role):
        if role == Qt.DisplayRole and orientation == Qt.Horizontal:
            return self.COLUMNS[section]
        return None

    def data(self, index, role=Qt.DisplayRole):
        if not index.isValid() or not self._courses:
            return None

        row = index.row()
        col = index.column()
        course = self._courses[row]

        if role == Qt.DisplayRole:
            if col == 0:
                return course["name"]
            elif col == 1:
                codes = course.get("codes", [])
                return codes[0] if codes else "-"
            elif col == 2:
                return "合规" if course["is_valid"] else "不合规"
            elif col == 3:
                mod_time = course.get("mod_time", dt.datetime.now())
                return mod_time.strftime("%Y-%m-%d %H:%M")
            elif col == 4:
                return "查看/编辑"

        elif role == Qt.ForegroundRole:
            if col == 2:
                return self._valid_color if course["is_valid"] else self._invalid_color

        elif role == Qt.FontRole:
            if col == 2:
                font = QFont()
                font.setBold(True)
                return font

        elif role == Qt.TextAlignmentRole:
            if col == 2:
                return Qt.AlignCenter

        elif role == Qt.BackgroundRole:
            if col == 2:
                if course["is_valid"]:
                    return QColor(76, 175, 80, 40)
                else:
                    return QColor(244, 67, 54, 40)

        return None

    def get_course(self, row: int) -> Optional[Dict]:
        if 0 <= row < len(self._courses):
            return self._courses[row]
        return None

    def flags(self, index):
        if not index.isValid():
            return Qt.NoItemFlags

        return Qt.ItemIsEnabled | Qt.ItemIsSelectable | Qt.ItemIsSelectable
