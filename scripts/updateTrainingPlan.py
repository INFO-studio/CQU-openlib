import os
import re
import json
import warnings
import openpyxl
import urllib


def constants() -> list:
    # 输入文件夹（存放所有 xlsx 文件）
    INPUT_FOLDER = os.path.join("scripts", "input")
    # 输出文件夹（生成 md 文件及中间 JSON 文件）
    OUTPUT_FOLDER = os.path.join("docs", "academic", "专业培养方案")
    # json 配置文件输出文件夹
    JSON_OUTPUT_PATH = os.path.join("scripts", "trainingPlan.json")
    # mkdocs 配置文件
    MKDOCS_YML_PATH = os.path.join("mkdocs.yml")
    # courses 文件夹
    COURSES_FOLDER = os.path.join("docs", "course")

    # Excel 文件表头所在行数
    EXCEL_TITLE_LINE: int = 2

    # 学期映射：数字和 S 开头的映射为小学期
    SEMESTER_MAPPING = {
        "1": "大一上",
        "2": "大一下",
        "3": "大二上",
        "4": "大二下",
        "5": "大三上",
        "6": "大三下",
        "7": "大四上",
        "8": "大四下",
        "9": "大五上",
        "10": "大五下",
        "11": "大六上",
        "12": "大六下",
        "S1": "小学期一",
        "S2": "小学期二",
        "S3": "小学期三",
        "S4": "小学期四",
        "S5": "小学期五",
    }

    # 生成 markdown 文件的学期顺序
    SEMESTER_ORDER = [
        "大一上",
        "大一下",
        "小学期一",
        "大二上",
        "大二下",
        "小学期二",
        "大三上",
        "大三下",
        "小学期三",
        "大四上",
        "大四下",
        "小学期四",
        "大五上",
        "大五下",
        "小学期五",
        "大六上",
        "大六下",
    ]

    # 生成 markdown 文件的课程类别顺序
    COURSE_CATEGORY_ORDER = [
        "公共基础课程",
        "大类基础课程",
        "专业基础课程",
        "专业课程",
        "实践环节",
        "通识教育课程",
        "个性化模块",
        "非限制选修课程",
    ]

    EMPTY_COURSE_MD_CONTENT = (
        "## 暂无数据，欢迎贡献\n"
        "!!! info \"如果您知晓本门课程需要什么教材，欢迎[填表贡献]"
        "(https://forms.office.com/r/huSXS4xpuD)，您只需要告知信息，并不必要持有pdf文件\"\n\n"
        "- Github: [https://github.com/INFO-studio/CQU-openlib]"
        "(https://github.com/INFO-studio/CQU-openlib)\n"
        "- 站长QQ: `2247977881`"
    )

    return [
        INPUT_FOLDER,
        OUTPUT_FOLDER,
        JSON_OUTPUT_PATH,
        MKDOCS_YML_PATH,
        COURSES_FOLDER,
        EXCEL_TITLE_LINE,
        SEMESTER_MAPPING,
        SEMESTER_ORDER,
        COURSE_CATEGORY_ORDER,
        EMPTY_COURSE_MD_CONTENT,
    ]


(
    INPUT_FOLDER,
    OUTPUT_FOLDER,
    JSON_OUTPUT_PATH,
    MKDOCS_YML_PATH,
    COURSES_FOLDER,
    EXCEL_TITLE_LINE,
    SEMESTER_MAPPING,
    SEMESTER_ORDER,
    COURSE_CATEGORY_ORDER,
    EMPTY_COURSE_MD_CONTENT,
) = constants()


