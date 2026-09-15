from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from collections.abc import Iterable, Iterator
from decimal import Decimal, InvalidOperation
import hashlib
from itertools import zip_longest
import json
from pathlib import Path
import re
import sys
from typing import TypedDict, Union
import warnings
from urllib.parse import quote

import openpyxl
from openpyxl.worksheet._read_only import ReadOnlyWorksheet


CellValue = Union[str, int, float, None]
RawFields = dict[str, CellValue]


class Source(TypedDict):
    file: str
    sheet: str
    row: int


class CourseRecord(TypedDict):
    college: str
    major: str
    year: str
    level: str | None
    category: str | None
    nature: str | None
    name: str | None
    code: str | None
    semester_raw: str | None
    remarks: str | None
    total_credits: str | None
    semesters: list[str]
    course_page: str | None
    link_method: str
    raw_fields: RawFields
    sources: list[Source]


class Summary(TypedDict):
    files: int
    input_rows: int
    input_rows_by_file: dict[str, int]
    excluded_minor_or_dual_degree: int
    retained_rows: int
    duplicate_rows_merged: int
    unique_records: int
    colleges: int
    major_pages: int
    records_by_year: dict[str, int]
    records_by_category: dict[str, int]
    records_by_level: dict[str, int]
    zero_credits: int
    missing_credits: int
    missing_semesters: int
    multi_semester_records: int
    records_with_remarks: int
    link_methods: dict[str, int]


class CleanData(TypedDict):
    schema_version: int
    summary: Summary
    records: list[CourseRecord]


class Bundle(CleanData):
    markdown_previews: dict[str, str]


class CourseMetadata(TypedDict):
    codes: list[str]


class Metadata(TypedDict, total=False):
    courses: dict[str, CourseMetadata]


TOOL_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOL_DIR.parents[1]
SEMESTER_NAMES = {
    str(number): f"大{'一二三四五六'[(number - 1) // 2]}{'上' if number % 2 else '下'}"
    for number in range(1, 13)
}
SEMESTER_NAMES.update({f"S{number}": f"小学期{'一二三四五'[number - 1]}" for number in range(1, 6)})
SEMESTER_ORDER = tuple(
    key
    for year in range(1, 7)
    for key in (str(year * 2 - 1), str(year * 2), f"S{year}")
    if key in SEMESTER_NAMES
)
CATEGORY_ORDER = (
    "公共基础课程", "大类基础课程", "大类平台课程", "专业基础课程", "专业课程",
    "实践环节", "其他必修环节", "通识教育课程", "个性化模块", "非限制选修课程",
)
REQUIRED_HEADERS = (
    "学院", "专业", "年级", "课程类别", "课程性质", "课程名称", "课程代码", "总学分", "开课学期",
)


def text(value: object) -> str | None:
    return None if value is None or str(value).strip() == "" else str(value).strip()


def parse_semesters(value: CellValue) -> list[str]:
    raw = text(value)
    if raw is None:
        return []
    semesters: set[str] = set()
    for part in raw.split(","):
        match = re.fullmatch(r"\s*(S?[1-9][0-9]*)(?:\s*-\s*(S?[1-9][0-9]*))?\s*", part)
        if not match:
            raise ValueError(f"无效开课学期：{raw!r}")
        start, end = match.groups()
        end = end or start
        if start not in SEMESTER_NAMES or end not in SEMESTER_NAMES or start.startswith("S") != end.startswith("S"):
            raise ValueError(f"学期越界或混合区间：{raw!r}")
        first, last = int(start.lstrip("S")), int(end.lstrip("S"))
        if first > last:
            raise ValueError(f"学期区间倒序：{raw!r}")
        prefix = "S" if start.startswith("S") else ""
        semesters.update(f"{prefix}{number}" for number in range(first, last + 1))
    return [semester for semester in SEMESTER_ORDER if semester in semesters]


def normalize_credits(value: CellValue) -> str | None:
    raw = text(value)
    if raw is None:
        return None
    try:
        credits = Decimal(raw)
    except InvalidOperation as error:
        raise ValueError(f"无效总学分：{raw!r}") from error
    if not credits.is_finite() or credits < 0:
        raise ValueError(f"无效总学分：{raw!r}")
    return "0" if credits == 0 else format(credits.normalize(), "f")


def simplify_course_name(name: str) -> str:
    for fragment, target in (("英语", "英语"), ("体育", "体育"), ("文明经典", "文明经典系列")):
        if fragment in name:
            return target
    if "fourier分析" in name.lower():
        return "Fourier分析"
    name = name.replace("/", "、")
    name = re.sub(r"[（(].*?[）)]", "", name)
    name = re.sub(r"[-—]\w+$", "", name)
    name = re.sub(r"[IVXLCDMⅠⅡⅢⅣⅤⅥⅦⅧⅨ0-9]+$", "", name)
    return name.strip().lstrip("*")


