"""
教材答案卡片组件 - 支持折叠
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QSizePolicy,
)
from PySide6.QtCore import Qt, Signal, QMimeData, QPoint
from PySide6.QtGui import QFont, QDrag
from typing import Dict, Optional
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils import extract_lanzou_key, build_api_url
from gui.widgets.draggable_cards_container import start_drag


class TextbookAnswerCard(QFrame):
    """教材答案卡片 - 支持折叠和拖拽排序"""

    delete_requested = Signal(QWidget)
    data_changed = Signal()

    CARD_TYPE = "textbook_answer"

    def __init__(self, initial_data: Optional[Dict] = None):
        super().__init__()
        self._data = initial_data or {}
        self._is_collapsed = True
        self._drag_start_pos: Optional[QPoint] = None
        self._init_ui()
        self._load_initial_data()
        self._update_summary()

    def _init_ui(self):
        self.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)
        self.setStyleSheet("""
            TextbookAnswerCard {
                background-color: #353535;
                border: 1px solid #9C27B0;
                border-radius: 6px;
                margin: 2px;
            }
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        header_widget = QWidget()
        header_widget.setStyleSheet(
            "background-color: #9C27B0; border-radius: 6px 6px 0 0;"
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

        self.header_btn = QPushButton("💡 教材答案: 未命名")
        self.header_btn.setFont(QFont("Microsoft YaHei UI", 10, QFont.Weight.Bold))
        self.header_btn.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                color: #FFFFFF;
                border: none;
                text-align: left;
                padding: 0;
            }
            QPushButton:hover {
                background-color: rgba(255,255,255,0.1);
            }
        """)
        self.header_btn.clicked.connect(self._toggle_collapse)
        header_layout.addWidget(self.header_btn)

        header_layout.addStretch()

        self.toggle_btn = QPushButton("展开")
        self.toggle_btn.setFixedWidth(65)
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

        delete_btn = QPushButton("删除")
        delete_btn.setFixedHeight(26)
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
        self.content_widget.setStyleSheet("background-color: #353535;")
        content_layout = QVBoxLayout(self.content_widget)
        content_layout.setContentsMargins(10, 8, 10, 8)
        content_layout.setSpacing(6)

        name_label = QLabel("答案名称")
        name_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        content_layout.addWidget(name_label)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("如：高等数学习题解答")
        self.name_input.setToolTip("教材答案名称")
        self.name_input.setMinimumHeight(28)
        content_layout.addWidget(self.name_input)

        key_label = QLabel("蓝奏云密钥/链接")
        key_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        content_layout.addWidget(key_label)

        self.key_input = QLineEdit()
        self.key_input.setPlaceholderText("12位密钥或蓝奏云分享链接")
        self.key_input.setToolTip("蓝奏云12位密钥或分享链接")
        self.key_input.setMinimumHeight(28)
        content_layout.addWidget(self.key_input)

        author_label = QLabel("作者（可选）")
        author_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        content_layout.addWidget(author_label)

        self.author_input = QLineEdit()
        self.author_input.setPlaceholderText("如：同济大学数学系")
        self.author_input.setToolTip("答案作者（可选）")
        self.author_input.setMinimumHeight(28)
        content_layout.addWidget(self.author_input)

        main_layout.addWidget(self.content_widget)
        self.content_widget.hide()

        self.name_input.textChanged.connect(self._on_data_changed)
        self.key_input.textChanged.connect(self._on_data_changed)
        self.author_input.textChanged.connect(self._on_data_changed)

    def _toggle_collapse(self):
        self._is_collapsed = not self._is_collapsed
        if self._is_collapsed:
            self.content_widget.hide()
            self.toggle_btn.setText("展开")
            self._update_summary()
        else:
            self.content_widget.show()
            self.toggle_btn.setText("折叠")

    def mousePressEvent(self, event):
        """鼠标按下事件 - 记录拖拽起点"""
        if event.button() == Qt.LeftButton:
            self._drag_start_pos = event.position().toPoint()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        """鼠标移动事件 - 发起拖拽"""
        if self._drag_start_pos and event.buttons() & Qt.LeftButton:
            distance = (
                event.position().toPoint() - self._drag_start_pos
            ).manhattanLength()
            if distance > 10:
                start_drag(self, self.CARD_TYPE, self.get_data())
                self._drag_start_pos = None
        super().mouseMoveEvent(event)

    def _update_summary(self):
        name = self.name_input.text().strip()
        if name:
            summary = f"💡 教材答案: {name}"
        else:
            summary = f"💡 教材答案: 未命名"
        self.header_btn.setText(summary)

    def _load_initial_data(self):
        if not self._data:
            return

        if self._data.get("name"):
            self.name_input.setText(self._data["name"])
        if self._data.get("key"):
            self.key_input.setText(self._data["key"])
        if self._data.get("author"):
            self.author_input.setText(self._data["author"])

    def _on_delete(self):
        self.delete_requested.emit(self)

    def _on_data_changed(self):
        self._update_summary()
        self.data_changed.emit()

    def get_data(self) -> Dict:
        key_raw = self.key_input.text().strip()
        key = extract_lanzou_key(key_raw)

        if key:
            url = build_api_url(key)
        else:
            url = key_raw if key_raw else ""

        return {
            "type": "textbook_answer",
            "name": self.name_input.text().strip(),
            "key": key or key_raw,
            "url": url,
            "author": self.author_input.text().strip(),
        }

    def set_data(self, data: Dict):
        self._data = data
        self._load_initial_data()
        self._update_summary()

    def is_valid(self) -> bool:
        return bool(self.name_input.text().strip())
