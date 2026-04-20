"""
工作区管理器模块
负责文件读写、备份管理、暂存区管理
"""

import shutil
import datetime as dt
from pathlib import Path
from typing import Optional, List
from config import BACKUP_DIR, STAGING_DIR, COURSE_DIR, DOCS_DIR


class WorkspaceManager:
    """工作区管理器"""

    def __init__(self):
        self.backup_dir = BACKUP_DIR
        self.staging_dir = STAGING_DIR
        self._ensure_dirs()

    def _ensure_dirs(self):
        """确保目录存在"""
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.staging_dir.mkdir(parents=True, exist_ok=True)

    def backup_file(
        self, file_path: Path, modified_content: Optional[str] = None
    ) -> Path:
        """
        备份文件到备份区（按日期组织）
        在文件被修改前调用

        Args:
            file_path: 原文件路径
            modified_content: 如果提供，备份原始内容（用于已读取的情况）

        Returns:
            备份文件路径
        """
        today = dt.datetime.now()
        date_dir = self.backup_dir / f"{today:%Y-%m-%d}"
        date_dir.mkdir(parents=True, exist_ok=True)

        original_name = file_path.name
        backup_name = f"{original_name}.bak"
        backup_path = date_dir / backup_name

        if modified_content is not None:
            original_content = file_path.read_text(encoding="utf-8")
            backup_path.write_text(original_content, encoding="utf-8")
        else:
            shutil.copy2(file_path, backup_path)

        return backup_path

    def get_backup_path(self, file_path: Path) -> Path:
        """获取今日备份路径"""
        today = dt.datetime.now()
        date_dir = self.backup_dir / f"{today:%Y-%m-%d}"
        return date_dir / f"{file_path.name}.bak"

    def has_backup_today(self, file_path: Path) -> bool:
        """检查今日是否已有备份"""
        backup_path = self.get_backup_path(file_path)
        return backup_path.exists()

    def restore_from_backup(self, backup_path: Path, target_path: Path) -> bool:
        """从备份恢复文件"""
        if not backup_path.exists():
            return False
        shutil.copy2(backup_path, target_path)
        return True

    def move_to_staging(
        self, file_path: Path, template_content: Optional[str] = None
    ) -> Path:
        """
        将不合规文档移入暂存区

        Args:
            file_path: 原文件路径
            template_content: 如果提供，使用模板内容；否则复制原内容

        Returns:
            暂存区文件路径
        """
        staging_path = self.staging_dir / file_path.name

        if staging_path.exists():
            timestamp = dt.datetime.now().strftime("%H%M%S")
            staging_path = self.staging_dir / f"{file_path.stem}_{timestamp}.md"

        if template_content:
            staging_path.write_text(template_content, encoding="utf-8")
        else:
            shutil.copy2(file_path, staging_path)

        return staging_path

    def list_staging_files(self) -> List[Path]:
        """列出暂存区文件"""
        return list(self.staging_dir.glob("*.md"))

    def list_backup_dates(self) -> List[str]:
        """列出备份区的日期目录"""
        return sorted([d.name for d in self.backup_dir.iterdir() if d.is_dir()])

    def list_backups_by_date(self, date_str: str) -> List[Path]:
        """列出指定日期的备份文件"""
        date_dir = self.backup_dir / date_str
        if not date_dir.exists():
            return []
        return list(date_dir.glob("*.bak"))

    def read_file(self, file_path: Path) -> str:
        """读取文件内容"""
        return file_path.read_text(encoding="utf-8")

    def write_file(
        self, file_path: Path, content: str, create_backup: bool = True
    ) -> Optional[Path]:
        """
        写入文件内容

        Args:
            file_path: 文件路径
            content: 新内容
            create_backup: 是否创建备份（默认True）

        Returns:
            备份文件路径（如果创建了备份）或None
        """
        backup_path: Optional[Path] = None

        if create_backup and file_path.exists():
            backup_path = self.backup_file(file_path)

        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")

        return backup_path

    def get_course_file_path(self, course_name: str) -> Path:
        """获取课程文件路径"""
        return COURSE_DIR / f"{course_name}.md"

    def course_file_exists(self, course_name: str) -> bool:
        """检查课程文件是否存在"""
        return self.get_course_file_path(course_name).exists()

    def create_course_file(self, course_name: str, course_code: str = "") -> Path:
        """
        创建新课程文件（在暂存区）

        Args:
            course_name: 课程名称
            course_code: 课程编号

        Returns:
            暂存区文件路径
        """
        template = self._generate_course_template(course_name, course_code)
        staging_path = self.staging_dir / f"{course_name}.md"

        if staging_path.exists():
            timestamp = dt.datetime.now().strftime("%H%M%S")
            staging_path = self.staging_dir / f"{course_name}_{timestamp}.md"

        staging_path.write_text(template, encoding="utf-8")
        return staging_path

    def _generate_course_template(self, course_name: str, course_code: str) -> str:
        """生成课程文档模板"""
        template_lines = [
            "## 攻略  ",
            "- 暂无攻略，欢迎贡献",
            "",
            "## 资源  ",
        ]

        if course_code:
            template_lines.append(f'=== ":material-book:`{course_code}`"  ')
            template_lines.append(
                "    * [教材]() - :material-format-quote-open:`教材名` - :material-account:`主编` - :material-printer:`出版社`  "
            )
        else:
            template_lines.append('=== ":material-book:`课程号`"  ')
            template_lines.append(
                "    * [教材]() - :material-format-quote-open:`教材名` - :material-account:`主编` - :material-printer:`出版社`  "
            )

        template_lines.append("    * 期末试卷")
        template_lines.append(
            "        * [试卷+答案]() - :material-calendar:`学期` - :material-tag:`A卷`  "
        )
        template_lines.append("    * 网课")
        template_lines.append("        * [网课名称]() @[贡献者](贡献者链接)")

        return "\n".join(template_lines) + "\n"

    def replace_course_file_from_staging(
        self, staging_path: Path, course_name: str
    ) -> Path:
        """
        用暂存区文件替换课程文件

        Args:
            staging_path: 暂存区文件路径
            course_name: 课程名称

        Returns:
            目标课程文件路径
        """
        target_path = self.get_course_file_path(course_name)

        if target_path.exists():
            self.backup_file(target_path)

        content = staging_path.read_text(encoding="utf-8")
        target_path.write_text(content, encoding="utf-8")

        staging_path.unlink()

        return target_path