def course_code_sort_key(code: str | None) -> tuple[str, int, str, str]:
    code = (code or "").lstrip("*")
    match = re.fullmatch(r"([A-Z]+)(\d+)(.*)", code)
    return (match[1], int(match[2]), match[3], code) if match else (code, -1, "", code)


class CourseLinks:
    def __init__(self, pages: Iterable[str], metadata: Metadata) -> None:
        self.pages = set(pages)
        self.by_code: defaultdict[str, set[str]] = defaultdict(set)
        for page, entry in metadata.get("courses", {}).items():
            if page in self.pages:
                for code in entry["codes"]:
                    self.by_code[code.lstrip("*")].add(page)

    @classmethod
    def from_repo(cls, repo_root: Path) -> CourseLinks:
        course_dir = repo_root / "public/doc/course"
        pages = {
            "/course/" + path.relative_to(course_dir).with_suffix("").as_posix()
            for path in course_dir.rglob("*.md")
            if path.is_file()
        }
        metadata = json.loads((repo_root / "metadata/course-codes.json").read_text(encoding="utf-8"))
        return cls(pages, metadata)

    def resolve(self, code: str | None, name: str | None) -> tuple[str | None, str]:
        candidates = self.by_code.get((code or "").lstrip("*"), set())
        if len(candidates) == 1:
            return next(iter(candidates)), "code"
        if len(candidates) > 1:
            return None, "ambiguous_code"
        if name:
            exact = "/course/" + name
            if exact in self.pages:
                return exact, "name"
            simplified = "/course/" + simplify_course_name(name)
            if simplified in self.pages:
                return simplified, "simplified_name"
        return None, "unlinked"


def read_excel_rows(data_dir: Path) -> Iterator[tuple[RawFields, Source]]:
    paths = sorted(data_dir.glob("*.xlsx"), key=lambda path: path.name)
    if not paths:
        raise ValueError(f"未找到 Excel：{data_dir}")
    for path in paths:
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="Workbook contains no default style", category=UserWarning)
            workbook = openpyxl.load_workbook(path, read_only=True, data_only=False)
        try:
            sheet = workbook.active
            if not isinstance(sheet, ReadOnlyWorksheet):
                raise ValueError(f"{path.name} 缺少可读取的活动工作表")
            # 教务导出的实际数据超过其声明的 A1 范围，必须按 XML 内容读取。
            sheet.reset_dimensions()
            rows = sheet.iter_rows(min_row=2, values_only=True)
            headers = [text(value) for value in next(rows, ())]
            named_headers = [header for header in headers if header is not None]
            missing = set(REQUIRED_HEADERS) - set(named_headers)
            if missing or len(set(named_headers)) != len(named_headers):
                raise ValueError(f"{path.name}:2 表头缺失或重名：{', '.join(sorted(missing))}")
            for row_number, values in enumerate(rows, start=3):
                if all(value is None for value in values):
                    continue
                fields: RawFields = {}
                for header, value in zip_longest(headers, values):
                    if header is None:
                        if value is not None:
                            raise ValueError(f"{path.name}:{row_number} 无表头列含数据")
                        continue
                    if value is not None and (isinstance(value, bool) or not isinstance(value, (str, int, float))):
                        raise ValueError(f"{path.name}:{row_number} {header} 含不支持的单元格类型")
                    if isinstance(value, str) and value.startswith("="):
                        raise ValueError(f"{path.name}:{row_number} {header} 含公式，不能推测计算结果")
                    fields[header] = value
                yield fields, {"file": path.name, "sheet": sheet.title, "row": row_number}
        finally:
            workbook.close()


