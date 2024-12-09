import os

def get_quarter(month):
    quarter_map = {
        "01": "第一季度",
        "02": "第一季度",
        "03": "第一季度",
        "04": "第二季度",
        "05": "第二季度",
        "06": "第二季度",
        "07": "第三季度",
        "08": "第三季度",
        "09": "第三季度",
        "10": "第四季度",
        "11": "第四季度",
        "12": "第四季度"
    }
    return quarter_map[month]

def read_log_structure(base_path):
    log_structure = {}
    for root, dirs, files in os.walk(base_path):
        rel_dir = os.path.relpath(root, base_path)
        parts = rel_dir.split(os.sep)
        if len(parts) == 2:
            year, month = parts
            month = month.split('-')[-1]  # 确保只获取月份部分
            if len(month) == 1:
                month = f"0{month}"  # 确保月份是两位数
            if year not in log_structure:
                log_structure[year] = {}
            if month not in log_structure[year]:
                log_structure[year][month] = []
            for file in files:
                if file.endswith(".md"):
                    log_structure[year][month].append(file)
    return log_structure

def update_a_md(log_structure, a_md_path):
    latest_update = max(
        (f"{year}-{month}-{day.split('-')[-1].split('.')[0]}" for year in log_structure for month in log_structure[year] for day in log_structure[year][month]),
        key=lambda date: tuple(map(int, date.split('-')))
    )

    year, month, day = latest_update.split('-')
    new_content = f"# 更新日志\n\n前期更新并未有完整日志，本栏自[2024-09-01](2024/2024-09/2024-09-01.md)起开始记录\n\n最新更新日志：[{latest_update}]({year}/{year}-{month}/{latest_update}.md)\n\n"

    for year in sorted(log_structure.keys(), reverse=True):
        new_content += f"=== \"{year}年\"\n"
        quarters = {}
        for month in sorted(log_structure[year].keys(), reverse=True):
            quarter = get_quarter(month)
            if quarter not in quarters:
                quarters[quarter] = []
            quarters[quarter].append(month)
        
        for quarter in sorted(quarters.keys(), reverse=True):
            new_content += f"    === \"{quarter}\"\n"
            for month in sorted(quarters[quarter], reverse=True):
                new_content += f"        === \"{int(month)}月\"\n"
                for day in sorted(log_structure[year][month]):
                    date = f"{year}-{month}-{day.split('-')[-1].split('.')[0]}"
                    new_content += f"            * [{date}]({year}/{year}-{month}/{date}.md)\n"

    with open(a_md_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return latest_update

def update_log_index():
    base_path = "docs/sundry/更新日志"
    a_md_path = "docs/sundry/更新日志/index.md"
    log_structure = read_log_structure(base_path)
    latest_update = update_a_md(log_structure, a_md_path)
    return latest_update, log_structure

def update_main_page():
    latest_update, _ = update_log_index()
    year, month, day = latest_update.split('-')
    latest_update_link = f"sundry/更新日志/{year}/{year}-{month}/{latest_update}.md"
    main_page_path = "docs/index.md"
    print(f"最新更新日志：[{latest_update}]({latest_update_link})")
    with open(main_page_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    with open(main_page_path, 'w', encoding='utf-8') as f:
        for line in lines:
            if line.startswith("    - [更新日志](sundry/更新日志/index.md)"):
                line = f"    - [更新日志](sundry/更新日志/index.md) / [{latest_update}]({latest_update_link})\n"
            f.write(line)

def update_yml():
    _, log_structure = update_log_index()
    yml_path = "mkdocs.yml"
    
    with open(yml_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_nav = []
    for year in sorted(log_structure.keys()):
        year_entry = f"    - {year}:\n"
        for month in sorted(log_structure[year].keys()):
            month_entry = f"      - {year}-{month}:\n"
            for day in sorted(log_structure[year][month]):
                date = f"{year}-{month}-{day.split('-')[-1].split('.')[0]}"
                month_entry += f"        - {date}: sundry/更新日志/{year}/{year}-{month}/{date}.md\n"
            year_entry += month_entry
        new_nav.append(year_entry)
    
    new_nav_str = ''.join(new_nav)
    
    with open(yml_path, 'w', encoding='utf-8') as f:
        in_nav = False
        for line in lines:
            if line.strip() == "- 更新日志:":
                in_nav = True
                f.write(line)
                f.write("    - sundry/更新日志/index.md\n")
                f.write(new_nav_str)
            elif in_nav and line.startswith("  - "):
                in_nav = False
                f.write(line)
            elif not in_nav:
                f.write(line)

if __name__ == "__main__":
    update_log_index()
    update_main_page()
    update_yml()