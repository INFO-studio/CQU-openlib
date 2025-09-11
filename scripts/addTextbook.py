import argparse
import datetime as dt
import os
import re
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple, Dict, TypedDict, Union

REPO_ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = REPO_ROOT / "docs"
COURSE_DIR = DOCS_DIR / "course"
LOG_ROOT = DOCS_DIR / "sundry" / "更新日志"

def run(
    cmd: List[str],
    cwd: Optional[Path] = None,
    check: bool = True,
    env: Optional[Dict[str, str]] = None,
):
    """增加默认参数，运行命令"""
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        check=check,
        shell=False,
        env={**os.environ, **(env or {})},
    )


def git_pull(
    force: bool = False
) -> None:
    try:
        if force: 
            run(["git", "fetch", "origin", "main"], cwd=REPO_ROOT)
            run(["git", "reset", "--hard", "origin/main"], cwd=REPO_ROOT)
            run(["git", "clean", "-fd"], cwd=REPO_ROOT)
            print("[  git  ] repository reset to origin/main")
        else:
            run(["git", "pull", "origin", "main"], cwd=REPO_ROOT)
            print("[  git  ] pulled origin main")
    except subprocess.CalledProcessError as exc:
            print(exc.stdout)
            print(exc.stderr)
            raise SystemExit("Git pull failed; aborting to avoid conflicts.")


def extract_key(key: str, error: bool = False) -> Union[str, bool]:
    url = re.search(r"lanzou[a-z]?\.com/([A-Za-z0-9]{12})", key)
    if url:
        return url.group(1)
    query = re.search(r"key=([A-Za-z0-9]{12})", key)
    if query:
        return query.group(1)
    if re.fullmatch(r"[A-Za-z0-9]{12}", key):
        return key
    if error:
        raise SystemExit("Cannot parse Lanzou key. Provide share URL, API URL, or the key itself.")
    else:
        return False


def ensure_course_page(course_name: str, error: bool = False) -> Union[Path, bool]:
    COURSE_DIR.mkdir(parents=True, exist_ok=True)
    course_file = COURSE_DIR / f"{course_name}.md"
    if not course_file.exists():
        if error:
            raise SystemExit("未找到对应课程文件")
        else:
            return False
    else:
        return course_file