def clean_rows(rows: Iterable[tuple[RawFields, Source]], links: CourseLinks) -> CleanData:
    records: dict[str, CourseRecord] = {}
    input_by_file: Counter[str] = Counter()
    excluded = 0
    for raw, source in rows:
        input_by_file[source["file"]] += 1
        major = text(raw.get("专业"))
        if major and ("辅修" in major or "双学位" in major):
            excluded += 1
            continue
        try:
            college = text(raw.get("学院"))
            year_text = text(raw.get("年级"))
            if college is None:
                raise ValueError("缺少分组字段：学院")
            if major is None:
                raise ValueError("缺少分组字段：专业")
            if year_text is None:
                raise ValueError("缺少分组字段：年级")
            year = Decimal(year_text)
            if not year.is_finite() or year != year.to_integral_value() or not 1000 <= year <= 9999:
                raise ValueError(f"无效年级：{year_text!r}")
            for header, name in (("学院", college), ("专业", major)):
                if name in (".", "..") or re.search(r"[/\\\x00-\x1f]", name):
                    raise ValueError(f"无效页面路径字段：{header}")
            code = text(raw.get("课程代码"))
            course_name = text(raw.get("课程名称"))
            course_page, link_method = links.resolve(code, course_name)
            record: CourseRecord = {
                "college": college,
                "major": major,
                "year": str(int(year)),
                "level": text(raw.get("层次")),
                "category": text(raw.get("课程类别")),
                "nature": text(raw.get("课程性质")),
                "name": course_name,
                "code": code,
                "semester_raw": text(raw.get("开课学期")),
                "remarks": text(raw.get("备注")),
                "total_credits": normalize_credits(raw.get("总学分")),
                "semesters": parse_semesters(raw.get("开课学期")),
                "course_page": course_page,
                "link_method": link_method,
                "raw_fields": raw,
                "sources": [source],
            }
            identity = json.dumps(raw, ensure_ascii=False, sort_keys=True, allow_nan=False)
        except (ValueError, InvalidOperation) as error:
            raise ValueError(f"{source['file']}:{source['row']} {error}") from error
        if identity in records:
            records[identity]["sources"].append(source)
        else:
            records[identity] = record
    ordered = sorted(records.values(), key=lambda record: (
        record["college"], record["major"], -int(record["year"]),
        course_code_sort_key(record["code"]),
        json.dumps(record["raw_fields"], ensure_ascii=False, sort_keys=True),
    ))
    for record in ordered:
        record["sources"].sort(key=lambda source: (source["file"], source["sheet"], source["row"]))
    summary: Summary = {
        "files": len(input_by_file),
        "input_rows": sum(input_by_file.values()),
        "input_rows_by_file": dict(sorted(input_by_file.items())),
        "excluded_minor_or_dual_degree": excluded,
        "retained_rows": sum(input_by_file.values()) - excluded,
        "duplicate_rows_merged": sum(input_by_file.values()) - excluded - len(ordered),
        "unique_records": len(ordered),
        "colleges": len({record["college"] for record in ordered}),
        "major_pages": len({(record["college"], record["major"]) for record in ordered}),
        "records_by_year": dict(sorted(Counter(record["year"] for record in ordered).items())),
        "records_by_category": dict(sorted(Counter(record["category"] or "未注明类别" for record in ordered).items())),
        "records_by_level": dict(sorted(Counter(record["level"] or "未注明层次" for record in ordered).items())),
        "zero_credits": sum(record["total_credits"] == "0" for record in ordered),
        "missing_credits": sum(record["total_credits"] is None for record in ordered),
        "missing_semesters": sum(not record["semesters"] for record in ordered),
        "multi_semester_records": sum(len(record["semesters"]) > 1 for record in ordered),
        "records_with_remarks": sum(record["remarks"] is not None for record in ordered),
        "link_methods": dict(sorted(Counter(record["link_method"] for record in ordered).items())),
    }
    return {"schema_version": 1, "summary": summary, "records": ordered}


def markdown_text(value: str) -> str:
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"([\\`*_{}\[\]()<>#!|~:+\-\"'])", r"\\\1", value)
    return value.replace("\n", " / ")


def code_span(value: str) -> str:
    value = value.replace("\r", " ").replace("\n", " ")
    width = max((len(run) for run in re.findall(r"`+", value)), default=0) + 1
    delimiter = "`" * width
    padding = " " if value.startswith(("`", " ")) or value.endswith(("`", " ")) else ""
    return f"{delimiter}{padding}{value}{padding}{delimiter}"


def category_sort_key(category: str) -> tuple[int, str]:
    return (CATEGORY_ORDER.index(category), "") if category in CATEGORY_ORDER else (len(CATEGORY_ORDER), category)


def render_course(record: CourseRecord) -> str:
    name = markdown_text(record["name"] or "未提供课程名称")
    if record["course_page"]:
        # 链接相对于拟替换的专业页面，而非工具目录。
        target = "../../../" + record["course_page"].lstrip("/") + ".md"
        target = "".join(quote(char, safe="/.-_~") if ord(char) < 128 else char for char in target)
        name = f"[{name}]({target})"
    multi = len(record["semesters"]) > 1
    credits = record["total_credits"] if record["total_credits"] is not None else "未提供"
    if multi:
        credits = "总学分 " + credits
    line = f"                * {name} - :l-book:{code_span(record['code'] or '未提供')} - :l-circle-arrow-up:{code_span(credits)}"
    if multi:
        semester_raw = record["semester_raw"]
        assert semester_raw is not None
        line += f" - 开课范围：{code_span(semester_raw)}（非每学期学分）"
    if record["remarks"]:
        line += f" - 备注：{markdown_text(record['remarks'])}"
    return line + "  "


