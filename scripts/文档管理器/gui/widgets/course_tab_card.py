"""
课程Tab卡片组件
聚合教材、试卷、网课三种资源卡片
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QScrollArea,
    QSizePolicy,
    QLineEdit,
    QMenu,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont, QAction
from typing import Dict, List, Optional
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from gui.widgets.textbook_card import TextbookCard
from gui.widgets.document_card import DocumentCard
from gui.widgets.exam_card import ExamCard
from gui.widgets.exam_group_widget import ExamGroupWidget
from gui.widgets.online_course_card import OnlineCourseCard
from gui.widgets.draggable_cards_container import DraggableCardsContainer


class CourseTabCard(QFrame):
    """课程Tab卡片 - 可折叠"""

    delete_requested = Signal(QWidget)
    data_changed = Signal()

    def __init__(self, course_code: str = "", initial_data: Optional[Dict] = None):
        super().__init__()
        self._course_code = course_code
        self._data = initial_data or {}
        self._is_expanded = True
        self._textbook_cards: List[TextbookCard] = []
        self._document_cards: List[DocumentCard] = []
        self._exam_group_widgets: Dict[str, ExamGroupWidget] = {}
        self._online_cards: List[OnlineCourseCard] = []
        self._drag_start_pos = None
        self._init_ui()
        self._load_initial_data()

    def _init_ui(self):
        self.setFrameStyle(QFrame.StyledPanel | QFrame.Raised)
        self.setStyleSheet("""
            CourseTabCard {
                background-color: #303030;
                border: 2px solid #4CAF50;
                border-radius: 8px;
                margin: 5px;
            }
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        header_widget = QWidget()
        header_widget.setStyleSheet(
            "background-color: #4CAF50; border-radius: 6px 6px 0 0;"
        )
        header_widget.setFixedHeight(40)
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(10, 5, 10, 5)

        self.drag_handle = QLabel("⋮⋮")
        self.drag_handle.setFixedWidth(20)
        self.drag_handle.setStyleSheet("""
            QLabel {
                color: #B0B0B0;
                font-size: 16px;
                font-weight: bold;
                background-color: transparent;
            }
            QLabel:hover { color: #FFFFFF; }
        """)
        self.drag_handle.setCursor(Qt.CursorShape.SizeAllCursor)
        header_layout.addWidget(self.drag_handle)

        self.code_label = QLabel(f"📚 {self._course_code}")
        self.code_label.setFont(QFont("Microsoft YaHei UI", 11, QFont.Bold))
        self.code_label.setStyleSheet("color: #FFFFFF;")
        header_layout.addWidget(self.code_label)

        header_layout.addStretch()

        self.toggle_btn = QPushButton("折叠")
        self.toggle_btn.setFixedHeight(28)
        self.toggle_btn.setFixedWidth(65)
        self.toggle_btn.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        self.toggle_btn.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                color: #FFFFFF;
                border: 1px solid #FFFFFF;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 10px;
            }
            QPushButton:hover {
                background-color: rgba(255,255,255,0.2);
            }
        """)
        self.toggle_btn.clicked.connect(self._toggle_expand)
        header_layout.addWidget(self.toggle_btn)

        delete_btn = QPushButton("删除")
        delete_btn.setFixedHeight(28)
        delete_btn.setFixedWidth(65)
        delete_btn.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        delete_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF5722;
                color: white;
                font-size: 11px;
                padding: 4px 8px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #E64A19;
            }
        """)
        delete_btn.clicked.connect(self._on_delete)
        header_layout.addWidget(delete_btn)

        main_layout.addWidget(header_widget)

        self.content_widget = QWidget()
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setContentsMargins(10, 10, 10, 10)
        self.content_layout.setSpacing(8)

        code_edit_layout = QHBoxLayout()
        code_edit_label = QLabel("课程编号:")
        code_edit_label.setStyleSheet("color: #B0B0B0;")
        code_edit_layout.addWidget(code_edit_label)

        self.code_input = QLineEdit()
        self.code_input.setText(self._course_code)
        self.code_input.setPlaceholderText("如 MATH10821")
        self.code_input.textChanged.connect(self._on_code_changed)
        code_edit_layout.addWidget(self.code_input)

        self.content_layout.addLayout(code_edit_layout)

        action_layout = QHBoxLayout()
        action_layout.setSpacing(10)

        add_textbook_btn = QPushButton("+ 添加教材")
        add_textbook_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
            }
            QPushButton:hover {
                background-color: #66BB6A;
            }
        """)
        add_textbook_btn.clicked.connect(self._add_textbook)
        action_layout.addWidget(add_textbook_btn)

        add_doc_btn = QPushButton("+ 添加文档")
        add_doc_btn.setStyleSheet("""
            QPushButton {
                background-color: #00BCD4;
                color: white;
            }
            QPushButton:hover {
                background-color: #26C6DA;
            }
        """)
        add_doc_btn.clicked.connect(self._add_document)
        action_layout.addWidget(add_doc_btn)

        add_online_btn = QPushButton("+ 添加网课")
        add_online_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF9800;
                color: white;
            }
            QPushButton:hover {
                background-color: #FFB74D;
            }
        """)
        add_online_btn.clicked.connect(self._add_online)
        action_layout.addWidget(add_online_btn)

        exam_group_btn = QPushButton("+ 添加试卷分组")
        exam_group_btn.setStyleSheet("""
            QPushButton {
                background-color: #2196F3;
                color: white;
            }
            QPushButton:hover {
                background-color: #42A5F5;
            }
        """)
        exam_group_menu = QMenu(self)
        exam_group_menu.addAction("期末试卷", lambda: self._add_exam_group("期末试卷"))
        exam_group_menu.addAction("期中试卷", lambda: self._add_exam_group("期中试卷"))
        exam_group_menu.addAction("小测", lambda: self._add_exam_group("小测"))
        exam_group_btn.setMenu(exam_group_menu)
        action_layout.addWidget(exam_group_btn)

        action_layout.addStretch()

        self.content_layout.addLayout(action_layout)

        self.cards_container = DraggableCardsContainer()
        self.cards_container.order_changed.connect(self.data_changed.emit)
        self.content_layout.addWidget(self.cards_container)

        main_layout.addWidget(self.content_widget)

        if not self._is_expanded:
            self.content_widget.hide()

    def _load_initial_data(self):
        if not self._data:
            return

        if self._data.get("course_code"):
            self._course_code = self._data["course_code"]
            self.code_input.setText(self._course_code)
            self.code_label.setText(f"📚 {self._course_code}")

        for textbook in self._data.get("textbooks", []):
            self._add_textbook(textbook)

        for doc in self._data.get("documents", []):
            self._add_document(doc)

        for online in self._data.get("online_courses", []):
            self._add_online(online)

        exam_groups = self._data.get("exam_groups", {})
        for group_name, exams in exam_groups.items():
            self._add_exam_group(group_name, exams)

    def _toggle_expand(self):
        self._is_expanded = not self._is_expanded
        if self._is_expanded:
            self.content_widget.show()
            self.toggle_btn.setText("折叠")
        else:
            self.content_widget.hide()
            self.toggle_btn.setText("展开")

    def _on_delete(self):
        self.delete_requested.emit(self)

    def _on_code_changed(self, text):
        self._course_code = text.strip()
        self.code_label.setText(f"📚 {self._course_code}")
        self.data_changed.emit()

    def _add_textbook(self, data: Optional[Dict] = None):
        card = TextbookCard(data)
        card.delete_requested.connect(self._remove_card)
        card.data_changed.connect(self.data_changed.emit)
        self._textbook_cards.append(card)
        self.cards_container.add_card(card, TextbookCard.CARD_TYPE)
        self.data_changed.emit()

    def _add_exam_group(self, group_name: str, exams: Optional[List[Dict]] = None):
        """添加试卷分组"""
        if group_name in self._exam_group_widgets:
            return

        group_widget = ExamGroupWidget(group_name, exams)
        group_widget.group_deleted.connect(self._remove_exam_group)
        group_widget.data_changed.connect(self.data_changed.emit)
        self._exam_group_widgets[group_name] = group_widget
        self.cards_container.add_card(group_widget, ExamGroupWidget.CARD_TYPE)
        self.data_changed.emit()

    def _remove_exam_group(self, group_name: str):
        """删除试卷分组"""
        if group_name in self._exam_group_widgets:
            group_widget = self._exam_group_widgets[group_name]
            self.cards_container.remove_card(group_widget)
            del self._exam_group_widgets[group_name]
            self.data_changed.emit()

    def _add_online(self, data: Optional[Dict] = None):
        card = OnlineCourseCard(data)
        card.delete_requested.connect(self._remove_card)
        card.data_changed.connect(self.data_changed.emit)
        self._online_cards.append(card)
        self.cards_container.add_card(card, OnlineCourseCard.CARD_TYPE)
        self.data_changed.emit()

    def _add_document(self, data: Optional[Dict] = None):
        card = DocumentCard(data)
        card.delete_requested.connect(self._remove_card)
        card.data_changed.connect(self.data_changed.emit)
        self._document_cards.append(card)
        self.cards_container.add_card(card, DocumentCard.CARD_TYPE)
        self.data_changed.emit()

    def _remove_card(self, card: QWidget):
        if card in self._textbook_cards:
            self._textbook_cards.remove(card)
        elif card in self._document_cards:
            self._document_cards.remove(card)
        elif card in self._online_cards:
            self._online_cards.remove(card)

        self.cards_container.remove_card(card)
        self.data_changed.emit()

    def get_data(self) -> Dict:
        """获取卡片数据"""
        exam_groups = {}
        for group_name, group_widget in self._exam_group_widgets.items():
            exams = group_widget.get_data()
            if exams:
                exam_groups[group_name] = exams

        return {
            "course_code": self._course_code,
            "textbooks": [
                card.get_data() for card in self._textbook_cards if card.is_valid()
            ],
            "documents": [
                card.get_data() for card in self._document_cards if card.is_valid()
            ],
            "online_courses": [
                card.get_data() for card in self._online_cards if card.is_valid()
            ],
            "exam_groups": exam_groups,
        }

    def set_data(self, data: Dict):
        """设置卡片数据"""
        self._data = data
        self._load_initial_data()

    def is_valid(self) -> bool:
        """检查是否有有效内容"""
        has_exam_groups = any(
            not group.is_empty() for group in self._exam_group_widgets.values()
        )
        return bool(
            self._course_code
            and (
                self._textbook_cards
                or self._document_cards
                or has_exam_groups
                or self._online_cards
            )
        )

    def get_course_code(self) -> str:
        return self._course_code

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            handle_pos = self.drag_handle.mapFrom(self, event.position().toPoint())
            if self.drag_handle.rect().contains(handle_pos):
                self._drag_start_pos = event.position().toPoint()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self._drag_start_pos and event.buttons() & Qt.LeftButton:
            distance = (
                event.position().toPoint() - self._drag_start_pos
            ).manhattanLength()
            if distance > 10:
                from gui.widgets.draggable_cards_container import start_drag

                start_drag(self, "course_tab", self.get_data())
                self._drag_start_pos = None
        super().mouseMoveEvent(event)
