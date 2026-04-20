"""
主题样式管理
"""

from PySide6.QtWidgets import QApplication


class ThemeManager:
    """主题管理器"""

    DARK_THEME = """
        QMainWindow {
            background-color: #1E1E1E;
        }
        QWidget {
            background-color: #2D2D2D;
            color: #E0E0E0;
            font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
        }
        QToolBar {
            background-color: #252525;
            border: none;
            spacing: 10px;
            padding: 5px;
        }
        QToolBar QToolButton {
            background-color: transparent;
            color: #B0B0B0;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
        }
        QToolBar QToolButton:hover {
            background-color: #3A3A3A;
            color: #FFFFFF;
        }
        QLineEdit {
            background-color: #3A3A3A;
            border: 1px solid #4A4A4A;
            border-radius: 4px;
            padding: 6px 10px;
            color: #E0E0E0;
        }
        QLineEdit:focus {
            border: 1px solid #4CAF50;
        }
        QTableView {
            background-color: #2D2D2D;
            alternate-background-color: #353535;
            gridline-color: #3A3A3A;
            border: 1px solid #3A3A3A;
            border-radius: 4px;
        }
        QTableView::item {
            padding: 8px;
            color: #E0E0E0;
        }
        QTableView::item:selected {
            background-color: #4CAF50;
            color: #FFFFFF;
        }
        QTableView::item:hover {
            background-color: #3A3A3A;
        }
        QHeaderView::section {
            background-color: #252525;
            color: #B0B0B0;
            padding: 8px;
            border: none;
            border-bottom: 1px solid #3A3A3A;
            font-weight: bold;
        }
        QPushButton {
            background-color: #4CAF50;
            color: #FFFFFF;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-weight: bold;
        }
        QPushButton:hover {
            background-color: #66BB6A;
        }
        QPushButton:pressed {
            background-color: #388E3C;
        }
        QPushButton:disabled {
            background-color: #606060;
            color: #909090;
        }
        QLabel {
            color: #E0E0E0;
            background-color: transparent;
        }
        QStatusBar {
            background-color: #252525;
            color: #B0B0B0;
            border-top: 1px solid #3A3A3A;
        }
        QScrollArea {
            background-color: #2D2D2D;
            border: none;
        }
        QScrollBar:vertical {
            background-color: #2D2D2D;
            width: 12px;
            border-radius: 6px;
        }
        QScrollBar::handle:vertical {
            background-color: #4A4A4A;
            border-radius: 6px;
            min-height: 30px;
        }
        QScrollBar::handle:vertical:hover {
            background-color: #5A5A5A;
        }
        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
            height: 0px;
        }
        QScrollBar:horizontal {
            background-color: #2D2D2D;
            height: 12px;
            border-radius: 6px;
        }
        QScrollBar::handle:horizontal {
            background-color: #4A4A4A;
            border-radius: 6px;
            min-width: 30px;
        }
        QScrollBar::handle:horizontal:hover {
            background-color: #5A5A5A;
        }
        QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {
            width: 0px;
        }
        QComboBox {
            background-color: #3A3A3A;
            border: 1px solid #4A4A4A;
            border-radius: 4px;
            padding: 6px 10px;
            color: #E0E0E0;
        }
        QComboBox:hover {
            border: 1px solid #4CAF50;
        }
        QComboBox::drop-down {
            border: none;
            width: 20px;
        }
        QComboBox QAbstractItemView {
            background-color: #2D2D2D;
            border: 1px solid #4A4A4A;
            selection-background-color: #4CAF50;
            color: #E0E0E0;
        }
        QSpinBox, QDoubleSpinBox {
            background-color: #3A3A3A;
            border: 1px solid #4A4A4A;
            border-radius: 4px;
            padding: 6px;
            color: #E0E0E0;
        }
        QTextEdit, QPlainTextEdit {
            background-color: #1E1E1E;
            border: 1px solid #3A3A3A;
            border-radius: 4px;
            color: #E0E0E0;
            font-family: "Consolas", "Microsoft YaHei UI Mono", monospace;
        }
        QMessageBox {
            background-color: #2D2D2D;
        }
        QMessageBox QLabel {
            color: #E0E0E0;
        }
        QTreeWidget {
            background-color: #2D2D2D;
            border: 1px solid #3A3A3A;
            alternate-background-color: #353535;
        }
        QTreeWidget::item {
            padding: 5px;
            color: #E0E0E0;
        }
        QTreeWidget::item:selected {
            background-color: #4CAF50;
            color: #FFFFFF;
        }
        QTreeWidget::item:hover {
            background-color: #3A3A3A;
        }
        QListWidget {
            background-color: #2D2D2D;
            border: 1px solid #3A3A3A;
        }
        QListWidget::item {
            padding: 8px;
            color: #E0E0E0;
        }
        QListWidget::item:selected {
            background-color: #4CAF50;
            color: #FFFFFF;
        }
        QListWidget::item:hover {
            background-color: #3A3A3A;
        }
        QSplitter::handle {
            background-color: #3A3A3A;
        }
        QGroupBox {
            border: 1px solid #3A3A3A;
            border-radius: 6px;
            margin-top: 10px;
            color: #E0E0E0;
            font-weight: bold;
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px;
        }
        QCheckBox {
            color: #E0E0E0;
            spacing: 8px;
        }
        QCheckBox::indicator {
            width: 18px;
            height: 18px;
            border-radius: 4px;
            border: 2px solid #4A4A4A;
        }
        QCheckBox::indicator:checked {
            background-color: #4CAF50;
            border: 2px solid #4CAF50;
        }
        QRadioButton {
            color: #E0E0E0;
            spacing: 8px;
        }
        QRadioButton::indicator {
            width: 18px;
            height: 18px;
            border-radius: 9px;
            border: 2px solid #4A4A4A;
        }
        QRadioButton::indicator:checked {
            background-color: #4CAF50;
            border: 2px solid #4CAF50;
        }
        QTabWidget::pane {
            border: 1px solid #3A3A3A;
            background-color: #2D2D2D;
        }
        QTabBar::tab {
            background-color: #252525;
            color: #B0B0B0;
            padding: 8px 16px;
            border: 1px solid #3A3A3A;
            border-bottom: none;
            border-radius: 4px 4px 0 0;
        }
        QTabBar::tab:selected {
            background-color: #4CAF50;
            color: #FFFFFF;
        }
        QTabBar::tab:hover:!selected {
            background-color: #3A3A3A;
        }
        QProgressBar {
            background-color: #3A3A3A;
            border: none;
            border-radius: 4px;
            text-align: center;
            color: #E0E0E0;
        }
        QProgressBar::chunk {
            background-color: #4CAF50;
            border-radius: 4px;
        }
        QDialog {
            background-color: #2D2D2D;
        }
    """

    @staticmethod
    def apply_theme(app: QApplication):
        app.setStyleSheet(ThemeManager.DARK_THEME)
