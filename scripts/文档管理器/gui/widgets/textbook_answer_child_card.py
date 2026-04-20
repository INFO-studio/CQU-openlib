"""
教材习题解答子卡片组件
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
    QCheckBox,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from typing import Dict, Optional
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils import extract_lanzou_key, build_api_url


class TextbookAnswerChildCard(QFrame):
    """教材习题解答子卡片"""

    delete_requested = Signal(QWidget)
    data_changed = Signal()

    def __init__(self, initial_data: Optional[Dict] = None):
        super().__init__()
        self._data = initial_data or {}
        self._init_ui()
        self._load_initial_data()

    def _init_ui(self):
        self.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)
        self.setStyleSheet("""
            TextbookAnswerChildCard {
                background-color: #3a3a3a;
                border: 1px solid #9C27B0;
                border-radius: 4px;
                margin: 2px;
            }
        """)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 6, 8, 6)
        layout.setSpacing(8)

        type_label = QLabel("💡")
        type_label.setStyleSheet("color: #9C27B0; font-size: 12px;")
        layout.addWidget(type_label)

        name_label = QLabel("名称:")
        name_label.setStyleSheet("color: #B0B0B0; font-size: 10px;")
        layout.addWidget(name_label)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("习题解答名称")
        self.name_input.setMinimumHeight(24)
        self.name_input.setStyleSheet("""
            QLineEdit {
                background-color: #2a2a2a;
                color: #FFFFFF;
                border: 1px solid #555;
                border-radius: 3px;
                padding: 2px 6px;
                font-size: 10px;
            }
        """)
        layout.addWidget(self.name_input, 2)

        key_label = QLabel("链接:")
        key_label.setStyleSheet("color: #B0B0B0; font-size: 10px;")
        layout.addWidget(key_label)

        self.key_input = QLineEdit()
        self.key_input.setPlaceholderText("蓝奏云密钥或链接")
        self.key_input.setMinimumHeight(24)
        self.key_input.setStyleSheet("""
            QLineEdit {
                background-color: #2a2a2a;
                color: #FFFFFF;
                border: 1px solid #555;
                border-radius: 3px;
                padding: 2px 6px;
                font-size: 10px;
            }
        """)
        layout.addWidget(self.key_input, 3)

        contributor_label = QLabel("贡献者:")
        contributor_label.setStyleSheet("color: #B0B0B0; font-size: 10px;")
        layout.addWidget(contributor_label)

        self.contributor_input = QLineEdit()
        self.contributor_input.setPlaceholderText("贡献者名称")
        self.contributor_input.setMinimumHeight(24)
        self.contributor_input.setStyleSheet("""
            QLineEdit {
                background-color: #2a2a2a;
                color: #FFFFFF;
                border: 1px solid #555;
                border-radius: 3px;
                padding: 2px 6px;
                font-size: 10px;
            }
        """)
        layout.addWidget(self.contributor_input, 2)

        self.contributor_link_checkbox = QCheckBox("链接")
        self.contributor_link_checkbox.setToolTip(
            "勾选后自动生成 ../contributor/{名字}.md 链接"
        )
        layout.addWidget(self.contributor_link_checkbox)

        delete_btn = QPushButton("×")
        delete_btn.setFixedSize(22, 22)
        delete_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF5722;
                color: #FFFFFF;
                border-radius: 3px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #E64A19;
            }
        """)
        delete_btn.clicked.connect(self._on_delete)
        layout.addWidget(delete_btn)

        self.name_input.textChanged.connect(self._on_data_changed)
        self.key_input.textChanged.connect(self._on_data_changed)
        self.contributor_input.textChanged.connect(self._on_data_changed)
        self.contributor_link_checkbox.stateChanged.connect(self._on_data_changed)

    def _load_initial_data(self):
        if not self._data:
            return

        if self._data.get("name"):
            self.name_input.setText(self._data["name"])
        if self._data.get("url"):
            self.key_input.setText(self._data.get("key", "") or self._data["url"])
        if self._data.get("contributor"):
            self.contributor_input.setText(self._data["contributor"])

        has_link = self._data.get("has_contributor_link", False)
        if has_link:
            self.contributor_link_checkbox.setChecked(True)

        if self._data.get("contributor_url"):
            contributor_url = self._data["contributor_url"]
            if contributor_url.startswith("../contributor/"):
                self.contributor_link_checkbox.setChecked(True)

    def _on_delete(self):
        self.delete_requested.emit(self)

    def _on_data_changed(self):
        self.data_changed.emit()

    def get_data(self) -> Dict:
        key_raw = self.key_input.text().strip()
        key = extract_lanzou_key(key_raw)

        if key:
            url = build_api_url(key)
        else:
            url = key_raw if key_raw else ""

        return {
            "type": "习题解答",
            "name": self.name_input.text().strip(),
            "key": key or key_raw,
            "url": url,
            "contributor": self.contributor_input.text().strip(),
            "has_contributor_link": self.contributor_link_checkbox.isChecked(),
        }

    def set_data(self, data: Dict):
        self._data = data
        self._load_initial_data()

    def is_valid(self) -> bool:
        return bool(self.name_input.text().strip())
