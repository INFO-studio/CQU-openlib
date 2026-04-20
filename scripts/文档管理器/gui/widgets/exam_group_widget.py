"""
试卷分组容器组件 - 支持拖拽排序和跨分组移动
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QSizePolicy,
)
from PySide6.QtCore import Qt, Signal, QMimeData, QPoint
from PySide6.QtGui import QFont, QDrag
from typing import Dict, List, Optional
from pathlib import Path
import sys
import json

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from gui.widgets.exam_card import ExamCard
from gui.widgets.draggable_cards_container import start_drag

EXAM_GROUP_COLORS = {
    "期末试卷": "#4CAF50",
    "期中试卷": "#2196F3",
    "小测": "#9C27B0",
}


class ExamGroupWidget(QFrame):
    """试卷分组容器 - 支持拖拽排序和跨分组移动"""

    group_deleted = Signal(str)
    exam_added = Signal()
    exam_removed = Signal()
    data_changed = Signal()

    CARD_TYPE = "exam_group"

    def __init__(self, group_name: str, initial_exams: Optional[List[Dict]] = None):
        super().__init__()
        self._group_name = group_name
        self._exam_cards: List[ExamCard] = []
        self._is_collapsed = False
        self._drag_start_pos: Optional[QPoint] = None
        self._init_ui()
        self._load_initial_data(initial_exams)
        self.setAcceptDrops(True)

    def _init_ui(self):
        color = EXAM_GROUP_COLORS.get(self._group_name, "#4CAF50")

        self.setStyleSheet(f"""
            ExamGroupWidget {{
                background-color: #303030;
                border: 2px solid {color};
                border-radius: 8px;
                margin: 5px;
            }}
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        header_widget = QWidget()
        header_widget.setStyleSheet(
            f"background-color: {color}; border-radius: 6px 6px 0 0;"
        )
        header_widget.setFixedHeight(36)
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 5, 10, 5)

        drag_handle = QLabel("⋮⋮")
        drag_handle.setFixedWidth(20)
        drag_handle.setStyleSheet("""
            QLabel {
                color: #FFFFFF;
                font-size: 14px;
                background-color: transparent;
                padding-left: 5px;
            }
        """)
        drag_handle.setCursor(Qt.CursorShape.SizeAllCursor)
        header_layout.addWidget(drag_handle)

        self.title_label = QLabel(f"📋 {self._group_name}")
        self.title_label.setFont(QFont("Microsoft YaHei UI", 10, QFont.Weight.Bold))
        self.title_label.setStyleSheet("color: #FFFFFF;")
        header_layout.addWidget(self.title_label)

        self.count_label = QLabel("(0)")
        self.count_label.setStyleSheet("color: #FFFFFF; font-size: 10px;")
        header_layout.addWidget(self.count_label)

        header_layout.addStretch()

        self.toggle_btn = QPushButton("折叠")
        self.toggle_btn.setFixedWidth(50)
        self.toggle_btn.setFixedHeight(26)
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
        self.toggle_btn.clicked.connect(self._toggle_collapse)
        header_layout.addWidget(self.toggle_btn)

        self.add_btn = QPushButton("添加")
        self.add_btn.setFixedWidth(50)
        self.add_btn.setFixedHeight(26)
        self.add_btn.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        self.add_btn.setStyleSheet("""
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
        self.add_btn.clicked.connect(self._add_exam)
        header_layout.addWidget(self.add_btn)

        delete_btn = QPushButton("删除")
        delete_btn.setFixedWidth(50)
        delete_btn.setFixedHeight(26)
        delete_btn.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        delete_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF5722;
                color: white;
                font-size: 10px;
                padding: 4px 8px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #E64A19;
            }
        """)
        delete_btn.clicked.connect(self._on_delete_group)
        header_layout.addWidget(delete_btn)

        main_layout.addWidget(header_widget)

        self.content_widget = QWidget()
        self.content_widget.setStyleSheet("background-color: #303030;")
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setContentsMargins(10, 5, 10, 5)
        self.content_layout.setSpacing(5)

        self._update_count()

        main_layout.addWidget(self.content_widget)

    def _load_initial_data(self, exams: Optional[List[Dict]] = None):
        if not exams:
            return
        for exam_data in exams:
            exam_data["exam_group"] = self._group_name
            self._add_exam_card(exam_data)

    def _toggle_collapse(self):
        self._is_collapsed = not self._is_collapsed
        if self._is_collapsed:
            self.content_widget.hide()
            self.toggle_btn.setText("展开")
        else:
            self.content_widget.show()
            self.toggle_btn.setText("折叠")

    def mousePressEvent(self, event):
        """鼠标按下事件 - 记录拖拽起点（用于分组整体排序）"""
        if event.button() == Qt.LeftButton:
            self._drag_start_pos = event.position().toPoint()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        """鼠标移动事件 - 发起拖拽（用于分组整体排序）"""
        if self._drag_start_pos and event.buttons() & Qt.LeftButton:
            distance = (
                event.position().toPoint() - self._drag_start_pos
            ).manhattanLength()
            if distance > 10:
                start_drag(self, self.CARD_TYPE, {"group_name": self._group_name})
                self._drag_start_pos = None
        super().mouseMoveEvent(event)

    def _on_delete_group(self):
        self.group_deleted.emit(self._group_name)

    def _add_exam(self):
        exam_data = {"exam_group": self._group_name}
        self._add_exam_card(exam_data)
        self.exam_added.emit()
        self.data_changed.emit()

    def _add_exam_card(self, data: Dict):
        data["exam_group"] = self._group_name
        card = ExamCard(data)
        card.delete_requested.connect(self._remove_exam)
        card.data_changed.connect(self.data_changed.emit)
        card.set_group_widget(self)
        self._exam_cards.append(card)
        self.content_layout.addWidget(card)
        self._update_count()

    def _remove_exam(self, card: QWidget):
        if card in self._exam_cards:
            self._exam_cards.remove(card)
        card.deleteLater()
        self._update_count()
        self.exam_removed.emit()
        self.data_changed.emit()

    def _update_count(self):
        count = len(self._exam_cards)
        self.count_label.setText(f"({count})")

    def dragEnterEvent(self, event):
        if event.mimeData().hasFormat(ExamCard.MIME_TYPE):
            event.acceptProposedAction()

    def dragMoveEvent(self, event):
        if event.mimeData().hasFormat(ExamCard.MIME_TYPE):
            event.acceptProposedAction()

    def dropEvent(self, event):
        mime_data = event.mimeData()
        if mime_data.hasFormat(ExamCard.MIME_TYPE):
            exam_data_json = mime_data.data(ExamCard.MIME_TYPE).data().decode()
            exam_data = json.loads(exam_data_json)
            source_card = event.source()

            if source_card and hasattr(source_card, "parent_group"):
                old_group = source_card.parent_group
                if old_group and old_group != self:
                    old_group._remove_exam(source_card)
                    exam_data["exam_group"] = self._group_name
                    self._add_exam_card(exam_data)
                    self.data_changed.emit()
                else:
                    drop_pos = event.position().toPoint()
                    new_index = self._calculate_index_from_position(drop_pos)
                    self._reorder_exam(source_card, new_index)
            else:
                exam_data["exam_group"] = self._group_name
                self._add_exam_card(exam_data)
                self.data_changed.emit()

            event.acceptProposedAction()

    def _calculate_index_from_position(self, pos: QPoint) -> int:
        """根据鼠标位置计算目标索引"""
        if not self._exam_cards:
            return 0

        y = pos.y()

        for i, card in enumerate(self._exam_cards):
            card_pos = card.pos()
            card_height = card.height()
            card_center = card_pos.y() + card_height / 2

            if y < card_center:
                return i

        return len(self._exam_cards)

    def _reorder_exam(self, card: ExamCard, new_index: int):
        current_index = self._exam_cards.index(card)
        if current_index != new_index:
            self._exam_cards.remove(card)
            self._exam_cards.insert(new_index, card)

            self.content_layout.removeWidget(card)
            self.content_layout.insertWidget(new_index, card)
            self.data_changed.emit()

    def get_data(self) -> List[Dict]:
        return [card.get_data() for card in self._exam_cards if card.is_valid()]

    def get_group_name(self) -> str:
        return self._group_name

    def is_empty(self) -> bool:
        return len(self._exam_cards) == 0

    def clear(self):
        for card in self._exam_cards:
            card.deleteLater()
        self._exam_cards.clear()
        self._update_count()
