"""
资源构建器组件
管理多个课程Tab卡片
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QFrame,
    QInputDialog,
    QMessageBox,
    QSizePolicy,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from typing import Dict, List, Optional
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from gui.widgets.course_tab_card import CourseTabCard
from gui.widgets.draggable_cards_container import DraggableCardsContainer
from utils import validate_course_code


class ResourceBuilder(QWidget):
    """资源构建器"""

    data_changed = Signal()

    def __init__(self):
        super().__init__()
        self._tab_cards: List[CourseTabCard] = []
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        header_layout = QHBoxLayout()

        title_label = QLabel("资源区")
        title_label.setFont(QFont("Microsoft YaHei UI", 11, QFont.Bold))
        title_label.setStyleSheet("color: #FFFFFF;")
        header_layout.addWidget(title_label)

        header_layout.addStretch()

        hint_label = QLabel("为每个课程编号添加资源")
        hint_label.setStyleSheet("color: #B0B0B0; font-size: 10px;")
        header_layout.addWidget(hint_label)

        layout.addLayout(header_layout)

        add_layout = QHBoxLayout()

        add_tab_btn = QPushButton("+ 添加课程资源包")
        add_tab_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                padding: 8px 16px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #66BB6A;
            }
        """)
        add_tab_btn.clicked.connect(self._add_course_tab)
        add_layout.addWidget(add_tab_btn)

        add_layout.addStretch()

        layout.addLayout(add_layout)

        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        scroll_area.setStyleSheet("""
            QScrollArea {
                border: 1px solid #3A3A3A;
                border-radius: 6px;
                background-color: #2D2D2D;
            }
        """)

        self.cards_container = DraggableCardsContainer()
        self.cards_container.order_changed.connect(self.data_changed.emit)
        scroll_area.setWidget(self.cards_container)
        layout.addWidget(scroll_area)

    def _add_course_tab(self, initial_data: Optional[Dict] = None):
        if initial_data and initial_data.get("course_code"):
            course_code = initial_data["course_code"]
        else:
            dialog = QInputDialog(self)
            dialog.setWindowTitle("添加课程资源包")
            dialog.setLabelText("请输入课程编号（如 MATH10821）:")
            dialog.setTextValue("")

            if dialog.exec() != QInputDialog.Accepted:
                return

            course_code = dialog.textValue().strip()

            if not course_code:
                QMessageBox.warning(self, "提示", "课程编号不能为空")
                return

            if not validate_course_code(course_code):
                QMessageBox.warning(
                    self,
                    "提示",
                    f"课程编号格式有误，应为类似 ABC12345 的格式\n您输入的是: {course_code}",
                )
                return

            for card in self._tab_cards:
                if card.get_course_code() == course_code:
                    QMessageBox.warning(
                        self, "提示", f"课程编号 '{course_code}' 已存在"
                    )
                    return

        card = CourseTabCard(course_code, initial_data)
        card.delete_requested.connect(self._remove_tab)
        card.data_changed.connect(self.data_changed.emit)

        self.cards_container.add_card(card, "course_tab")
        self._tab_cards.append(card)

        self.data_changed.emit()

    def _remove_tab(self, card: QWidget):
        if card in self._tab_cards:
            self._tab_cards.remove(card)
        self.cards_container.remove_card(card)
        self.data_changed.emit()

    def get_data(self) -> Dict:
        """获取所有资源数据"""
        tabs = {}
        for card in self._tab_cards:
            data = card.get_data()
            course_code = data.get("course_code", "")
            if course_code and (
                data.get("textbooks")
                or data.get("documents")
                or data.get("exam_groups")
                or data.get("online_courses")
            ):
                tabs[course_code] = data

        return {"tabs": tabs}

    def set_data(self, data: Dict):
        """设置所有资源数据"""
        self.clear()

        tabs = data.get("tabs", {})
        for course_code, tab_data in tabs.items():
            self._add_course_tab(tab_data)

    def clear(self):
        self.cards_container.clear()
        self._tab_cards.clear()

    def has_content(self) -> bool:
        """检查是否有内容"""
        return bool(self._tab_cards)
