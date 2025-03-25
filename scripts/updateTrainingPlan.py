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
    EXCEL_TITLE_LINE : int = 2

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
        "非限制选修课程"
    ]

    EMPTY_COURSE_MD_CONTENT = "## 暂无数据，欢迎贡献\n!!! info \"如果您知晓本门课程需要什么教材，欢迎[填表贡献](https://forms.office.com/r/huSXS4xpuD)，您只需要告知信息，并不必要持有pdf文件\"\n\n- Github: [https://github.com/INFO-studio/CQU-openlib](https://github.com/INFO-studio/CQU-openlib)\n- 站长QQ: `2247977881`"

    return [INPUT_FOLDER, OUTPUT_FOLDER, JSON_OUTPUT_PATH, MKDOCS_YML_PATH, COURSES_FOLDER, EXCEL_TITLE_LINE, SEMESTER_MAPPING, SEMESTER_ORDER, COURSE_CATEGORY_ORDER, EMPTY_COURSE_MD_CONTENT]

INPUT_FOLDER, OUTPUT_FOLDER, JSON_OUTPUT_PATH, MKDOCS_YML_PATH, COURSES_FOLDER, EXCEL_TITLE_LINE, SEMESTER_MAPPING, SEMESTER_ORDER, COURSE_CATEGORY_ORDER, EMPTY_COURSE_MD_CONTENT = constants()

def parse_semester_field(semester_field):
    """
    解析“开课学期”字段，支持逗号分隔和区间（如 "2-7"）：
    返回对应的中文学期列表（可能有多个）。
    """
    result = set()
    # 按逗号分割
    semester_field_parts = semester_field.split(',')
    for semester_field_part in semester_field_parts:
        semester_field_part = semester_field_part.strip()
        # 区间，如 "3-4"
        if '-' in semester_field_part:
            try:
                semester_section_start, semester_section_end = semester_field_part.split('-')
                is_semester_has_s = "S" in semester_section_start
                semester_section_start, semester_section_end = int(semester_section_start.strip().strip("S")), int(semester_section_end.strip().strip("S"))
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
    # CJK统一表意文字
    if 0x4E00 <= cp <= 0x9FFF:
        return True
    # CJK基本平假名、片假名
    if 0x3040 <= cp <= 0x30FF:
        return True
    # 韩文音节
    if 0xAC00 <= cp <= 0xD7AF:
        return True
    return False

def link_encode(s):
    """
    对字符串进行%编码：
    - 中日韩文字符保持原样
    - 其他字符全部%编码（如空格变为%20）
    """
    result = []
    for ch in s:
        if is_cjk(ch):
            result.append(ch)
        else:
            result.append(urllib.parse.quote(ch, safe=''))
    return ''.join(result)

def simplify_course_name(course_name):
    """
    简化课程名称
    """
    if "英语" in course_name:
        return "英语"
    if "体育" in course_name:
        return "体育"
    if "文明经典" in course_name:
        return "文明经典系列"
    
    simplify_course_name = course_name
    simplify_course_name = re.sub(r'[\/]', '、', simplify_course_name)
    simplify_course_name = re.sub(r'（.*?）', '', simplify_course_name)
    simplify_course_name = re.sub(r'\(.*?）', '', simplify_course_name)
    simplify_course_name = re.sub(r'（.*?\)', '', simplify_course_name)
    simplify_course_name = re.sub(r'\(.*?\)', '', simplify_course_name)
    simplify_course_name = re.sub(r'[-—]\w+$', '', simplify_course_name)
    simplify_course_name = re.sub(r'[IVXLCDMⅠⅡⅢⅣⅤⅥⅦⅧⅨ0-9]*+$', '', simplify_course_name)

    simplify_course_name = simplify_course_name.strip()
    simplify_course_name = simplify_course_name.lstrip("*")
    return simplify_course_name

def normalize_credits(credits_str):
    """
    处理总学分字符串：
      - 如 "2.0" 转为 "2"（整数部分不保留小数点）
      - 否则保留小数部分
    """
    try:
        value = float(credits_str)
        if value.is_integer():
            return str(int(value))
        else:
            return str(value)
    except:
        return credits_str

def course_code_sort_key(course_code):
    """
    根据课程代码生成排序 key：
      - 去掉开头的 '*' 后，
      - 按字母和数字部分排序
    """
    code = course_code.lstrip('*')
    match = re.match(r'([A-Z]+)(\d+)', code)
    if match:
        letter, number = match.groups()
        return (letter, int(number))
    return (code, 0)

def read_xlsx_files(input_folder):
    """
    遍历 input_folder 内所有 xlsx 文件，解析数据并构建层级数据结构：
    数据结构格式：
      data = {
          "学院名": {
              "专业名": {
                  "年级": {
                      "学期名": {
                          "必修": {  # 课程性质
                              "公共基础课程": [课程条目, ...],
                              "大类基础课程": [...],
                              ...
                          },
                          "选修": { ... }
                      }
                  }
              }
          }
      }
    课程条目包含：课程名称、简化课程名称、课程代码、总学分、课程类别、课程性质
    """
    data = {}
    for filename in os.listdir(input_folder):
        if filename.endswith('.xlsx'):
            filepath = os.path.join(input_folder, filename)
            wb = openpyxl.load_workbook(filepath, data_only=True)
            sheet = wb.active
            headers = [cell.value for cell in sheet[EXCEL_TITLE_LINE]]
            header_index = {header: idx for idx, header in enumerate(headers)}
            # 遍历每一行
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
                # 忽略数据不全的行
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
                # 按学院 → 专业 → 年级 → 学期 → 课程性质 → 课程类别逐层插入数据
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
    """
    针对“形势与政策”课程进行学分调整：
      - 每个学院/专业/年级下：若存在学期为“大五上”、“大五下”或“大五下小学期”，则判定为 5 年制（学分应为 0.2），否则为 4 年制（学分应为 0.25）。
    """
    for college in data:
        for major in data[college]:
            for year in data[college][major]:
                # 判定该年级是否为 5 年制
                is_5_year = any(
                    sem in ["大五上", "大五下", "大五下小学期"]
                    for sem in data[college][major][year].keys()
                )
                for semester in data[college][major][year]:
                    for nature in ["必修", "选修"]:
                        for category in data[college][major][year][semester][nature]:
                            for course in data[college][major][year][semester][nature][category]:
                                if "形势与政策" in course["course_name"]:
                                    course["total_credits"] = "0.2" if is_5_year else "0.25"
    return data

