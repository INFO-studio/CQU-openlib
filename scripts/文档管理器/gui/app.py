"""
GUI应用入口
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
from gui.main_window import MainWindow
from gui.styles.theme import ThemeManager


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("CQU-openlib 文档管理器")

    ThemeManager.apply_theme(app)

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
