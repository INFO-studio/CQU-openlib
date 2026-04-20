"""
可拖拽排序的卡片容器组件
支持同类型卡片之间的拖拽排序
带分类分隔符
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QFrame,
    QSizePolicy,
)
from PySide6.QtCore import Qt, Signal, QMimeData, QPoint
from PySide6.QtGui import QDrag, QFont
from typing import List, Dict, Optional
from pathlib import Path
import sys
import json

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


SEPARATOR_TITLES = {
    "textbook": "📚 教材资源",
    "document": "📄 文档",
    "online_course": "🎬 网课",
    "exam_group": "📝 试卷",
    "course_tab": "📦 课程资源包",
}


class SeparatorWidget(QFrame):
    """分类分隔符 - 不可拖拽"""

    def __init__(self, title: str):
        super().__init__()
        self._title = title
        self._init_ui()

    def _init_ui(self):
        self.setStyleSheet("""
            SeparatorWidget {
                background-color: #2a2a2a;
                border: none;
                border-radius: 4px;
                margin: 5px 0px;
            }
        """)
        self.setFixedHeight(28)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 0, 10, 0)

        left_line = QLabel("─" * 5)
        left_line.setStyleSheet("color: #555; font-size: 10px;")
        layout.addWidget(left_line)

        title_label = QLabel(self._title)
        title_label.setFont(QFont("Microsoft YaHei UI", 10, QFont.Weight.Bold))
        title_label.setStyleSheet("color: #888;")
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title_label)

        right_line = QLabel("─" * 5)
        right_line.setStyleSheet("color: #555; font-size: 10px;")
        layout.addWidget(right_line)


class DraggableCardsContainer(QWidget):
    """可拖拽排序的卡片容器 - 支持同类型排序和分类分隔符"""

    MIME_TYPE = "application/x-draggable-card"
    order_changed = Signal()

    def __init__(self):
        super().__init__()
        self._cards: List[QWidget] = []
        self._separators: Dict[str, SeparatorWidget] = {}
        self._type_added: set = set()
        self._init_ui()
        self.setAcceptDrops(True)

    def _init_ui(self):
        self.setStyleSheet("""
            DraggableCardsContainer {
                background-color: transparent;
            }
        """)

        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(0, 0, 0, 0)
        self._layout.setSpacing(5)

        stretch_widget = QWidget()
        self._layout.addWidget(stretch_widget)

    def add_card(self, card: QWidget, card_type: str):
        """添加卡片 - 自动插入分隔符"""
        card._drag_card_type = card_type
        card._drag_container = self

        if card_type not in self._type_added:
            title = SEPARATOR_TITLES.get(card_type, card_type)
            separator = SeparatorWidget(title)
            self._separators[card_type] = separator
            self._type_added.add(card_type)

            stretch_index = self._layout.count() - 1
            self._layout.insertWidget(stretch_index, separator)

        stretch_index = self._layout.count() - 1
        self._layout.insertWidget(stretch_index, card)
        self._cards.append(card)

    def remove_card(self, card: QWidget):
        """移除卡片"""
        if card in self._cards:
            self._cards.remove(card)
        self._layout.removeWidget(card)
        card.deleteLater()

    def get_cards(self) -> List[QWidget]:
        """获取所有卡片"""
        return self._cards

    def clear(self):
        """清空所有卡片和分隔符"""
        for card in self._cards:
            self._layout.removeWidget(card)
            card.deleteLater()
        self._cards.clear()

        for sep in self._separators.values():
            self._layout.removeWidget(sep)
            sep.deleteLater()
        self._separators.clear()
        self._type_added.clear()

    def dragEnterEvent(self, event):
        mime_data = event.mimeData()
        if mime_data.hasFormat(self.MIME_TYPE):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dragMoveEvent(self, event):
        mime_data = event.mimeData()
        if mime_data.hasFormat(self.MIME_TYPE):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event):
        mime_data = event.mimeData()
        if not mime_data.hasFormat(self.MIME_TYPE):
            event.ignore()
            return

        try:
            data_json = mime_data.data(self.MIME_TYPE).data().decode()
            drag_data = json.loads(data_json)
        except Exception:
            event.ignore()
            return

        source_card = event.source()
        if not source_card or source_card not in self._cards:
            event.ignore()
            return

        source_type = drag_data.get("card_type", "")
        drop_pos = event.position().toPoint()

        target_index = self._find_target_index(drop_pos)

        if self._cards:
            check_index = min(target_index, len(self._cards) - 1)
            target_card = self._cards[check_index]
            target_type = getattr(target_card, "_drag_card_type", "")
            if source_type != target_type:
                event.ignore()
                return

        current_index = self._cards.index(source_card)

        if current_index < target_index:
            target_index -= 1

        if current_index == target_index:
            event.acceptProposedAction()
            return

        self._reorder_card(source_card, current_index, target_index)
        event.acceptProposedAction()
        self.order_changed.emit()

    def _find_target_index(self, pos: QPoint) -> int:
        """根据鼠标位置找到目标索引"""
        if not self._cards:
            return 0

        y = pos.y()

        for i, card in enumerate(self._cards):
            card_pos = card.pos()
            card_height = card.height()
            card_center = card_pos.y() + card_height / 2

            if y < card_center:
                return i

        return len(self._cards)

    def _reorder_card(self, card: QWidget, old_index: int, new_index: int):
        """重新排列卡片顺序"""
        self._cards.remove(card)
        self._cards.insert(new_index, card)

        layout_index = self._layout.indexOf(card)
        if layout_index >= 0:
            self._layout.removeWidget(card)

        new_layout_index = self._calculate_layout_index(new_index, card._drag_card_type)
        self._layout.insertWidget(new_layout_index, card)

    def _calculate_layout_index(self, card_index: int, card_type: str) -> int:
        """计算卡片在布局中的实际索引（考虑分隔符）"""
        layout_index = 0
        current_card_index = 0

        for i in range(self._layout.count()):
            item = self._layout.itemAt(i)
            if item and item.widget():
                widget = item.widget()
                if isinstance(widget, SeparatorWidget):
                    layout_index = i + 1
                elif widget in self._cards:
                    if current_card_index == card_index:
                        return i
                    current_card_index += 1
                    layout_index = i + 1

        return self._layout.count() - 1


def start_drag(card: QWidget, card_type: str, data: Dict):
    """发起拖拽的辅助函数"""
    drag = QDrag(card)
    mime_data = QMimeData()

    drag_data = {"card_type": card_type, "data": data}
    data_json = json.dumps(drag_data)
    mime_data.setData(DraggableCardsContainer.MIME_TYPE, data_json.encode())

    drag.setMimeData(mime_data)
    drag.exec(Qt.DropAction.MoveAction)
