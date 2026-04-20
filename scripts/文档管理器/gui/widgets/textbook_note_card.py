"""
教材备注子卡片组件
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
    QTextEdit,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from typing import Dict, Optional
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


class TextbookNoteCard(QFrame):
    """教材备注子卡片"""

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
            TextbookNoteCard {
                background-color: #3a3a3a;
                border: 1px solid #FF9800;
                border-radius: 4px;
                margin: 2px;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 6, 8, 6)
        layout.setSpacing(6)

        header_layout = QHBoxLayout()

        type_label = QLabel("📝 备注")
        type_label.setStyleSheet("color: #FF9800; font-size: 10px;")
        header_layout.addWidget(type_label)

        header_layout.addStretch()

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
        header_layout.addWidget(delete_btn)

        layout.addLayout(header_layout)

        self.text_edit = QTextEdit()
        self.text_edit.setPlaceholderText("输入备注内容...")
        self.text_edit.setMaximumHeight(60)
        self.text_edit.setStyleSheet("""
            QTextEdit {
                background-color: #2a2a2a;
                color: #FFFFFF;
                border: 1px solid #555;
                border-radius: 3px;
                padding: 4px;
                font-size: 10px;
            }
        """)
        layout.addWidget(self.text_edit)

        self.text_edit.textChanged.connect(self._on_data_changed)

    def _load_initial_data(self):
        if not self._data:
            return

        if self._data.get("text"):
            self.text_edit.setText(self._data["text"])

    def _on_delete(self):
        self.delete_requested.emit(self)

    def _on_data_changed(self):
        self.data_changed.emit()

    def get_data(self) -> Dict:
        return {
            "type": "备注",
            "text": self.text_edit.toPlainText().strip(),
        }

    def set_data(self, data: Dict):
        self._data = data
        self._load_initial_data()

    def is_valid(self) -> bool:
        return bool(self.text_edit.toPlainText().strip())