def sort_courses_in_data(data):
    """
    对每个课程组内的课程按课程代码排序。
    """
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
    """
    将数据保存为 JSON 文件，便于后续调试查看。
    """
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def generate_markdown_files(data, output_folder):
    """
    根据解析后的数据生成 md 文件：
      - 生成目录结构： output_folder/专业培养方案/{学院名}/index.md 和 {专业名}.md
      - index.md 按模板生成专业列表
      - 每个专业的 md 文件按照“年级 → 学期 → 课程性质（必修在前） → 课程类别”的层次生成课程条目
    """
    base_folder = os.path.join(output_folder)
    os.makedirs(base_folder, exist_ok=True)
    yml_training_plan_lines = []
    yml_course_lines = []
    course_done_set = get_course_done_set(MKDOCS_YML_PATH, "courseRead")
    
    for college in data:
        yml_training_plan_lines.append(f"    - {college}:\n      - academic/专业培养方案/{college}/index.md")
        college_folder = os.path.join(base_folder, college)
        os.makedirs(college_folder, exist_ok=True)
        # 生成 index.md 文件内容
        index_lines = [
            f"# {college}",
            "下设专业：  ",
            ""
        ]
        majors = sorted(data[college].keys())
        for major in majors:
            index_lines.append(f"- [{major}]({major}.md)  ")
            yml_training_plan_lines.append(f"      - {major}: academic/专业培养方案/{college}/{major}.md")
        index_content = "\n".join(index_lines)
        index_path = os.path.join(college_folder, "index.md")
        # 如果 index.md 已存在，则读取后判断是否有新增专业
        if os.path.exists(index_path):
            with open(index_path, "r", encoding="utf-8") as f:
                existing_content = f.read()
            # 此处可根据需要添加对比逻辑，目前直接覆盖
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(index_content)
        
        # 针对每个专业生成 md 文件
        for major in majors:
            major_md_lines = []
            # 警告信息
            major_md_lines.append('!!! warning "本培养方案并非实时更新，如果您发现有哪些与[教务网](https://my.cqu.edu.cn)上显示的不符，请在最下方差评并填写反馈表单"')
            major_md_lines.append("")
            major_md_lines.append("---")
            major_md_lines.append("")
            major_md_lines.append("## 培养方案  ")
            # 年级按从大到小排序（年份为数字字符串）
            years = sorted(data[college][major].keys(), key=lambda y: int(y), reverse=True)
            for year in years:
                major_md_lines.append(f'=== "{year}级"  ')
                # 按预定顺序选取该年级中存在的学期
                semesters_in_year = data[college][major][year].keys()
                sorted_semesters = [sem for sem in SEMESTER_ORDER if sem in semesters_in_year]
                for semester in sorted_semesters:
                    major_md_lines.append(f'    === "{semester}"  ')
                    # 先输出必修，再输出选修
                    for nature in ["必修", "选修"]:
                        if nature in data[college][major][year][semester] and data[college][major][year][semester][nature]:
                            major_md_lines.append(f'        === "{nature}"  ')
                            # 按预定课程类别顺序输出
                            for category in COURSE_CATEGORY_ORDER:
                                if category in data[college][major][year][semester][nature]:
                                    courses = data[college][major][year][semester][nature][category]
                                    if courses:
                                        major_md_lines.append(f'            * {category}')
                                        for course in courses:
                                            major_md_lines.append(
                                                f'                * [{course["course_name"]}](../../../course/{course["linked_name"]}.md) - :material-book:`{course["course_code"]}` - :material-arrow-up-circle:`{course["total_credits"]}`  '
                                            )
                                            if course["linked_name"] not in course_done_set:
                                                yml_course_lines.append(f"    - {course["simplified_name"]}: course/{course["linked_name"]}.md")
                                                course_done_set.add(course["linked_name"])
                                                course_md_path = os.path.join(COURSES_FOLDER, f"{course['simplified_name']}.md")
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
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    with open(file_path, 'w', encoding='utf-8') as f:
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
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    course_done_set = set()
    with open(file_path, 'w', encoding='utf-8') as f:
        else_content = True
        for line in lines:
            if f"updateTrainingPlan.py _{pattern}_ start" in line:
                else_content = False
            elif "updateTrainingPlan.py _{pattern}_ end" in line:
                else_content = True
            elif not else_content:
                match = re.search(r'/([^/]+)\.md', line)
                if match:
                    course_done_set.add(match.group(1))
            f.write(line)
    return course_done_set

def main():
    # 解析 xlsx 文件
    data = read_xlsx_files(INPUT_FOLDER)
    # 针对形势与政策调整学分
    data = adjust_policy_courses(data)
    # 对课程按课程代码排序
    data = sort_courses_in_data(data)
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    # 保存中间 JSON 数据（方便调试查看）
    save_json(data, JSON_OUTPUT_PATH)
    # 根据数据生成 markdown 文件（含文件树结构）
    generate_markdown_files(data, OUTPUT_FOLDER)
    
if __name__ == "__main__":
    main()
