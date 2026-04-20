"""
课外资源编辑区组件 - 类似资源区，但无试卷
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QFrame,
    QSizePolicy,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from typing import Dict, List, Optional
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from gui.widgets.textbook_card import TextbookCard
from gui.widgets.document_card import DocumentCard
from gui.widgets.online_course_card import OnlineCourseCard
from gui.widgets.draggable_cards_container import DraggableCardsContainer


class OtherResourceWidget(QFrame):
    """课外资源编辑区 - 无试卷分组"""

    data_changed = Signal()

    def __init__(self, initial_data: Optional[Dict] = None):
        super().__init__()
        self._data = initial_data or {}
        self._textbook_cards: List[TextbookCard] = []
        self._document_cards: List[DocumentCard] = []
        self._online_cards: List[OnlineCourseCard] = []
        self._init_ui()
        self._load_initial_data()

    def _init_ui(self):
        self.setStyleSheet("""
            OtherResourceWidget {
                background-color: #252525;
                border: 1px solid #555;
                border-radius: 8px;
            }
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)

        header_layout = QHBoxLayout()

        title_label = QLabel("课外资源")
        title_label.setFont(QFont("Microsoft YaHei UI", 12, QFont.Weight.Bold))
        title_label.setStyleSheet("color: #4CAF50;")
        header_layout.addWidget(title_label)

        header_layout.addStretch()

        add_textbook_btn = QPushButton("+ 添加教材")
        add_textbook_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #66BB6A;
            }
        """)
        add_textbook_btn.clicked.connect(self._add_textbook)
        header_layout.addWidget(add_textbook_btn)

        add_doc_btn = QPushButton("+ 添加文档")
        add_doc_btn.setStyleSheet("""
            QPushButton {
                background-color: #00BCD4;
                color: white;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #26C6DA;
            }
        """)
        add_doc_btn.clicked.connect(self._add_document)
        header_layout.addWidget(add_doc_btn)

        add_online_btn = QPushButton("+ 添加网课")
        add_online_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF9800;
                color: white;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #FFB74D;
            }
        """)
        add_online_btn.clicked.connect(self._add_online)
        header_layout.addWidget(add_online_btn)

        main_layout.addLayout(header_layout)

        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setStyleSheet("""
            QScrollArea {
                background-color: #252525;
                border: none;
            }
            QScrollBar:vertical {
                background-color: #2a2a2a;
                width: 10px;
            }
            QScrollBar::handle:vertical {
                background-color: #555;
                border-radius: 5px;
            }
        """)

        self.cards_container = DraggableCardsContainer()
        self.cards_container.order_changed.connect(self.data_changed.emit)
        scroll_area.setWidget(self.cards_container)
        main_layout.addWidget(scroll_area)

    def _load_initial_data(self):
        if not self._data:
            return

        for textbook in self._data.get("textbooks", []):
            self._add_textbook(textbook)

        for doc in self._data.get("documents", []):
            self._add_document(doc)

        for online in self._data.get("online_courses", []):
            self._add_online(online)

    def _add_textbook(self, data: Optional[Dict] = None):
        card = TextbookCard(data)
        card.delete_requested.connect(self._remove_card)
        card.data_changed.connect(self.data_changed.emit)
        self._textbook_cards.append(card)
        self.cards_container.add_card(card, "textbook")
        self.data_changed.emit()

    def _add_document(self, data: Optional[Dict] = None):
        card = DocumentCard(data)
        card.delete_requested.connect(self._remove_card)
        card.data_changed.connect(self.data_changed.emit)
        self._document_cards.append(card)
        self.cards_container.add_card(card, "document")
        self.data_changed.emit()

    def _add_online(self, data: Optional[Dict] = None):
        card = OnlineCourseCard(data)
        card.delete_requested.connect(self._remove_card)
        card.data_changed.connect(self.data_changed.emit)
        self._online_cards.append(card)
        self.cards_container.add_card(card, "online_course")
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
        """获取课外资源数据"""
        return {
            "textbooks": [
                card.get_data() for card in self._textbook_cards if card.is_valid()
            ],
            "documents": [
                card.get_data() for card in self._document_cards if card.is_valid()
            ],
            "online_courses": [
                card.get_data() for card in self._online_cards if card.is_valid()
            ],
        }

    def set_data(self, data: Dict):
        """设置课外资源数据"""
        self.clear()
        self._data = data
        self._load_initial_data()

    def clear(self):
        self.cards_container.clear()
        self._textbook_cards.clear()
        self._document_cards.clear()
        self._online_cards.clear()

    def is_empty(self) -> bool:
        """检查是否为空"""
        return not (self._textbook_cards or self._document_cards or self._online_cards)