def render_previews(records: Iterable[CourseRecord]) -> dict[str, str]:
    pages: defaultdict[tuple[str, str], list[CourseRecord]] = defaultdict(list)
    for record in records:
        pages[(record["college"], record["major"])].append(record)
    previews: dict[str, str] = {}
    for (college, major), courses in sorted(pages.items()):
        grouped: defaultdict[str, defaultdict[str | None, defaultdict[str, defaultdict[str, list[CourseRecord]]]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        )
        for course in courses:
            for semester in course["semesters"] or [None]:
                grouped[course["year"]][semester][course["nature"] or "未注明性质"][course["category"] or "未注明类别"].append(course)
        lines = [
            '!!! warning "本培养方案并非实时更新，如果您发现有哪些与[教务网](https://my.cqu.edu.cn)上显示的不符，请通过页面底部的「问题反馈」告知我们"',
            "", "---", "", "## 培养方案  ",
        ]
        for year in sorted(grouped, key=int, reverse=True):
            lines.append(f'=== "{year}级"  ')
            for semester in (*SEMESTER_ORDER, None):
                if semester not in grouped[year]:
                    continue
                semester_name = SEMESTER_NAMES[semester] if semester is not None else "未注明学期"
                lines.append(f'    === "{semester_name}"  ')
                natures = grouped[year][semester]
                for nature in sorted(natures, key=lambda value: ({"必修": 0, "选修": 1}.get(value, 2), value)):
                    lines.append(f'        === "{markdown_text(nature)}"  ')
                    for category in sorted(natures[nature], key=category_sort_key):
                        lines.append(f"            * {markdown_text(category)}")
                        for course in sorted(natures[nature][category], key=lambda item: (
                            course_code_sort_key(item["code"]),
                            json.dumps(item["raw_fields"], ensure_ascii=False, sort_keys=True),
                        )):
                            lines.append(render_course(course))
        previews[f"academic/专业培养方案/{college}/{major}.md"] = "\n".join(lines) + "\n"
    return previews


def build_bundle(data_dir: Path = TOOL_DIR / "data", repo_root: Path = REPO_ROOT) -> Bundle:
    data = clean_rows(read_excel_rows(data_dir), CourseLinks.from_repo(repo_root))
    return {**data, "markdown_previews": render_previews(data["records"])}


def serialize(data: object) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="只读清洗培养方案；所有输出经 stdout，不写入站点或其他文件。")
    parser.add_argument("--data-dir", type=Path, default=TOOL_DIR / "data")
    parser.add_argument("--format", choices=("summary", "json", "markdown"), default="summary",
                        help="summary 仅数量摘要；json 为结构化记录及全部 Markdown 预览；markdown 为单专业预览")
    parser.add_argument("--college", help="markdown 模式所选学院")
    parser.add_argument("--major", help="markdown 模式所选专业")
    parser.add_argument("--expect-rows", type=int, help="校验输入总行数")
    parser.add_argument("--verify-stable", action="store_true", help="重新读取全部输入，校验完整输出字节一致")
    args = parser.parse_args(argv)
    if args.format == "markdown" and (not args.college or not args.major):
        parser.error("markdown 模式需要 --college 和 --major")
    if args.format != "markdown" and (args.college or args.major):
        parser.error("--college 和 --major 仅用于 markdown 模式")
    try:
        bundle = build_bundle(args.data_dir)
        if args.expect_rows is not None and bundle["summary"]["input_rows"] != args.expect_rows:
            raise ValueError(f"输入总行数不符：预期 {args.expect_rows}，实际 {bundle['summary']['input_rows']}")
        if args.verify_stable:
            first = hashlib.sha256(serialize(bundle).encode("utf-8")).digest()
            second = hashlib.sha256(serialize(build_bundle(args.data_dir)).encode("utf-8")).digest()
            if first != second:
                raise ValueError("重复运行输出不一致")
        if args.format == "markdown":
            path = f"academic/专业培养方案/{args.college}/{args.major}.md"
            if path not in bundle["markdown_previews"]:
                raise ValueError("本次输入中没有指定专业，不读取旧方案补齐")
            output = bundle["markdown_previews"][path]
        else:
            output = serialize(bundle if args.format == "json" else bundle["summary"])
    except ValueError as error:
        parser.error(str(error))
    sys.stdout.write(output)


if __name__ == "__main__":
    main()