def parse_semester_field(semester_field):
    """
    解析“开课学期”字段，支持逗号分隔和区间（如 "2-7"）：
    返回对应的中文学期列表（可能有多个）。
    """
    result = set()
    # 按逗号分割
    semester_field_parts = semester_field.split(",")
    for semester_field_part in semester_field_parts:
        semester_field_part = semester_field_part.strip()
        # 区间，如 "3-4"
        if "-" in semester_field_part:
            try:
                semester_section_start, semester_section_end = semester_field_part.split("-")
                is_semester_has_s = "S" in semester_section_start
                semester_section_start = int(semester_section_start.strip().strip("S"))
                semester_section_end = int(semester_section_end.strip().strip("S"))
                for semester in range(semester_section_start, semester_section_end + 1):
                    key = ("S" if is_semester_has_s else "") + str(semester)
                    if key in SEMESTER_MAPPING:
                        result.add(SEMESTER_MAPPING[key])
            except ValueError:
                warnings.warn(f"{semester_field_part} is not a semester(1-10, S1-S4)", RuntimeWarning)
        else:
            if semester_field_part in SEMESTER_MAPPING:
                result.add(SEMESTER_MAPPING[semester_field_part])
            else:
                warnings.warn(f"{semester_field_part} is not a semester(1-10, S1-S4)", RuntimeWarning)
    return list(result)


def is_cjk(char):
    cp = ord(char)
    if 0x3400 <= cp <= 0x4DBF or 0x4E00 <= cp <= 0x9FFF:
        return True
    if 0x3040 <= cp <= 0x30FF:
        return True
    if 0xAC00 <= cp <= 0xD7AF:
        return True
    if 0xF900 <= cp <= 0xFAFF:
        return True
    if 0x3000 <= cp <= 0x303F:
        return True
    return False


def link_encode(s):
    """
    保留：如需 URL 编码可用，但本脚本不再用它作为去重 key。
    """
    result = []
    for ch in s:
        if is_cjk(ch):
            result.append(ch)
        else:
            result.append(urllib.parse.quote(ch, safe=""))
    return "".join(result)


def simplify_course_name(course_name):
    """
    简化课程名称（用于文件名、去重、yml、链接）。
    """
    if "英语" in course_name:
        return "英语"
    if "体育" in course_name:
        return "体育"
    if "文明经典" in course_name:
        return "文明经典系列"
    if ("Fourier分析" in course_name) or ("fourier分析" in course_name):
        return "Fourier分析"

    s = course_name
    s = re.sub(r"[\/]", "、", s)
    s = re.sub(r"（.*?）", "", s)
    s = re.sub(r"\(.*?）", "", s)
    s = re.sub(r"（.*?\)", "", s)
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[-—]\w+$", "", s)
    s = re.sub(r"[IVXLCDMⅠⅡⅢⅣⅤⅥⅦⅧⅨ0-9]*+$", "", s)
    s = s.strip()
    s = s.lstrip("*")
    return s


def normalize_credits(credits_str):
    try:
        value = float(credits_str)
        return str(int(value)) if value.is_integer() else str(value)
    except Exception:
        return credits_str


def course_code_sort_key(course_code):
    code = course_code.lstrip("*")
    match = re.match(r"([A-Z]+)(\d+)", code)
    if match:
        letter, number = match.groups()
        return (letter, int(number))
    return (code, 0)


