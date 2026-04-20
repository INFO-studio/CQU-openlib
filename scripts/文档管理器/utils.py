"""
工具函数模块
"""

import re
from typing import Optional, Tuple, Union
from config import PATTERNS, API_URL_TEMPLATE


def extract_lanzou_key(key_input: str) -> Optional[str]:
    """
    从蓝奏云链接或密钥输入中提取12位密钥
    支持格式：
    - lanzou.com/abc123def456
    - lanzoux.com/abc123def456
    - http://api.cqu-openlib.cn/file?key=abc123def456
    - 纯12位密钥
    """
    if not key_input:
        return None

    url_match = re.search(r"lanzou[a-z]?\.com/([A-Za-z0-9]{12})", key_input)
    if url_match:
        return url_match.group(1)

    query_match = re.search(r"key=([A-Za-z0-9]{12})", key_input)
    if query_match:
        return query_match.group(1)

    if re.fullmatch(r"[A-Za-z0-9]{12}", key_input):
        return key_input

    return None


def build_api_url(key: str) -> str:
    """构建API URL"""
    return API_URL_TEMPLATE.format(key=key)


def parse_composite_info(composite: str) -> Tuple[str, str, str, Optional[str]]:
    """
    解析教材信息字符串
    格式: 教材([上/下]册)-教材名-主编首位-出版社
    返回: (textbook_name, editor_first, publisher, volume)
    """
    composite = composite.strip()
    volume = None

    m = re.match(r"^教材([上下]册)-(.+)$", composite)
    if m:
        volume = m.group(1).strip()
        rest = m.group(2)
    else:
        if composite.startswith("教材-"):
            rest = composite[len("教材-") :]
        else:
            rest = composite

    parts = [p.strip() for p in rest.split("-")]
    if len(parts) < 3:
        return "", "", "", volume

    textbook_name = parts[0]
    editor_first = parts[1]
    publisher = "-".join(parts[2:])

    return textbook_name, editor_first, publisher, volume


def parse_list_item(line: str) -> Optional[Tuple[int, str]]:
    """
    解析列表项，返回缩进级别和内容
    返回: (indent_level, content) 或 None
    """
    m = re.match(r"^(\s*)\*\s+(.+)$", line)
    if m:
        spaces = len(m.group(1))
        indent_level = spaces // 4
        return indent_level, m.group(2)
    return None


def parse_contributor(text: str) -> Optional[Tuple[str, Optional[str]]]:
    """
    解析贡献者信息
    格式: @贡献者 或 @[贡献者](链接)
    返回: (name, url) 或 None
    """
    m = re.search(r"@\[?([^\]\s@]+)\]?(?:\(([^)]+)\))?", text)
    if m:
        return m.group(1), m.group(2)
    return None


def parse_calendar(text: str) -> Optional[str]:
    """解析学期/日期标签"""
    m = re.search(r":material-calendar:`([^`]+)`", text)
    return m.group(1) if m else None


def parse_tag(text: str) -> Optional[str]:
    """解析标签"""
    m = re.search(r":material-tag:`([^`]+)`", text)
    return m.group(1) if m else None


def extract_link_info(text: str) -> Optional[Tuple[str, str]]:
    """
    从文本中提取链接信息
    返回: (显示文本, URL) 或 None
    """
    m = re.search(r"\[([^\]]+)\]\(([^)]+)\)", text)
    if m:
        return m.group(1), m.group(2)
    return None


def count_leading_spaces(line: str) -> int:
    """计算行首空格数"""
    count = 0
    for char in line:
        if char == " ":
            count += 1
        elif char == "\t":
            count += 4
        else:
            break
    return count


def is_empty_or_whitespace(line: str) -> bool:
    """检查是否为空行或纯空白行"""
    return line.strip() == ""


def validate_course_code(code: str) -> bool:
    """验证课程编号格式"""
    return bool(re.match(PATTERNS["course_code"], code))


def normalize_course_code(code: str) -> str:
    """规范化课程编号（去除可能的前缀星号）"""
    return code.lstrip("*")
