"""
文档管理器主程序
提供命令行交互界面
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from config import COURSE_DIR, STAGING_DIR
from workspace import WorkspaceManager
from modifier import DocumentModifier
from validator import DocumentValidator
from parser import DocumentParser
from utils import extract_lanzou_key, parse_composite_info, validate_course_code


def print_header():
    print("=" * 50)
    print("  CQU-openlib 文档管理器")
    print("=" * 50)


def interactive_add_textbook():
    """交互式添加教材"""
    print("\n[ 添加教材 ]")

    workspace = WorkspaceManager()

    course_name = ""
    while True:
        course_name = input("请输入课程名称: ").strip()
        if course_name:
            course_path = workspace.get_course_file_path(course_name)
            if course_path.exists():
                break
            print(f"未找到课程文件: {course_name}")
            create_new = input("是否创建新课程文件到暂存区? (y/n): ").strip().lower()
            if create_new == "y":
                course_code = input("请输入课程编号（可选，直接回车跳过）: ").strip()
                staging_path = workspace.create_course_file(course_name, course_code)
                print(f"[ 暂存区 ] 已创建: {staging_path}")
                print("请先编辑暂存区文件使其合规，再运行添加教材")
                return
        else:
            print("课程名称不能为空")

    course_code = ""
    while True:
        course_code = input("请输入课程编号（如 MATH10821）: ").strip()
        if course_code and validate_course_code(course_code):
            break
        print("课程编号格式有误，应为类似 ABC12345 的格式")

    key_input = ""
    while True:
        key_input = input("请输入蓝奏云链接或12位密钥: ").strip()
        key = extract_lanzou_key(key_input)
        if key:
            break
        print("密钥格式有误，应为蓝奏云分享链接或12位密钥")

    composite = ""
    while True:
        composite = input("请输入教材信息（格式: 教材-教材名-主编-出版社）: ").strip()
        if composite:
            parts = composite.split("-")
            if len(parts) >= 3:
                break
            print("格式有误，示例: 教材-高等数学-同济大学数学系-高等教育出版社")
        else:
            print("教材信息不能为空")

    textbook_name, author, publisher, volume = parse_composite_info(composite)

    modifier = DocumentModifier(workspace.get_course_file_path(course_name))
    is_valid, errors = modifier.load_and_validate()

    if not is_valid:
        print("[ 校验 ] 文档不合规:")
        for err in errors:
            print(f"  - {err}")
        print("[ 操作 ] 文档已移入暂存区，请手动整理")
        staging_path = workspace.move_to_staging(modifier.file_path)
        print(f"[ 暂存区 ] {staging_path}")
        return

    success = modifier.add_textbook(
        course_code, key, textbook_name, author, publisher, volume
    )

    if success:
        print(f"[ 成功 ] 已添加教材到: {course_name}")
    else:
        print("[ 失败 ] 添加教材失败")


def interactive_add_exam_paper():
    """交互式添加试卷"""
    print("\n[ 添加试卷 ]")

    workspace = WorkspaceManager()

    course_name = ""
    while True:
        course_name = input("请输入课程名称: ").strip()
        if workspace.course_file_exists(course_name):
            break
        print(f"未找到课程文件: {course_name}")

    course_code = ""
    while True:
        course_code = input("请输入课程编号: ").strip()
        if course_code:
            break
        print("课程编号不能为空")

    exam_type = input("试卷类型 (1=期中试卷, 2=期末试卷，默认期末): ").strip()
    exam_type = "期末试卷" if exam_type != "1" else "期中试卷"

    key_input = ""
    while True:
        key_input = input("请输入蓝奏云链接或密钥: ").strip()
        key = extract_lanzou_key(key_input)
        if key:
            break
        print("密钥格式有误")

    semester = input("请输入学期（如 2024秋）: ").strip()
    if not semester:
        semester = input("学期不能为空，请重新输入: ").strip()

    paper_type = input("试卷类型标签（A卷/B卷，默认A卷）: ").strip()
    paper_type = paper_type if paper_type in ["A卷", "B卷"] else "A卷"

    paper_name = f"试卷+答案"

    modifier = DocumentModifier(workspace.get_course_file_path(course_name))
    is_valid, errors = modifier.load_and_validate()

    if not is_valid:
        print("[ 校验 ] 文档不合规，无法修改")
        for err in errors:
            print(f"  - {err}")
        return

    success = modifier.add_exam_paper(
        course_code, key, paper_name, semester, paper_type
    )

    if success:
        print(f"[ 成功 ] 已添加试卷到: {course_name}")
    else:
        print("[ 失败 ] 添加试卷失败")


def interactive_add_online_course():
    """交互式添加网课（带贡献者）"""
    print("\n[ 添加网课（带贡献者） ]")

    workspace = WorkspaceManager()

    course_name = ""
    while True:
        course_name = input("请输入课程名称: ").strip()
        if workspace.course_file_exists(course_name):
            break
        print(f"未找到课程文件: {course_name}")

    course_code = ""
    while True:
        course_code = input("请输入课程编号: ").strip()
        if course_code:
            break
        print("课程编号不能为空")

    platform = input("请输入平台名称（如 学堂在线）: ").strip()
    if not platform:
        platform = input("平台名称不能为空: ").strip()

    platform_url = input("请输入平台链接（可选，直接回车跳过）: ").strip()

    course_name_input = input("请输入课程名（如 高等数学）: ").strip()
    if not course_name_input:
        course_name_input = input("课程名不能为空: ").strip()

    course_url_input = ""
    while True:
        course_url_input = input("请输入课程链接或蓝奏云密钥: ").strip()
        key = extract_lanzou_key(course_url_input)
        if key:
            from utils import build_api_url

            course_url_input = build_api_url(key)
            break
        if course_url_input.startswith("http"):
            break
        print("请输入有效的链接或蓝奏云密钥")

    contributor_name = input("请输入贡献者名称: ").strip()
    contributor_url = input("请输入贡献者链接（可选）: ").strip()

    modifier = DocumentModifier(workspace.get_course_file_path(course_name))
    is_valid, errors = modifier.load_and_validate()

    if not is_valid:
        print("[ 校验 ] 文档不合规，无法修改")
        for err in errors:
            print(f"  - {err}")
        return

    success = modifier.add_online_course_with_contributor(
        course_code,
        platform,
        platform_url or "",
        course_name_input,
        course_url_input,
        contributor_name,
        contributor_url,
    )

    if success:
        print(f"[ 成功 ] 已添加网课到: {course_name}")
        print(f"  贯献者: @{contributor_name}")
    else:
        print("[ 失败 ] 添加网课失败")


def interactive_validate():
    """交互式校验文档"""
    print("\n[ 校验文档 ]")

    workspace = WorkspaceManager()

    course_name = input("请输入课程名称（或直接回车查看所有课程）: ").strip()

    if course_name:
        course_path = workspace.get_course_file_path(course_name)
        if not course_path.exists():
            print(f"未找到课程文件: {course_name}")
            return

        parser = DocumentParser(str(course_path))
        structure = parser.parse()
        validator = DocumentValidator(structure)
        is_valid = validator.validate()

        print(validator.get_validation_report())
    else:
        print("\n扫描所有课程文件...")
        for course_file in COURSE_DIR.glob("*.md"):
            parser = DocumentParser(str(course_file))
            structure = parser.parse()
            validator = DocumentValidator(structure)
            validator.validate()

            status = "[合规]" if structure.is_valid else "[不合规]"
            print(f"  {status} {course_file.name}")

            if not structure.is_valid:
                for err in structure.validation_errors[:2]:
                    print(f"    - {err}")


def interactive_create_course():
    """交互式创建新课程文件"""
    print("\n[ 创建新课程 ]")

    workspace = WorkspaceManager()

    course_name = input("请输入新课程名称: ").strip()
    if not course_name:
        print("课程名称不能为空")
        return

    course_code = input("请输入课程编号（可选）: ").strip()

    staging_path = workspace.create_course_file(course_name, course_code)

    print(f"[ 暂存区 ] 已创建: {staging_path}")
    print("请编辑此文件使其符合文档结构标准后，再进行其他操作")


def interactive_list_staging():
    """列出暂存区文件"""
    print("\n[ 暂存区文件 ]")

    workspace = WorkspaceManager()
    staging_files = workspace.list_staging_files()

    if not staging_files:
        print("  暂存区为空")
        return

    for f in staging_files:
        print(f"  - {f.name}")


def interactive_list_backups():
    """列出备份"""
    print("\n[ 备份区 ]")

    workspace = WorkspaceManager()
    dates = workspace.list_backup_dates()

    if not dates:
        print("  备份区为空")
        return

    print("可用备份日期:")
    for date in dates:
        backups = workspace.list_backups_by_date(date)
        print(f"  {date} ({len(backups)} 个文件)")
        for b in backups[:5]:
            print(f"    - {b.name}")


def interactive_menu():
    """交互式菜单"""
    print_header()

    while True:
        print("\n可用操作:")
        print("  1. 添加教材")
        print("  2. 添加试卷")
        print("  3. 添加网课（带贡献者）")
        print("  4. 校验文档")
        print("  5. 创建新课程")
        print("  6. 查看暂存区")
        print("  7. 查看备份区")
        print("  0. 退出")

        choice = input("\n请选择操作: ").strip()

        if choice == "1":
            interactive_add_textbook()
        elif choice == "2":
            interactive_add_exam_paper()
        elif choice == "3":
            interactive_add_online_course()
        elif choice == "4":
            interactive_validate()
        elif choice == "5":
            interactive_create_course()
        elif choice == "6":
            interactive_list_staging()
        elif choice == "7":
            interactive_list_backups()
        elif choice == "0":
            print("\n再见!")
            break
        else:
            print("无效选择，请重新输入")


def batch_process(input_file: str):
    """批量处理（从JSON文件读取）"""
    print_header()
    print(f"\n[ 批量处理 ] 读取: {input_file}")

    workspace = WorkspaceManager()

    with open(input_file, "r", encoding="utf-8") as f:
        items = json.load(f)

    for item in items:
        action = item.get("action")
        course_name = item.get("course_name")
        course_code = item.get("course_code")

        print(f"\n处理: {course_name} - {action}")

        course_path = workspace.get_course_file_path(course_name)
        if not course_path.exists():
            print(f"  [ 警告 ] 课程文件不存在: {course_name}")
            continue

        modifier = DocumentModifier(course_path)
        is_valid, errors = modifier.load_and_validate()

        if not is_valid:
            print(f"  [ 警告 ] 文档不合规，跳过")
            for err in errors:
                print(f"    - {err}")
            workspace.move_to_staging(course_path)
            continue

        if action == "add_textbook":
            key = extract_lanzou_key(item.get("key"))
            textbook_name = item.get("textbook_name")
            author = item.get("author")
            publisher = item.get("publisher")
            volume = item.get("volume")

            success = modifier.add_textbook(
                course_code, key, textbook_name, author, publisher, volume
            )
            print(f"  [{'成功' if success else '失败'}] 添加教材")

        elif action == "add_exam_paper":
            key = extract_lanzou_key(item.get("key"))
            semester = item.get("semester")
            paper_type = item.get("paper_type", "A卷")
            paper_name = item.get("paper_name", "试卷+答案")

            success = modifier.add_exam_paper(
                course_code, key, paper_name, semester, paper_type
            )
            print(f"  [{'成功' if success else '失败'}] 添加试卷")

        elif action == "add_online_course":
            platform = item.get("platform")
            platform_url = item.get("platform_url", "")
            course_url_input = item.get("course_url")
            key = extract_lanzou_key(course_url_input)
            if key:
                from utils import build_api_url

                course_url_input = build_api_url(key)
            contributor_name = item.get("contributor_name")
            contributor_url = item.get("contributor_url")

            success = modifier.add_online_course_with_contributor(
                course_code,
                platform,
                platform_url,
                item.get("course_name"),
                course_url_input,
                contributor_name,
                contributor_url,
            )
            print(f"  [{'成功' if success else '失败'}] 添加网课")


def main():
    parser = argparse.ArgumentParser(description="CQU-openlib 文档管理器")

    parser.add_argument("--interactive", "-i", action="store_true", help="交互式模式")
    parser.add_argument("--add-textbook", action="store_true", help="添加教材")
    parser.add_argument("--add-exam", action="store_true", help="添加试卷")
    parser.add_argument("--add-online", action="store_true", help="添加网课")
    parser.add_argument("--validate", action="store_true", help="校验文档")
    parser.add_argument("--create", action="store_true", help="创建新课程")
    parser.add_argument("--list-staging", action="store_true", help="列出暂存区")
    parser.add_argument("--list-backups", action="store_true", help="列出备份区")
    parser.add_argument("--batch", metavar="FILE", help="批量处理JSON文件")

    parser.add_argument("--course", help="课程名称")
    parser.add_argument("--code", help="课程编号")
    parser.add_argument("--key", help="蓝奏云密钥或链接")
    parser.add_argument("--textbook-name", help="教材名")
    parser.add_argument("--author", help="主编")
    parser.add_argument("--publisher", help="出版社")
    parser.add_argument("--volume", help="上册/下册")
    parser.add_argument("--semester", help="学期")
    parser.add_argument("--paper-type", default="A卷", help="试卷类型")
    parser.add_argument("--platform", help="平台名称")
    parser.add_argument("--platform-url", help="平台链接")
    parser.add_argument("--course-url", help="课程链接")
    parser.add_argument("--contributor", help="贡献者名称")
    parser.add_argument("--contributor-url", help="贡献者链接")

    args = parser.parse_args()

    if args.batch:
        batch_process(args.batch)
        return

    if len(sys.argv) == 1 or args.interactive:
        interactive_menu()
        return

    workspace = WorkspaceManager()

    if args.validate and args.course:
        course_path = workspace.get_course_file_path(args.course)
        if course_path.exists():
            doc_parser = DocumentParser(str(course_path))
            structure = doc_parser.parse()
            doc_validator = DocumentValidator(structure)
            doc_validator.validate()
            print(doc_validator.get_validation_report())
        else:
            print(f"未找到课程: {args.course}")
        return

    if args.create and args.course:
        staging_path = workspace.create_course_file(args.course, args.code or "")
        print(f"[ 暂存区 ] 已创建: {staging_path}")
        return

    if args.list_staging:
        for f in workspace.list_staging_files():
            print(f"  - {f.name}")
        return

    if args.list_backups:
        for date in workspace.list_backup_dates():
            print(f"  {date}")
        return

    if not args.course:
        print("请指定课程名称 (--course)")
        return

    course_path = workspace.get_course_file_path(args.course)
    if not course_path.exists():
        print(f"未找到课程文件: {args.course}")
        return

    modifier = DocumentModifier(course_path)
    is_valid, errors = modifier.load_and_validate()

    if not is_valid:
        print("[ 校验 ] 文档不合规，无法修改")
        for err in errors:
            print(f"  - {err}")
        staging_path = workspace.move_to_staging(course_path)
        print(f"[ 暂存区 ] 文档已移入: {staging_path}")
        return

    if args.add_textbook:
        key = extract_lanzou_key(args.key)
        success = modifier.add_textbook(
            args.code, key, args.textbook_name, args.author, args.publisher, args.volume
        )
        print(f"[ {'成功' if success else '失败'} ] 添加教材")

    elif args.add_exam:
        key = extract_lanzou_key(args.key)
        success = modifier.add_exam_paper(
            args.code, key, "试卷+答案", args.semester, args.paper_type
        )
        print(f"[ {'成功' if success else '失败'} ] 添加试卷")

    elif args.add_online:
        key = extract_lanzou_key(args.course_url)
        course_url = args.course_url
        if key:
            from utils import build_api_url

            course_url = build_api_url(key)
        success = modifier.add_online_course_with_contributor(
            args.code,
            args.platform,
            args.platform_url or "",
            args.textbook_name or args.course,
            course_url,
            args.contributor,
            args.contributor_url,
        )
        print(f"[ {'成功' if success else '失败'} ] 添加网课")


if __name__ == "__main__":
    main()