def read_xlsx_files(input_folder):
    data = {}
    for filename in os.listdir(input_folder):
        if filename.endswith(".xlsx"):
            filepath = os.path.join(input_folder, filename)
            wb = openpyxl.load_workbook(filepath, data_only=True)
            sheet = wb.active
            headers = [cell.value for cell in sheet[EXCEL_TITLE_LINE]]
            header_index = {header: idx for idx, header in enumerate(headers)}
            for row in sheet.iter_rows(min_row=EXCEL_TITLE_LINE + 1, values_only=True):
                college = row[header_index["学院"]]
                major = row[header_index["专业"]]
                year = row[header_index["年级"]]
                course_category = row[header_index["课程类别"]]
                course_nature = row[header_index["课程性质"]]
                course_name = row[header_index["课程名称"]]
                course_code = row[header_index["课程代码"]]
                total_credits = row[header_index["总学分"]]
                term_field = row[header_index["开课学期"]]
                if "辅修" in major or "双学位" in major:
                    raise RuntimeError(f"文件异常：检测到 {offending}，请筛选主修后再操作")
                if not all([college, major, year, course_category, course_nature, course_name, course_code, total_credits, term_field]):
                    continue
                total_credits = normalize_credits(str(total_credits))
                semesters = parse_semester_field(str(term_field))
                simplified_name = simplify_course_name(course_name)
                linked_name = link_encode(simplified_name)
                course_entry = {
                    "course_name": course_name,
                    "simplified_name": simplified_name,
                    "linked_name": linked_name,
                    "course_code": course_code,
                    "total_credits": total_credits,
                    "course_category": course_category,
                    "course_nature": course_nature,
                }
                data.setdefault(college, {})
                data[college].setdefault(major, {})
                data[college][major].setdefault(str(year), {})
                for semester in semesters:
                    data[college][major][str(year)].setdefault(semester, {"必修": {}, "选修": {}})
                    nature_dict = data[college][major][str(year)][semester][course_nature]
                    nature_dict.setdefault(course_category, [])
                    nature_dict[course_category].append(course_entry)
    return data


def adjust_policy_courses(data):
    for college in data:
        for major in data[college]:
            for year in data[college][major]:
                is_5_year = any(sem in ["小学期四", "大五上", "大五下"] for sem in data[college][major][year].keys())
                for semester in data[college][major][year]:
                    for nature in ["必修", "选修"]:
                        for category in data[college][major][year][semester][nature]:
                            for course in data[college][major][year][semester][nature][category]:
                                if "形势与政策" in course["course_name"]:
                                    course["total_credits"] = "0.2" if is_5_year else "0.25"
    return data


def sort_courses_in_data(data):
    for college in data:
        for major in data[college]:
            for year in data[college][major]:
                for semester in data[college][major][year]:
                    for nature in ["必修", "选修"]:
                        for category in data[college][major][year][semester][nature]:
                            data[college][major][year][semester][nature][category].sort(
                                key=lambda x: course_code_sort_key(x["course_code"])
                            )
    return data