def add_resource_to_course(
    course_file: Path,
    course_code: str,
    api_url: str,
    textbook_name: str,
    editor_first: str,
    publisher: str,
    volume: str | None,
) -> None:
    lines = course_file.read_text(encoding="utf-8").splitlines()

    joined_preview = "\n".join(lines[:10])
    if any(
        key in joined_preview
        for key in ["暂无数据", "欢迎贡献", "如果您知晓本门课程需要什么教材"]
    ):
        lines = ["## 资源  "]
    def normalize_lines(src: List[str]) -> List[str]:
        out: List[str] = []
        i = 0
        while i < len(src) and src[i].strip() == "":
            i += 1
        while i < len(src):
            raw = src[i]
            s = raw.lstrip()
            if s.startswith("##") and "资源" in s:
                out.append("## 资源  ")
                i += 1
                while i < len(src) and src[i].strip() == "":
                    i += 1
                continue
            if s.startswith('=== ":material-book:`'):
                first = s.find('`')
                last = s.rfind('`')
                if first != -1 and last != -1 and last > first:
                    code = s[first+1:last]
                    out.append(f'=== ":material-book:`{code}`"  ')
                else:
                    out.append('=== ":material-book:``"  ')
                i += 1
                while i < len(src) and src[i].strip() == "":
                    i += 1
                continue
            out.append(raw)
            i += 1
        return out
    lines = normalize_lines(lines)
    print("[courses] normalized.")

    tab_header_with_spaces = f'=== ":material-book:`{course_code}`"  '
    tab_header_trimmed = f'=== ":material-book:`{course_code}`"'
    resource_line = (
        f"    * [教材{volume if volume else ''}]({api_url}) - :material-format-quote-open:`{textbook_name}` - :material-account:`{editor_first}` - :material-printer:`{publisher}`  "
    )

    if not any(l.strip().startswith("## 资源") for l in lines):
        lines.extend(["", "## 资源  ", ""]) 

    try:
        idx = next(
            i for i, l in enumerate(lines)
            if (l == tab_header_with_spaces) or (l.strip() == tab_header_trimmed)
        )
        scan = idx + 1
        last_textbook_line: Optional[int] = None
        while scan < len(lines):
            current = lines[scan]
            stripped = current.strip()
            if stripped.startswith('=== ":material-book:`') or stripped.startswith("## "):
                break
            if current.startswith("    * [教材"):
                last_textbook_line = scan
                scan += 1
                continue
            if current.startswith("    * ") or current.startswith("        * "):
                break
            scan += 1
        insert_at = (last_textbook_line + 1) if last_textbook_line is not None else (idx + 1)
        lines.insert(insert_at, resource_line)
        print(f"[courses] appended resource under existing tab {course_code}")
    except StopIteration:
        resource_idx = max(i for i, l in enumerate(lines) if l.strip().startswith("## 资源"))
        insertion_point = resource_idx + 1
        lines[insertion_point:insertion_point] = [tab_header_with_spaces, resource_line]
        print(f"[courses] created new tab {course_code} and added resource")

    while lines and lines[0].strip() == "":
        lines.pop(0)
    course_file.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_composite_info(composite: str, error: bool = False) -> Tuple[str, str, str, Optional[str]]:
    """
    Parse '教材([上/下]册)-{教材名}-{教材主编首位}-{教材出版社}'
    Returns: (textbook_name, editor_first, publisher, volume)
    Volume may be None if not present.
    If error=True, raises SystemExit on failure.
    """
    composite = composite.strip()
    volume: Optional[str] = None
    
    # 尝试匹配带上下册的格式
    m = re.match(r"^教材([上下]册)-(.+)$", composite)
    if m:
        volume = m.group(1).strip()
        rest = m.group(2)
    else:
        # 尝试匹配不带上下册的格式
        if composite.startswith("教材-"):
            rest = composite[len("教材-"):]
        else:
            # 如果都不匹配，根据error参数处理
            if error:
                raise SystemExit("Composite info must start with '教材' or '教材上册' or '教材下册'")
            else:
                rest = composite
    
    parts = [p.strip() for p in rest.split("-")]
    if len(parts) < 3:
        if error:
            raise SystemExit("Composite info must be: 教材([上/下]册)-教材名-主编首位-出版社")
        else:
            # 返回默认值或空值
            return "", "", "", volume
    
    textbook_name, editor_first, publisher = parts[0], parts[1], "-".join(parts[2:])
    return textbook_name, editor_first, publisher, volume


def write_daily_log(
    course_name: str,
    textbook_name: str,
    course_code: str,
    editor_first: str,
    publisher: str,
    include_tab_line: bool,
    include_form_line: bool,
    form_index: int,
) -> Path:
    today = dt.datetime.now()
    log_dir = LOG_ROOT / f"{today:%Y}" / f"{today:%Y}-{today:%m}"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"{today:%Y}-{today:%m}-{today:%d}.md"
    
    if log_file.exists():
        lines: list[str] = log_file.read_text(encoding="utf-8").strip("\n").split("\n")
    else:
        lines: list[str] = [
            "---",
            "search:",
            "  exclude: true",
            "---",
            "",
        ]

    if include_tab_line:
        lines.append(f"- 新建 [{course_name}](../../../../course/{course_name}.md) 页 `tab: {course_code}`")

    lines.append(f"- 新增 [{course_name}](../../../../course/{course_name}.md) 页 `res: 教材-{textbook_name}-{editor_first}-{publisher}`")

    if include_form_line:
        lines.append(f"- 完成 [待办事项-教材需求](../../../待办事项/textbook.md) `#{form_index}`")

    log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[  log  ] wrote {log_file}")
    return log_file


def update_log() -> None:
    try:
        run(
            ["python", str(REPO_ROOT / "scripts" / "updateLog.py")],
            cwd=REPO_ROOT,
            env={"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"},
        )
        print("[scripts] updateLog.py executed")
    except subprocess.CalledProcessError as exc:
        print(exc.stdout)
        print(exc.stderr)
        print("[warning] updateLog.py failed; continuing without push")


def push_changes(commit_message: str) -> None:
    run(["git", "add", "."], cwd=REPO_ROOT)
    run(["git", "commit", "-m", commit_message], cwd=REPO_ROOT)
    run(["git", "push"], cwd=REPO_ROOT)
    print("[  git  ] changes pushed")

class Args(TypedDict):
    course_name: str
    course_code: str
    key: str
    composite: str
    no_tab_line: bool
    form_line: bool
    form_index: int
    push: bool
    skip_pull: bool
    commit: str
    force_pull: str


