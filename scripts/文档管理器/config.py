"""
文档管理器配置文件
"""

from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
DOCS_DIR = REPO_ROOT / "docs"
COURSE_DIR = DOCS_DIR / "course"
LOG_ROOT = DOCS_DIR / "sundry" / "更新日志"
BACKUP_DIR = SCRIPT_DIR / "备份区"
STAGING_DIR = SCRIPT_DIR / "暂存区"

API_URL_TEMPLATE = "http://api.cqu-openlib.cn/file?key={key}"

PATTERNS = {
    "course_code": r"^[A-Z]+\d+$",
    "lanzou_key": r"(?:lanzou[a-z]?\.com/([A-Za-z0-9]{12})|key=([A-Za-z0-9]{12})|^[A-Za-z0-9]{12}$)",
    "tab_header": r'^===\s*":material-book:`([^`]+)`"',
    "section_header": r"^##\s+(.+)$",
    "list_item": r"^(\s*)\*\s+(.+)$",
    "link": r"\[([^\]]+)\]\(([^)]+)\)",
    "contributor": r"@\[?([^\]\s@]+)\]?(?:\(([^)]+)\))?",
    "calendar": r":material-calendar:`([^`]+)`",
    "tag": r":material-tag:`([^`]+)`",
}

REQUIRED_SECTIONS = ["攻略", "资源"]

RESOURCE_TEMPLATES = {
    "textbook": "    * [{name}]({url}) - :material-format-quote-open:`{book_name}` - :material-account:`{author}` - :material-printer:`{publisher}`  ",
    "exam_paper": "        * [{name}]({url}) - :material-calendar:`{semester}` - :material-tag:`{paper_type}`  ",
    "online_course": "    * [{platform}]({url})网课  \n        * [{name}]({course_url})  ",
    "online_course_with_contributor": "    * [{platform}]({url})网课  \n        * [{name}]({course_url}) @[{contributor}]({contributor_url})  ",
}