def save_json(data, json_path):
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def generate_markdown_files(data, output_folder):
    """
    统一以 simplified_name 为 key：
      - mkdocs.yml 中的路径使用 simplified_name
      - 去重集合使用 simplified_name
      - 课程 md 文件名使用 simplified_name
      - 页面内链接使用 simplified_name，并用 <...> 包裹以兼容空格
    """
    base_folder = os.path.join(output_folder)
    os.makedirs(base_folder, exist_ok=True)
    yml_training_plan_lines = []
    yml_course_lines = []
    course_done_set = get_course_done_set(MKDOCS_YML_PATH, "courseRead")  # 返回 simplified_name 集合

    for college in data:
        college_folder = os.path.join(base_folder, college)
        os.makedirs(college_folder, exist_ok=True)

        majors = sorted(data[college].keys())

        # 先写导航（院系+index）
        yml_training_plan_lines.append(f"    - {college}:\n      - academic/专业培养方案/{college}/index.md")

        # 生成 index.md
        index_lines = [f"# {college}", "下设专业：  ", ""]
        for major in majors:
            index_lines.append(f"- [{major}]({major}.md)  ")
            yml_training_plan_lines.append(f"      - {major}: academic/专业培养方案/{college}/{major}.md")
        index_content = "\n".join(index_lines)
        index_path = os.path.join(college_folder, "index.md")
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(index_content)

        # 生成每个专业页面
        for major in majors:
            major_md_lines = []
            major_md_lines.append(
                '!!! warning "本培养方案并非实时更新，如果您发现有哪些与[教务网](https://my.cqu.edu.cn)上显示的不符，请在最下方差评并填写反馈表单"'
            )
            major_md_lines.append("")
            major_md_lines.append("---")
            major_md_lines.append("")
            major_md_lines.append("## 培养方案  ")

            years = sorted(data[college][major].keys(), key=lambda y: int(y), reverse=True)
            for year in years:
                major_md_lines.append(f'=== "{year}级"  ')
                semesters_in_year = data[college][major][year].keys()
                sorted_semesters = [sem for sem in SEMESTER_ORDER if sem in semesters_in_year]
                for semester in sorted_semesters:
                    major_md_lines.append(f'    === "{semester}"  ')
                    for nature in ["必修", "选修"]:
                        if nature in data[college][major][year][semester] and data[college][major][year][semester][nature]:
                            major_md_lines.append(f'        === "{nature}"  ')
                            for category in COURSE_CATEGORY_ORDER:
                                if category in data[college][major][year][semester][nature]:
                                    courses = data[college][major][year][semester][nature][category]
                                    if courses:
                                        major_md_lines.append(f"            * {category}")
                                        for course in courses:
                                            major_md_lines.append(
                                                f'                * [{course["course_name"]}](../../../course/{course["linked_name"]}.md) - '
                                                f':material-book:`{course["course_code"]}` - :material-arrow-up-circle:`{course["total_credits"]}`  '
                                            )
                                            # 去重
                                            if course["simplified_name"] not in course_done_set:
                                                yml_course_lines.append(
                                                    f"    - {course['simplified_name']}: course/{course['simplified_name']}.md"
                                                )
                                                course_done_set.add(course["simplified_name"])

                                                course_md_path = os.path.join(
                                                    COURSES_FOLDER, f"{course['simplified_name']}.md"
                                                )
                                                # 存在且非空则跳过写入
                                                if not (os.path.exists(course_md_path) and os.path.getsize(course_md_path) > 0):
                                                    with open(course_md_path, "w", encoding="utf-8") as f:
                                                        f.write(EMPTY_COURSE_MD_CONTENT)

            major_md_content = "\n".join(major_md_lines)
            major_md_path = os.path.join(college_folder, f"{major}.md")
            with open(major_md_path, "w", encoding="utf-8") as f:
                f.write(major_md_content)

    yml_training_plan_content = "\n".join(yml_training_plan_lines) + "\n"
    yml_course_lines.sort()
    yml_course_content = "\n".join(yml_course_lines) + "\n"
    update_content(MKDOCS_YML_PATH, yml_training_plan_content, "trainingPlan")
    update_content(MKDOCS_YML_PATH, yml_course_content, "courseWrite")


def update_content(file_path, new_content, pattern):
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    with open(file_path, "w", encoding="utf-8") as f:
        else_content = True
        for line in lines:
            if f"updateTrainingPlan.py _{pattern}_ start" in line:
                else_content = False
                f.write(line)
                f.write(new_content)
            elif f"updateTrainingPlan.py _{pattern}_ end" in line:
                else_content = True
                f.write(line)
            elif else_content:
                f.write(line)


def get_course_done_set(file_path, pattern):
    """
    读取 mkdocs.yml 里已有的课程，返回 simplified_name 集合。
    兼容历史上可能出现过的 URL 编码（%20）：统一解码为带空格的名字，以 simplified_name 为准。
    """
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    course_done_set = set()
    with open(file_path, "w", encoding="utf-8") as f:
        else_content = True
        for line in lines:
            if f"updateTrainingPlan.py _{pattern}_ start" in line:
                else_content = False
            elif f"updateTrainingPlan.py _{pattern}_ end" in line:
                else_content = True
            elif not else_content:
                match = re.search(r"/([^/]+)\.md", line)
                if match:
                    # 统一 decode，保证集合里都是 simplified_name（带空格）
                    name = urllib.parse.unquote(match.group(1))
                    course_done_set.add(name)
            f.write(line)
    return course_done_set


def main():
    # （可选）忽略 openpyxl 默认样式警告
    warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

    data = read_xlsx_files(INPUT_FOLDER)
    data = adjust_policy_courses(data)
    data = sort_courses_in_data(data)
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    save_json(data, JSON_OUTPUT_PATH)
    generate_markdown_files(data, OUTPUT_FOLDER)


if __name__ == "__main__":
    main()
