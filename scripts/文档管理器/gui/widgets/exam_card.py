"""
试卷资源卡片组件 - 支持折叠（含子资源、学院和贡献者）
"""

from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QComboBox,
    QFrame,
    QSizePolicy,
)
from PySide6.QtCore import Qt, Signal, QMimeData, QPoint
from PySide6.QtGui import QFont, QDrag
from typing import Dict, Optional, List
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils import extract_lanzou_key, build_api_url
from gui.widgets.generic_child_card import GenericChildCard


class ExamCard(QFrame):
    """试卷资源卡片 - 支持折叠和拖拽"""

    delete_requested = Signal(QWidget)
    data_changed = Signal()

    MIME_TYPE = "application/x-exam-card"

    def __init__(self, initial_data: Optional[Dict] = None):
        super().__init__()
        self._data = initial_data or {}
        self._is_collapsed = True
        self._children_cards: List[GenericChildCard] = []
        self.parent_group: Optional[QWidget] = None
        self.drag_start_pos: Optional[QPoint] = None
        self._init_ui()
        self._load_initial_data()
        self._update_summary()

    def set_group_widget(self, group: QWidget):
        """设置所属分组容器"""
        self.parent_group = group

    def mousePressEvent(self, event):
        """鼠标按下事件 - 记录拖拽起点"""
        if event.button() == Qt.LeftButton:
            self.drag_start_pos = event.position().toPoint()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        """鼠标移动事件 - 发起拖拽"""
        if self.drag_start_pos and event.buttons() & Qt.LeftButton:
            distance = (
                event.position().toPoint() - self.drag_start_pos
            ).manhattanLength()
            if distance > 10:
                drag = QDrag(self)
                mime_data = QMimeData()
                import json

                exam_data_json = json.dumps(self.get_data())
                mime_data.setData(self.MIME_TYPE, exam_data_json.encode())
                drag.setMimeData(mime_data)
                drag.exec(Qt.MoveAction)
                self.drag_start_pos = None
        super().mouseMoveEvent(event)

    def _init_ui(self):
        self.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)
        self.setStyleSheet("""
            ExamCard {
                background-color: #353535;
                border: 1px solid #2196F3;
                border-radius: 6px;
                margin: 2px;
            }
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        header_widget = QWidget()
        header_widget.setStyleSheet(
            "background-color: #2196F3; border-radius: 6px 6px 0 0;"
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

        self.header_btn = QPushButton("📝 试卷: 未设置")
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

        key_label = QLabel("蓝奏云密钥/链接")
        key_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        content_layout.addWidget(key_label)

        self.key_input = QLineEdit()
        self.key_input.setPlaceholderText("12位密钥或蓝奏云分享链接")
        self.key_input.setToolTip("蓝奏云12位密钥或分享链接")
        self.key_input.setMinimumHeight(28)
        content_layout.addWidget(self.key_input)

        semester_label = QLabel("学期")
        semester_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        content_layout.addWidget(semester_label)

        self.semester_input = QLineEdit()
        self.semester_input.setPlaceholderText("如：2024秋")
        self.semester_input.setToolTip("考试学期")
        self.semester_input.setMinimumHeight(28)
        content_layout.addWidget(self.semester_input)

        college_label = QLabel("学院")
        college_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        content_layout.addWidget(college_label)

        self.college_input = QLineEdit()
        self.college_input.setPlaceholderText("如：计算机学院")
        self.college_input.setToolTip("开课学院")
        self.college_input.setMinimumHeight(28)
        content_layout.addWidget(self.college_input)

        type_layout = QHBoxLayout()
        type_label_combo = QLabel("试卷类型")
        type_label_combo.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        type_layout.addWidget(type_label_combo)

        self.type_combo = QComboBox()
        self.type_combo.addItem("A卷", "A卷")
        self.type_combo.addItem("B卷", "B卷")
        self.type_combo.addItem("补考卷", "补考卷")
        self.type_combo.setToolTip("试卷类型")
        self.type_combo.setMinimumHeight(28)
        self.type_combo.setMinimumWidth(100)
        type_layout.addWidget(self.type_combo)

        type_layout.addStretch()
        content_layout.addLayout(type_layout)

        name_label = QLabel("试卷名称")
        name_label.setStyleSheet("color: #B0B0B0; font-size: 11px;")
        content_layout.addWidget(name_label)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("如：试卷+答案")
        self.name_input.setText("试卷+答案")
        self.name_input.setToolTip("试卷显示名称")
        self.name_input.setMinimumHeight(28)
        content_layout.addWidget(self.name_input)

        separator = QLabel("─────────────── 子资源 ───────────────")
        separator.setStyleSheet("color: #666; font-size: 10px;")
        separator.setAlignment(Qt.AlignmentFlag.AlignCenter)
        content_layout.addWidget(separator)

        self.children_widget = QWidget()
        self.children_layout = QVBoxLayout(self.children_widget)
        self.children_layout.setContentsMargins(0, 0, 0, 0)
        self.children_layout.setSpacing(4)
        content_layout.addWidget(self.children_widget)

        children_btn_layout = QHBoxLayout()
        children_btn_layout.setSpacing(8)

        add_child_btn = QPushButton("+ 添加子条目")
        add_child_btn.setStyleSheet("""
            QPushButton {
                background-color: #64B5F6;
                color: white;
                font-size: 10px;
                padding: 4px 8px;
                border-radius: 3px;
            }
            QPushButton:hover {
                background-color: #90CAF9;
            }
        """)
        add_child_btn.clicked.connect(lambda _checked=False: self._add_child_resource())
        children_btn_layout.addWidget(add_child_btn)

        children_btn_layout.addStretch()
        content_layout.addLayout(children_btn_layout)

        main_layout.addWidget(self.content_widget)
        self.content_widget.hide()

        self.key_input.textChanged.connect(self._on_data_changed)
        self.semester_input.textChanged.connect(self._on_data_changed)
        self.college_input.textChanged.connect(self._on_data_changed)
        self.type_combo.currentIndexChanged.connect(self._on_data_changed)
        self.name_input.textChanged.connect(self._on_data_changed)

    def _toggle_collapse(self):
        self._is_collapsed = not self._is_collapsed
        if self._is_collapsed:
            self.content_widget.hide()
            self.toggle_btn.setText("展开")
            self._update_summary()
        else:
            self.content_widget.show()
            self.toggle_btn.setText("折叠")

    def _update_summary(self):
        semester = self.semester_input.text().strip()
        college = self.college_input.text().strip()
        if semester:
            summary = f"📝 试卷: {semester}"
            if college:
                summary += f" - {college}"
        else:
            summary = "📝 试卷: 未设置"
        self.header_btn.setText(summary)

    def _collect_initial_children(self) -> List[Dict]:
        return list(self._data.get("children") or self._data.get("subresources") or [])

    def _add_child_resource(self, data: Optional[Dict] = None):
        card = GenericChildCard(data)
        card.delete_requested.connect(self._remove_child_resource)
        card.data_changed.connect(self.data_changed.emit)
        self._children_cards.append(card)
        self.children_layout.addWidget(card)
        self.data_changed.emit()

    def _remove_child_resource(self, card: QWidget):
        if card in self._children_cards:
            self._children_cards.remove(card)
        self.children_layout.removeWidget(card)
        card.deleteLater()
        self.data_changed.emit()

    def _load_initial_data(self):
        if not self._data:
            return

        if self._data.get("key"):
            self.key_input.setText(self._data["key"])
        if self._data.get("semester"):
            self.semester_input.setText(self._data["semester"])
        if self._data.get("college"):
            self.college_input.setText(self._data["college"])
        if self._data.get("paper_type"):
            paper_type = self._data["paper_type"]
            index = self.type_combo.findData(paper_type)
            if index >= 0:
                self.type_combo.setCurrentIndex(index)
        if self._data.get("name"):
            self.name_input.setText(self._data["name"])
        for child in self._collect_initial_children():
            self._add_child_resource(child)

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

        children = [card.get_data() for card in self._children_cards if card.is_valid()]

        return {
            "type": "exam",
            "name": self.name_input.text().strip() or "试卷+答案",
            "key": key or key_raw,
            "url": url,
            "semester": self.semester_input.text().strip(),
            "college": self.college_input.text().strip(),
            "paper_type": self.type_combo.currentData(),
            "children": children,
        }

    def set_data(self, data: Dict):
        for card in self._children_cards:
            self.children_layout.removeWidget(card)
            card.deleteLater()
        self._children_cards.clear()
        self._data = data
        self._load_initial_data()
        self._update_summary()

    def is_valid(self) -> bool:
        return bool(
            self.key_input.text().strip() and self.semester_input.text().strip()
        )