def interactive_args(args) -> Args:
    course_name: str = args.course_name
    course_code: str = args.course_code
    key: str = args.key
    composite: str = args.composite
    no_tab_line: bool = args.no_tab_line
    form_line: bool = args.form_line
    form_index: int = int(args.form_index)
    push: bool = args.push
    skip_pull: bool = args.skip_pull
    commit: str = args.commit
    force_pull: bool = args.force_pull

    if not course_name:
        course_name_correct = False
        while not course_name_correct:
            course_name = input('请输入课程名称\n> ').strip()
            if ensure_course_page(course_name) != False:
                course_name_correct = True
            else:
                print("未找到对应文件\n注意：请不要包含任何的附加内容，「高等数学II」请改为「高等数学」，如无对应文件，请手动创建")
    
    if not course_code:
        course_code_correct = False
        while not course_code_correct:
            course_code = input('请输入课程号\n> ').strip()
            if re.match(r"^\*?[A-Z]*[0-9]*$", course_code):
                course_code_correct = True
            else:
                print("格式有误\n注意：格式类似ABC12345")

    if not key:
        key_correct = False
        while not key_correct:
            key = input("请输入链接\n> ")
            if extract_key(key) != False:
                key_correct = True
            else:
                print("格式有误\n注意：应为蓝奏云外链分享地址或密钥（操作 - 外链分享地址 - 最后一字段12字符密钥）")

    if not composite:
        composite_correct = False
        while not composite_correct:
            composite = input("请输入书目\n> ").strip()
            if parse_composite_info(composite) != False:
                composite_correct = True
            else:
                print("格式有误\n注意：格式类似「教材-高等数学-张三-重庆大学出版社」")

    if push and not commit:
        commit = input("请输入提交信息\n")

    return {
        "course_name": course_name,
        "course_code": course_code,
        "key": key,
        "composite": composite,
        "no_tab_line": no_tab_line,
        "form_line": form_line,
        "form_index": form_index,
        "push": push,
        "skip_pull": skip_pull,
        "commit": commit,
        "force_pull": force_pull,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Add textbook resource and update logs, with pull+push.")
    parser.add_argument("--course_name", help="课程名称，例如: 人工智能导论")
    parser.add_argument("--course_code", help="课程号，例如: ABC1234")
    parser.add_argument("--key", help="蓝奏云12位或更长的Key，或分享/API链接")
    parser.add_argument("--composite", help="教材([上/下]册)-教材名-主编首位-出版社")
    parser.add_argument("--no-tab-line", action="store_true", help="日志中不写入新建tab行")
    parser.add_argument("--form-line", action="store_true", help="日志中写入表单项完成行")
    parser.add_argument("--form-index", default="0", help="对应表单项")
    parser.add_argument("--push", action="store_true", help="执行 git add/commit/push 以上传变更")
    parser.add_argument("--skip-pull", action="store_true", help="跳过开始时的 git pull（本地脏工作区时可用）")
    parser.add_argument("--commit", default="更新: 新增教材资源", help="与 --push 搭配使用的提交信息")
    parser.add_argument("--force-pull", action="store_true", help="强制以云端为准，丢弃本地改动 (fetch+reset --hard+clean)")
    parser_args = parser.parse_args()

    args = interactive_args(parser_args)

    os.chdir(REPO_ROOT)
    if not args["skip_pull"]:
        git_pull(bool(args["force_pull"]))
    else:
        print("[  git  ] skip pull as requested (--skip-pull)")

    key = extract_key(args["key"], True)
    api_url = f"http://api.cqu-openlib.cn/file?key={key}"
    print(f"[  key  ] {key}\n[  url  ] {api_url}")

    course_file = ensure_course_page(args["course_name"], True)

    textbook_name, editor_first, publisher, volume = parse_composite_info(args["composite"], True)

    add_resource_to_course(course_file, args["course_code"], api_url, textbook_name, editor_first, publisher, volume)

    write_daily_log(
        course_name=args["course_name"],
        textbook_name=textbook_name,
        course_code=args["course_code"],
        editor_first=editor_first,
        publisher=publisher,
        include_tab_line=not args["no_tab_line"],
        include_form_line=args["form_line"],
        form_index=args["form_index"]
    )

    update_log()
    if args["push"]:
        push_changes(args["commit"])


if __name__ == "__main__":
    main()


