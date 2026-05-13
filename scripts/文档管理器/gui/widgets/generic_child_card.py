"""
通用子条目卡片组件

支持链接型和纯文本型子条目，供教材、试卷等资源复用。
"""

from pathlib import Path
import sys
from typing import Dict, Optional

from PySide6.QtCore import Signal
from PySide6.QtWidgets import (
    QCheckBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from utils import build_api_url, extract_lanzou_key


class GenericChildCard(QFrame):
    """通用子条目卡片（链接 / 文本）。"""

    delete_requested = Signal(QWidget)
    data_changed = Signal()

    LINK_COLOR = "#64B5F6"
    TEXT_COLOR = "#FF9800"

    def __init__(self, initial_data: Optional[Dict] = None):
        super().__init__()
        self._data = initial_data or {}
        self._child_type = "link"
        self._init_ui()
        self._load_initial_data()

    def _init_ui(self):
        self.setFrameStyle(QFrame.Shape.StyledPanel | QFrame.Shadow.Raised)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 6, 8, 6)
        layout.setSpacing(8)

        self.type_btn = QPushButton()
        self.type_btn.setFixedWidth(72)
        self.type_btn.setMinimumHeight(28)
        self.type_btn.clicked.connect(self._toggle_child_type)
        layout.addWidget(self.type_btn)

        body_layout = QVBoxLayout()
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(6)

        name_row = QHBoxLayout()
        name_label = QLabel("名称:")
        name_label.setStyleSheet("color: #B0B0B0; font-size: 10px;")
        name_row.addWidget(name_label)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("如：讲解视频、习题解答、备注")
        self.name_input.setMinimumHeight(24)
        self.name_input.setStyleSheet(self._input_style())
        name_row.addWidget(self.name_input, 1)
        body_layout.addLayout(name_row)

        self.link_fields_widget = QWidget()
        link_layout = QVBoxLayout(self.link_fields_widget)
        link_layout.setContentsMargins(0, 0, 0, 0)
        link_layout.setSpacing(6)

        link_row = QHBoxLayout()
        link_label = QLabel("链接:")
        link_label.setStyleSheet("color: #B0B0B0; font-size: 10px;")
        link_row.addWidget(link_label)

        self.key_input = QLineEdit()
        self.key_input.setPlaceholderText("蓝奏云密钥、分享链接或外链")
        self.key_input.setMinimumHeight(24)
        self.key_input.setStyleSheet(self._input_style())
        link_row.addWidget(self.key_input, 1)
        link_layout.addLayout(link_row)

        contributor_row = QHBoxLayout()
        contributor_label = QLabel("贡献者:")
        contributor_label.setStyleSheet("color: #B0B0B0; font-size: 10px;")
        contributor_row.addWidget(contributor_label)

        self.contributor_input = QLineEdit()
        self.contributor_input.setPlaceholderText("贡献者名称")
        self.contributor_input.setMinimumHeight(24)
        self.contributor_input.setStyleSheet(self._input_style())
        contributor_row.addWidget(self.contributor_input, 2)

        self.contributor_link_checkbox = QCheckBox("链接")
        self.contributor_link_checkbox.setToolTip(
            "勾选后可使用自定义贡献者链接；留空则生成 ../contributor/{名字}.md"
        )
        contributor_row.addWidget(self.contributor_link_checkbox)

        self.contributor_url_input = QLineEdit()
        self.contributor_url_input.setPlaceholderText("自定义贡献者链接（可选）")
        self.contributor_url_input.setMinimumHeight(24)
        self.contributor_url_input.setStyleSheet(self._input_style())
        contributor_row.addWidget(self.contributor_url_input, 3)

        link_layout.addLayout(contributor_row)
        body_layout.addWidget(self.link_fields_widget)

        self.text_fields_widget = QWidget()
        text_layout = QVBoxLayout(self.text_fields_widget)
        text_layout.setContentsMargins(0, 0, 0, 0)

        self.text_edit = QTextEdit()
        self.text_edit.setPlaceholderText("输入文本内容...")
        self.text_edit.setMaximumHeight(70)
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
        text_layout.addWidget(self.text_edit)
        body_layout.addWidget(self.text_fields_widget)

        layout.addLayout(body_layout, 1)

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
        self.contributor_url_input.textChanged.connect(self._on_data_changed)
        self.text_edit.textChanged.connect(self._on_data_changed)

        self._set_child_type("link", emit_change=False)

    def _input_style(self) -> str:
        return """
            QLineEdit {
                background-color: #2a2a2a;
                color: #FFFFFF;
                border: 1px solid #555;
                border-radius: 3px;
                padding: 2px 6px;
                font-size: 10px;
            }
        """

    def _apply_card_style(self):
        color = self.LINK_COLOR if self._child_type == "link" else self.TEXT_COLOR
        self.setStyleSheet(f"""
            GenericChildCard {{
                background-color: #3a3a3a;
                border: 1px solid {color};
                border-radius: 4px;
                margin: 2px;
            }}
        """)

        label = "🔗 链接" if self._child_type == "link" else "📝 文本"
        self.type_btn.setText(label)
        self.type_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {color};
                border: 1px solid {color};
                border-radius: 3px;
                padding: 4px 6px;
                font-size: 10px;
            }}
            QPushButton:hover {{
                background-color: rgba(255, 255, 255, 0.08);
            }}
        """)

    def _toggle_child_type(self):
        next_type = "text" if self._child_type == "link" else "link"
        self._set_child_type(next_type)

    def _set_child_type(self, child_type: str, emit_change: bool = True):
        self._child_type = "text" if child_type == "text" else "link"
        self.link_fields_widget.setVisible(self._child_type == "link")
        self.text_fields_widget.setVisible(self._child_type == "text")
        self._apply_card_style()
        if emit_change:
            self.data_changed.emit()

    def _load_initial_data(self):
        if not self._data:
            return

        raw_type = self._data.get("type", "")
        has_text = bool(self._data.get("text"))
        has_link = bool(
            self._data.get("key")
            or self._data.get("url")
            or self._data.get("course_url")
        )
        child_type = (
            "text"
            if raw_type in ("text", "备注") or (has_text and not has_link)
            else "link"
        )
        self._set_child_type(child_type, emit_change=False)

        name = self._data.get("name", "")
        if not name:
            if child_type == "text":
                name = "备注"
            elif raw_type in ("习题解答", "讲解视频", "子资源"):
                name = raw_type

        if name:
            self.name_input.setText(name)

        key_or_url = (
            self._data.get("key")
            or self._data.get("url")
            or self._data.get("course_url")
            or ""
        )
        if key_or_url:
            self.key_input.setText(key_or_url)

        contributor = self._data.get("contributor", "")
        if contributor:
            self.contributor_input.setText(contributor)

        contributor_url = self._data.get("contributor_url", "")
        has_contributor_link = bool(
            self._data.get("has_contributor_link")
            or contributor_url
        )
        self.contributor_link_checkbox.setChecked(has_contributor_link)

        if contributor_url and contributor_url != self._default_contributor_url(
            contributor
        ):
            self.contributor_url_input.setText(contributor_url)

        if self._data.get("text"):
            self.text_edit.setText(self._data["text"])

    def _default_contributor_url(self, contributor: str) -> str:
        if not contributor:
            return ""
        return f"../contributor/{contributor}.md"

    def _on_delete(self):
        self.delete_requested.emit(self)

    def _on_data_changed(self):
        self.data_changed.emit()

    def get_data(self) -> Dict:
        name = self.name_input.text().strip()

        if self._child_type == "text":
            return {
                "type": "text",
                "name": name or "备注",
                "key": "",
                "url": "",
                "contributor": "",
                "has_contributor_link": False,
                "contributor_url": "",
                "text": self.text_edit.toPlainText().strip(),
            }

        key_raw = self.key_input.text().strip()
        key = extract_lanzou_key(key_raw)
        url = build_api_url(key) if key else key_raw

        return {
            "type": "link",
            "name": name,
            "key": key or key_raw,
            "url": url,
            "contributor": self.contributor_input.text().strip(),
            "has_contributor_link": self.contributor_link_checkbox.isChecked(),
            "contributor_url": self.contributor_url_input.text().strip(),
            "text": "",
        }

    def set_data(self, data: Dict):
        self._data = data
        self._load_initial_data()

    def is_valid(self) -> bool:
        if self._child_type == "text":
            return bool(self.text_edit.toPlainText().strip())
        return bool(self.name_input.text().strip() and self.key_input.text().strip())
