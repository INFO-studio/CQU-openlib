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


def get_log_structure(base_path):
    log_structure = {}
    for root, dirs, files in os.walk(base_path):
        rel_dir = os.path.relpath(root, base_path)
        parts = rel_dir.split(os.sep)
        if len(parts) == 1 and parts != ["."]:
            year = parts[0]
            log_structure[year] = {}
        if len(parts) == 2:
            year, month = parts
            month = month.split('-')[-1]
            month = f"0{month}" if len(month) == 1 else month
            ym = '-'.join([year, month])
            log_structure[year][month] = []
            for file in files:
                if file.endswith(".md"):
                    day = file.split('.')[0].split('-')[-1]
                    ymd = '-'.join([year, month, day])
                    day_log = [year, month, day, ym, ymd, file]
                    log_structure[year][month].append(day_log)
            log_structure[year][month] = [
                get_quarter(month), *sorted(log_structure[year][month])
            ]
    return log_structure


def get_latest_log(log_structure):
    latest_log = max(day for year in log_structure
                     for month in log_structure[year]
                     for day in log_structure[year][month][1:])
    return latest_log


def update_content(file_path, new_content):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    with open(file_path, 'w', encoding='utf-8') as f:
        else_content = True
        for line in lines:
            if "updateLog.py start" in line:
                else_content = False
                f.write(line)
                f.write(new_content)
            elif "updateLog.py end" in line:
                else_content = True
                f.write(line)
            elif else_content:
                f.write(line)


def update_sundary_updateLog_index(log_structure, latest_log):
    sundary_updateLog_index_path = "docs/sundry/更新日志/index.md"
    new_content = ""
    latest_log_year, latest_log_month, latest_log_day, latest_log_ym, latest_log_ymd, latest_log_file = latest_log
    new_content += f"最新更新日志：[{latest_log_ymd}]({latest_log_year}/{latest_log_ym}/{latest_log_file})\n\n"
    for log_year in log_structure:
        new_content += f"=== \"{log_year}年\"\n"
        log_quarters = {}
        for log_month in list(log_structure[log_year].items())[::-1]:
            log_quarter = log_month[1][0]
            if log_quarter not in log_quarters:
                log_quarters[log_quarter] = []
            log_quarters[log_quarter].append(log_month[0])
        for log_quarter in sorted(log_quarters.keys(), reverse=True):
            new_content += f"    === \"{log_quarter}\"\n"
            for log_month in sorted(log_quarters[log_quarter], reverse=True):
                new_content += f"        === \"{int(log_month)}月\"\n"
                for day_log in log_structure[log_year][log_month][1:]:
                    day_log_year, day_log_month, day_log_day, day_log_ym, day_log_ymd, day_log_file = day_log
                    new_content += f"            * [{day_log_ymd}]({day_log_year}/{day_log_ym}/{day_log_file})\n"
    update_content(sundary_updateLog_index_path, new_content)


def update_main_page(latest_log):
    main_page_path = "docs/index.md"
    new_content = ""
    latest_log_year, latest_log_month, latest_log_day, latest_log_ym, latest_log_ymd, latest_log_file = latest_log
    new_content += f"    - [更新日志](sundry/更新日志/index.md) / [{latest_log_ymd}](sundry/更新日志/{latest_log_year}/{latest_log_ym}/{latest_log_file})\n"
    update_content(main_page_path, new_content)


def update_yml(log_structure):
    yml_path = "mkdocs.yml"
    new_content = ""
    for log_year in sorted(log_structure.keys()):
        new_content += f"    - {log_year}:\n"
        for log_month in sorted(log_structure[log_year].keys()):
            new_content += f"      - {log_year}-{log_month}:\n"
            for day_log in log_structure[log_year][log_month][1:]:
                day_log_year, day_log_month, day_log_day, day_log_ym, day_log_ymd, day_log_file = day_log
                new_content += f"        - {day_log_ymd}: sundry/更新日志/{day_log_year}/{day_log_ym}/{day_log_file}\n"
    update_content(yml_path, new_content)


if __name__ == "__main__":
    base_path = "docs/sundry/更新日志"
    print("-------- updateLog.py --------\n正在获取日志路径结构......", end='')
    log_structure = get_log_structure(base_path)
    print("成功\n正在获取最新日志......", end='')
    latest_log = get_latest_log(log_structure)
    print(f"成功，最新日志{latest_log[4]}\n正在更新......专栏指引", end='')
    update_sundary_updateLog_index(log_structure, latest_log)
    print("✔...主页", end='')
    update_main_page(latest_log)
    print("✔...路由", end='')
    update_yml(log_structure)
    print("✔")
