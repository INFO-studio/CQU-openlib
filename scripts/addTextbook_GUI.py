import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import re
import os
from datetime import datetime
import threading
from pathlib import Path


class TextbookEntry:
    """教材条目类"""
    def __init__(self, volume, api_url, textbook_name, editor_first, publisher):
        self.volume = volume  # 类型/册数（如“教材上册”、“试卷”等）
        self.api_url = api_url  # API链接
        self.textbook_name = textbook_name  # 教材名称
        self.editor_first = editor_first  # 主编
        self.publisher = publisher  # 出版社
        self.sub_entries = []  # 子条目列表

    def to_markdown(self, indent="    "):
        """转换为Markdown格式，仅在字段非空时显示对应部分"""
        parts = []

        # 链接部分（必有）
        if self.api_url:
            display_text = self.volume if self.volume else "教材"
            parts.append(f"[{display_text}]({self.api_url})")
        else:
            parts.append(self.textbook_name or "未知条目")

        # 教材名称（如果非空）
        if self.textbook_name and self.textbook_name.strip():
            parts.append(f":material-format-quote-open:`{self.textbook_name}`")

        # 主编（如果非空）
        if self.editor_first and self.editor_first.strip():
            parts.append(f":material-account:`{self.editor_first}`")

        # 出版社（如果非空）
        if self.publisher and self.publisher.strip():
            parts.append(f":material-printer:`{self.publisher}`")

        # 拼接所有非空部分
        result = f"{indent}* {' - '.join(parts)}  \n"

        # 子条目
        for sub_entry in self.sub_entries:
            result += sub_entry.to_markdown(indent + "    ")

        return result

    def clone(self):
        """创建当前条目的副本"""
        new_entry = TextbookEntry(
            self.volume, 
            self.api_url, 
            self.textbook_name, 
            self.editor_first, 
            self.publisher
        )
        for sub_entry in self.sub_entries:
            new_sub_entry = TextbookSubEntry(
                sub_entry.title, 
                sub_entry.api_url, 
                sub_entry.order_index
            )
            new_entry.sub_entries.append(new_sub_entry)
        return new_entry


class TextbookSubEntry:
    """教材子条目类"""
    def __init__(self, title, api_url, order_index):
        self.title = title  # 标题
        self.api_url = api_url  # API链接
        self.order_index = order_index  # 排序索引
    
    def to_markdown(self, indent="        "):
        """转换为Markdown格式"""
        return f"{indent}* [{self.title}]({self.api_url})  \n"

    def clone(self):
        """创建当前子条目的副本"""
        return TextbookSubEntry(self.title, self.api_url, self.order_index)


class TextbookManagerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("CQU-Openlib教材文档管理系统 v1.2")
        self.root.geometry("1200x800")
        
        self.courses = {}
        self.course_codes = []
        self.current_course_name = ""
        self.current_course_code = ""
        self.textbook_entries = []
        self.file_path = ""
        self.file_content = []
        
        # 剪贴板用于存储复制的条目
        self.clipboard = None
        
        self.setup_ui()
        self.load_courses()
    
    def setup_ui(self):
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        left_frame = ttk.LabelFrame(main_frame, text="课程选择", padding=10)
        left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        
        ttk.Label(left_frame, text="课程名称:").pack(anchor=tk.W)
        self.course_entry = ttk.Entry(left_frame, width=30)
        self.course_entry.pack(fill=tk.X, pady=2)
        self.course_entry.bind('<KeyRelease>', self.on_course_search)
        
        ttk.Label(left_frame, text="匹配的课程:").pack(anchor=tk.W, pady=(10, 0))
        self.course_listbox = tk.Listbox(left_frame, height=8)
        self.course_listbox.pack(fill=tk.X, pady=2)
        self.course_listbox.bind('<<ListboxSelect>>', self.on_course_select)
        
        ttk.Button(left_frame, text="显示所有课程", command=self.show_all_courses).pack(fill=tk.X, pady=2)
        
        ttk.Label(left_frame, text="课程编号:").pack(anchor=tk.W, pady=(10, 0))
        self.code_listbox = tk.Listbox(left_frame, height=6)
        self.code_listbox.pack(fill=tk.X, pady=2)
        self.code_listbox.bind('<<ListboxSelect>>', self.on_code_select)
        
        # 添加"添加课程号"按钮
        ttk.Button(left_frame, text="添加课程号", command=self.add_course_code).pack(fill=tk.X, pady=(5, 0))
        
        right_frame = ttk.Frame(main_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        info_frame = ttk.LabelFrame(right_frame, text="当前选择", padding=5)
        info_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.info_label = ttk.Label(info_frame, text="请选择课程和编号")
        self.info_label.pack(anchor=tk.W)
        
        button_frame = ttk.Frame(right_frame)
        button_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(button_frame, text="添加主教材", command=self.add_main_textbook).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="添加子条目", command=self.add_sub_entry).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="编辑", command=self.edit_entry).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="删除", command=self.delete_entry).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="上移", command=self.move_up).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="下移", command=self.move_down).pack(side=tk.LEFT, padx=(0, 5))
        
        # 添加复制和粘贴按钮
        ttk.Button(button_frame, text="复制条目", command=self.copy_entry).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="粘贴条目", command=self.paste_entry).pack(side=tk.LEFT, padx=(0, 5))
        
        ttk.Button(button_frame, text="保存", command=self.save_changes).pack(side=tk.LEFT, padx=(0, 5))
        
        list_frame = ttk.LabelFrame(right_frame, text="教材列表", padding=5)
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ("type", "name", "editor", "publisher")
        self.tree = ttk.Treeview(list_frame, columns=columns, show="tree headings", height=20)
        
        self.tree.heading("#0", text="序号")
        self.tree.heading("type", text="类型")
        self.tree.heading("name", text="名称")
        self.tree.heading("editor", text="主编")
        self.tree.heading("publisher", text="出版社")
        
        self.tree.column("#0", width=80)
        self.tree.column("type", width=100)
        self.tree.column("name", width=300)
        self.tree.column("editor", width=150)
        self.tree.column("publisher", width=200)
        
        tree_scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=tree_scrollbar.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tree_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def add_course_code(self):
        """添加新的课程号"""
        if not self.current_course_name:
            messagebox.showwarning("警告", "请先选择一个课程")
            return
        
        # 创建对话框让用户输入新的课程号
        dialog = tk.Toplevel(self.root)
        dialog.title("添加课程号")
        dialog.geometry("300x150")
        dialog.transient(self.root)
        dialog.grab_set()
        
        frame = ttk.Frame(dialog, padding=20)
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="请输入新的课程号:").pack(anchor=tk.W, pady=(0, 10))
        course_code_var = tk.StringVar()
        course_code_entry = ttk.Entry(frame, textvariable=course_code_var, width=30)
        course_code_entry.pack(fill=tk.X, pady=(0, 20))
        course_code_entry.focus()
        
        def add_code():
            new_code = course_code_var.get().strip()
            if not new_code:
                messagebox.showwarning("警告", "课程号不能为空")
                return
            
            # 检查是否已存在
            if new_code in self.courses[self.current_course_name]['codes']:
                messagebox.showwarning("警告", "该课程号已存在")
                return
            
            # 添加到课程号列表
            self.courses[self.current_course_name]['codes'].append(new_code)
            
            # 更新界面
            self.code_listbox.insert(tk.END, new_code)
            
            # 保存到文件
            self.save_course_codes()
            
            messagebox.showinfo("成功", f"课程号 '{new_code}' 已添加")
            dialog.destroy()
        
        button_frame = ttk.Frame(frame)
        button_frame.pack(fill=tk.X)
        ttk.Button(button_frame, text="确定", command=add_code).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=(0, 5))
        
        # 绑定回车键
        course_code_entry.bind('<Return>', lambda e: add_code())
        
        dialog.wait_window()

    def save_course_codes(self):
        """保存课程号到文件 - 修改为在文件末尾添加新课程号"""
        if not self.current_course_name:
            return
        
        try:
            filename = self.courses[self.current_course_name]['filename']
            
            # 读取文件内容
            with open(filename, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 获取最新的课程号（即刚添加的那个）
            latest_code = self.courses[self.current_course_name]['codes'][-1]
            
            # 构建新的课程号行
            new_course_line = f'=== ":material-book:`{latest_code}`"\n'
            
            # 在文件末尾添加新课程号
            if not content.endswith('\n'):
                content += '\n'
            content += new_course_line
            
            # 写回文件
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(content)
                
            # 重新加载课程数据以确保一致性
            self.load_courses()
            
        except Exception as e:
            messagebox.showerror("错误", f"保存课程号时出错: {str(e)}")

    def load_courses(self):
        try:
            print("开始加载课程数据...")
            script_dir = Path(__file__).parent.resolve()
            print(f"脚本所在目录: {script_dir}")
            
            possible_dirs = [
                script_dir / "../docs/course",
                script_dir / "../../docs/course",
                script_dir / "../course",
                script_dir / "docs/course",
                script_dir,
            ]
            
            course_dir = None
            for dir_path in possible_dirs:
                resolved_path = dir_path.resolve()
                print(f"检查目录: {resolved_path}")
                
                if resolved_path.exists() and resolved_path.is_dir():
                    md_files = list(resolved_path.glob("*.md"))
                    print(f"  - 目录存在，包含 {len(md_files)} 个 .md 文件")
                    if md_files:
                        course_dir = resolved_path
                        print(f"✓ 找到课程目录: {course_dir}")
                        break
                    else:
                        try:
                            contents = list(resolved_path.iterdir())
                            print(f"  - 目录内容: {[item.name for item in contents[:10]]}")
                        except:
                            pass
                else:
                    print(f"  - 目录不存在")
            
            if course_dir is None:
                print("❌ 未找到包含.md文件的课程目录")
                return
            
            md_files = list(course_dir.glob("*.md"))
            print(f"开始解析 {len(md_files)} 个文件...")
            
            for file_path in md_files:
                print(f"正在解析文件: {file_path.name}")
                self.parse_course_file(file_path)
            
            print(f"加载完成，共找到 {len(self.courses)} 个课程:")
            for course_name, data in self.courses.items():
                print(f"  - {course_name}: {data['codes']}")
                
            if self.courses:
                print("\n✅ 已成功加载以下课程:")
                for name, data in self.courses.items():
                    print(f"  • {name} -> {data['codes']}")
            else:
                print("\n❌ 未加载到任何课程，请检查 docs/course/ 目录及文件格式。")
                
        except Exception as e:
            print(f"加载课程数据时出错: {str(e)}")
            import traceback
            traceback.print_exc()
            messagebox.showerror("错误", f"加载课程数据时出错: {str(e)}")

    def parse_course_file(self, file_path):
        try:
            if isinstance(file_path, str):
                file_path = Path(file_path)
            
            encodings = ['utf-8', 'gbk', 'utf-8-sig']
            content = None
            
            for encoding in encodings:
                try:
                    content = file_path.read_text(encoding=encoding)
                    print(f"成功使用 {encoding} 编码读取文件 {file_path}")
                    break
                except UnicodeDecodeError:
                    continue
            
            if content is None:
                print(f"无法读取文件 {file_path}，尝试了所有编码")
                return
            
            course_name = file_path.stem
            pattern = r'=== ":material-book:`([^`]+)`"'
            course_codes = re.findall(pattern, content)
            
            print(f"文件 {file_path.name}:")
            print(f"  - 文件大小: {len(content)} 字符")
            print(f"  - 包含 '=== \":material-book:' 的行数: {content.count('=== \":material-book:')}") 
            print(f"  - 找到课程编号: {course_codes}")
            
            if not course_codes:
                alt_pattern = r':material-book:`([^`]+)`'
                course_codes = re.findall(alt_pattern, content)
                print(f"  - 使用备用模式找到: {course_codes}")
            
            if not course_codes:
                print(f"  - 未找到课程编号，将添加'无课程号'选项")
                course_codes = ["无课程号"]  # ← 关键修复！
            
            if course_codes:
                self.courses[course_name] = {
                    'filename': str(file_path),
                    'codes': course_codes
                }
                print(f"✅ 添加课程: {course_name} -> 编号: {course_codes}")
                
        except Exception as e:
            print(f"❌ 解析文件 {file_path} 时出错: {str(e)}")
            import traceback
            traceback.print_exc()

    def show_all_courses(self):
        self.course_listbox.delete(0, tk.END)
        for course_name in self.courses.keys():
            self.course_listbox.insert(tk.END, course_name)

    def on_course_search(self, event):
        search_text = self.course_entry.get().lower()
        print(f"搜索文本: '{search_text}'")
        
        self.course_listbox.delete(0, tk.END)
        
        if search_text:
            matched_courses = []
            for course_name in self.courses.keys():
                if search_text in course_name.lower():
                    matched_courses.append(course_name)
                    self.course_listbox.insert(tk.END, course_name)
            print(f"匹配到的课程: {matched_courses}")
        else:
            for course_name in self.courses.keys():
                self.course_listbox.insert(tk.END, course_name)
            print("显示所有课程")

    def on_course_select(self, event):
        selection = self.course_listbox.curselection()
        if selection:
            self.current_course_name = self.course_listbox.get(selection[0])
            self.course_codes = self.courses[self.current_course_name]['codes']
            self.code_listbox.delete(0, tk.END)
            for code in self.course_codes:
                self.code_listbox.insert(tk.END, code)

    def on_code_select(self, event):
        selection = self.code_listbox.curselection()
        if selection:
            self.current_course_code = self.code_listbox.get(selection[0])
            self.update_info_label()
            self.load_textbooks()

    def update_info_label(self):
        if self.current_course_name and self.current_course_code:
            self.info_label.config(text=f"课程: {self.current_course_name} | 编号: {self.current_course_code}")
        else:
            self.info_label.config(text="请选择课程和编号")

    def load_textbooks(self):
        if not self.current_course_name or not self.current_course_code:
            return
        
        try:
            filename = self.courses[self.current_course_name]['filename']
            self.file_path = filename
            
            with open(filename, 'r', encoding='utf-8') as f:
                self.file_content = f.readlines()
            
            start_index, end_index = self.find_course_section()
            if start_index != -1:
                self.parse_textbook_entries(start_index, end_index)
                self.update_tree_view()
            else:
                self.textbook_entries = []
                self.update_tree_view()
                
        except Exception as e:
            messagebox.showerror("错误", f"加载教材数据时出错: {str(e)}")

    def find_course_section(self):
        if self.current_course_code == "无课程号":
            # 读取整个文件，直到遇到 ## 章节标题
            start_index = 0
            end_index = len(self.file_content)
            for i, line in enumerate(self.file_content):
                if line.strip().startswith('## ') and i > 0:
                    end_index = i
                    break
            return start_index, end_index
        
        target_pattern = f'=== ":material-book:`{self.current_course_code}`"'
        start_index = -1
        end_index = len(self.file_content)
        
        for i, line in enumerate(self.file_content):
            if target_pattern in line:
                start_index = i + 1
                break
        
        if start_index == -1:
            return -1, -1
        
        for i in range(start_index, len(self.file_content)):
            line = self.file_content[i]
            if '=== ":material-book:`' in line and self.current_course_code not in line:
                end_index = i
                break
            if line.strip().startswith('## ') and i > start_index:
                end_index = i
                break
        
        return start_index, end_index

    def extract_volume(self, title):
        """从标题中提取册数信息"""
        # 尝试匹配各种可能的册数表示
        patterns = [
            r'教材(上|中|下)册',
            r'(上|中|下)册教材',
            r'(上|中|下)册',
            r'第(一|二|三|四|五|六|七|八|九|十)册',
            r'第(\d+)册',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, title)
            if match:
                # 如果匹配的是(上|中|下)等，需要构建完整的册数表示
                if len(match.groups()) > 0 and match.group(1):
                    if match.group(1) in ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']:
                        return f"第{match.group(1)}册"
                    elif match.group(1).isdigit():
                        return f"第{match.group(1)}册"
                    return match.group(1) + "册"
                # 否则直接返回匹配的整个字符串
                return match.group(0)
        
        return ""

    def parse_textbook_entries(self, start_index, end_index):
        self.textbook_entries = []
        current_main_entry = None
        
        for i in range(start_index, end_index):
            line = self.file_content[i].rstrip()
            
            if not line.strip():
                continue
            
            leading_spaces = len(line) - len(line.lstrip())
            
            if leading_spaces == 4 and line.strip().startswith('*'):
                link_match = re.search(r'\*\s*\[([^\]]+)\]\s*\(\s*([^)]+)\s*\)', line)
                if link_match:
                    title = link_match.group(1)
                    api_url = link_match.group(2)
                    
                    has_textbook_fields = (':material-format-quote-open:' in line or
                                         ':material-account:' in line or
                                         ':material-printer:' in line)
                    
                    if has_textbook_fields:
                        volume = self.extract_volume(title)
                        textbook_name, editor_first, publisher = self.extract_textbook_info(line)
                        current_main_entry = TextbookEntry(volume, api_url, textbook_name, editor_first, publisher)
                        print(f"✅ 解析教材: {textbook_name} | {editor_first} | {publisher} | 册数: {volume} | 标题: {title}")
                    else:
                        current_main_entry = TextbookEntry("", api_url, title, "", "")
                        print(f"⚠️ 非教材条目: {title} | URL: {api_url}")
                    
                    self.textbook_entries.append(current_main_entry)
                
                else:
                    # 添加更多调试信息
                    print(f"🔍 无法匹配的行: '{line}'")
                    print(f"   - 前导空格: {leading_spaces}")
                    print(f"   - 行内容: {line.strip()}")
                    
                    # 尝试更宽松的匹配
                    loose_match = re.search(r'\*\s*\[([^\]]+)\]\s*\(\s*([^)]+)\s*\)', line)
                    if loose_match:
                        print("   ✅ 松散匹配成功!")
                        title = loose_match.group(1)
                        api_url = loose_match.group(2)
                        current_main_entry = TextbookEntry("", api_url, title, "", "")
                        self.textbook_entries.append(current_main_entry)
                    else:
                        title = line.strip()[2:].strip()
                        current_main_entry = TextbookEntry("", "", title, "", "")
                        self.textbook_entries.append(current_main_entry)
                        print(f"⚠️ 无链接条目: {title}")
            
            elif leading_spaces == 8 and line.strip().startswith('*') and current_main_entry:
                link_match = re.search(r'\*\s*\[([^\]]+)\]\s*\(\s*([^)]+)\s*\)', line)
                if link_match:
                    title = link_match.group(1)
                    api_url = link_match.group(2)
                    
                    sub_entry = TextbookSubEntry(title, api_url, -1)
                    current_main_entry.sub_entries.append(sub_entry)

    def extract_textbook_info(self, line):
        textbook_name = ""
        editor_first = ""
        publisher = ""
        
        # 更鲁棒的正则，允许空格
        name_match = re.search(r':material-format-quote-open:\s*`([^`]+)`', line)
        if name_match:
            textbook_name = name_match.group(1).strip()
        
        editor_match = re.search(r':material-account:\s*`([^`]+)`', line)
        if editor_match:
            editor_first = editor_match.group(1).strip()
        
        publisher_match = re.search(r':material-printer:\s*`([^`]+)`', line)
        if publisher_match:
            publisher = publisher_match.group(1).strip()
        
        return textbook_name, editor_first, publisher

    def update_tree_view(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        for i, entry in enumerate(self.textbook_entries):
            if entry.volume:
                type_text = entry.volume
                name_text = entry.textbook_name
            else:
                type_text = "其他"
                name_text = entry.textbook_name if entry.textbook_name else "未知"
            
            main_item = self.tree.insert("", "end", 
                                       text=str(i + 1),
                                       values=(type_text, name_text, entry.editor_first, entry.publisher))
            
            for j, sub_entry in enumerate(entry.sub_entries):
                self.tree.insert(main_item, "end",
                               text=f"{i + 1}.{j + 1}",
                               values=("子条目", sub_entry.title, "", ""))
        
        for item in self.tree.get_children():
            self.tree.item(item, open=True)

    def copy_entry(self):
        """复制选中的条目到剪贴板"""
        selected_item = self.tree.selection()
        if not selected_item:
            messagebox.showwarning("警告", "请选择要复制的条目")
            return
        
        item = selected_item[0]
        parent = self.tree.parent(item)
        
        if parent:
            # 复制子条目
            main_index = int(self.tree.item(parent)['text']) - 1
            sub_index = int(self.tree.item(item)['text'].split('.')[1]) - 1
            sub_entry = self.textbook_entries[main_index].sub_entries[sub_index]
            self.clipboard = {
                'type': 'sub_entry',
                'data': sub_entry.clone()
            }
            messagebox.showinfo("成功", "子条目已复制到剪贴板")
        else:
            # 复制主条目
            main_index = int(self.tree.item(item)['text']) - 1
            entry = self.textbook_entries[main_index]
            self.clipboard = {
                'type': 'main_entry',
                'data': entry.clone()
            }
            messagebox.showinfo("成功", "主条目已复制到剪贴板")

    def paste_entry(self):
        """将剪贴板中的条目粘贴到当前位置"""
        if not self.clipboard:
            messagebox.showwarning("警告", "剪贴板为空，请先复制条目")
            return
        
        selected_item = self.tree.selection()
        
        if self.clipboard['type'] == 'main_entry':
            # 粘贴主条目
            new_entry = self.clipboard['data'].clone()
            self.textbook_entries.append(new_entry)
            self.update_tree_view()
            messagebox.showinfo("成功", "主条目已粘贴")
            
        elif self.clipboard['type'] == 'sub_entry':
            if not self.textbook_entries:
                messagebox.showwarning("警告", "请先添加主教材")
                return
            
            # 粘贴子条目
            if selected_item:
                item = selected_item[0]
                parent = self.tree.parent(item)
                if parent:
                    # 如果选中的是子条目，粘贴到同一个主条目下
                    main_index = int(self.tree.item(parent)['text']) - 1
                else:
                    # 如果选中的是主条目，粘贴到该主条目下
                    main_index = int(self.tree.item(item)['text']) - 1
            else:
                # 如果没有选中任何条目，粘贴到最后一个主条目下
                main_index = len(self.textbook_entries) - 1
            
            if main_index >= 0 and main_index < len(self.textbook_entries):
                new_sub_entry = self.clipboard['data'].clone()
                self.textbook_entries[main_index].sub_entries.append(new_sub_entry)
                self.update_tree_view()
                messagebox.showinfo("成功", "子条目已粘贴")
            else:
                messagebox.showwarning("警告", "无效的粘贴位置")

    # 以下方法未修改，保持原样
    def add_main_textbook(self):
        if not self.current_course_code:
            messagebox.showwarning("警告", "请先选择课程编号")
            return
        
        dialog = MainTextbookDialog(self.root, "添加主教材")
        if dialog.result:
            entry = TextbookEntry(
                dialog.result['volume'],
                dialog.result['api_url'],
                dialog.result['textbook_name'],
                dialog.result['editor_first'],
                dialog.result['publisher']
            )
            self.textbook_entries.append(entry)
            self.update_tree_view()

    def add_sub_entry(self):
        if not self.textbook_entries:
            messagebox.showwarning("警告", "请先添加主教材")
            return
        
        selected_item = self.tree.selection()
        target_main_entry = None
        
        if selected_item:
            item = selected_item[0]
            parent = self.tree.parent(item)
            if parent:
                main_index = int(self.tree.item(parent)['text']) - 1
            else:
                main_index = int(self.tree.item(item)['text']) - 1
            target_main_entry = self.textbook_entries[main_index]
        else:
            target_main_entry = self.textbook_entries[-1]
        
        dialog = SubEntryDialog(self.root, "添加子条目")
        if dialog.result:
            sub_entry = TextbookSubEntry(
                dialog.result['title'],
                dialog.result['api_url'],
                -1
            )
            target_main_entry.sub_entries.append(sub_entry)
            self.update_tree_view()

    def edit_entry(self):
        selected_item = self.tree.selection()
        if not selected_item:
            messagebox.showwarning("警告", "请选择要编辑的条目")
            return
        
        item = selected_item[0]
        parent = self.tree.parent(item)
        
        if parent:
            main_index = int(self.tree.item(parent)['text']) - 1
            sub_index = int(self.tree.item(item)['text'].split('.')[1]) - 1
            sub_entry = self.textbook_entries[main_index].sub_entries[sub_index]
            
            dialog = SubEntryDialog(self.root, "编辑子条目", sub_entry.title, sub_entry.api_url)
            if dialog.result:
                sub_entry.title = dialog.result['title']
                sub_entry.api_url = dialog.result['api_url']
                self.update_tree_view()
        else:
            main_index = int(self.tree.item(item)['text']) - 1
            entry = self.textbook_entries[main_index]
            
            dialog = MainTextbookDialog(self.root, "编辑主教材", 
                                      entry.volume, entry.api_url, entry.textbook_name, 
                                      entry.editor_first, entry.publisher)
            if dialog.result:
                entry.volume = dialog.result['volume']
                entry.api_url = dialog.result['api_url']
                entry.textbook_name = dialog.result['textbook_name']
                entry.editor_first = dialog.result['editor_first']
                entry.publisher = dialog.result['publisher']
                self.update_tree_view()

    def delete_entry(self):
        selected_item = self.tree.selection()
        if not selected_item:
            messagebox.showwarning("警告", "请选择要删除的条目")
            return
        
        if not messagebox.askyesno("确认", "确定要删除选中的条目吗？"):
            return
        
        item = selected_item[0]
        parent = self.tree.parent(item)
        
        if parent:
            main_index = int(self.tree.item(parent)['text']) - 1
            sub_index = int(self.tree.item(item)['text'].split('.')[1]) - 1
            del self.textbook_entries[main_index].sub_entries[sub_index]
        else:
            main_index = int(self.tree.item(item)['text']) - 1
            del self.textbook_entries[main_index]
        
        self.update_tree_view()

    def move_up(self):
        selected_item = self.tree.selection()
        if not selected_item:
            messagebox.showwarning("警告", "请选择要移动的条目")
            return
        
        item = selected_item[0]
        parent = self.tree.parent(item)
        
        if parent:
            main_index = int(self.tree.item(parent)['text']) - 1
            sub_index = int(self.tree.item(item)['text'].split('.')[1]) - 1
            
            if sub_index > 0:
                sub_entries = self.textbook_entries[main_index].sub_entries
                sub_entries[sub_index], sub_entries[sub_index - 1] = sub_entries[sub_index - 1], sub_entries[sub_index]
                self.update_tree_view()
                new_item = self.tree.get_children(self.tree.get_children()[main_index])[sub_index - 1]
                self.tree.selection_set(new_item)
        else:
            main_index = int(self.tree.item(item)['text']) - 1
            
            if main_index > 0:
                self.textbook_entries[main_index], self.textbook_entries[main_index - 1] = \
                    self.textbook_entries[main_index - 1], self.textbook_entries[main_index]
                self.update_tree_view()
                new_item = self.tree.get_children()[main_index - 1]
                self.tree.selection_set(new_item)

    def move_down(self):
        selected_item = self.tree.selection()
        if not selected_item:
            messagebox.showwarning("警告", "请选择要移动的条目")
            return
        
        item = selected_item[0]
        parent = self.tree.parent(item)
        
        if parent:
            main_index = int(self.tree.item(parent)['text']) - 1
            sub_index = int(self.tree.item(item)['text'].split('.')[1]) - 1
            sub_entries = self.textbook_entries[main_index].sub_entries
            
            if sub_index < len(sub_entries) - 1:
                sub_entries[sub_index], sub_entries[sub_index + 1] = sub_entries[sub_index + 1], sub_entries[sub_index]
                self.update_tree_view()
                new_item = self.tree.get_children(self.tree.get_children()[main_index])[sub_index + 1]
                self.tree.selection_set(new_item)
        else:
            main_index = int(self.tree.item(item)['text']) - 1
            
            if main_index < len(self.textbook_entries) - 1:
                self.textbook_entries[main_index], self.textbook_entries[main_index + 1] = \
                    self.textbook_entries[main_index + 1], self.textbook_entries[main_index]
                self.update_tree_view()
                new_item = self.tree.get_children()[main_index + 1]
                self.tree.selection_set(new_item)

    def save_changes(self):
        if not self.file_path:
            messagebox.showwarning("警告", "没有选择文件")
            return
        
        if not self.current_course_code:
            messagebox.showwarning("警告", "没有选择课程编号")
            return
        
        try:
            start_index, end_index = self.find_course_section()
            if start_index == -1:
                messagebox.showerror("错误", "找不到对应的课程编号部分")
                return
            
            new_content = []
            for entry in self.textbook_entries:
                new_content.append(entry.to_markdown())
            
            new_file_content = (
                self.file_content[:start_index] +
                new_content +
                self.file_content[end_index:]
            )
            
            with open(self.file_path, 'w', encoding='utf-8') as f:
                f.writelines(new_file_content)
            
            self.file_content = new_file_content
            
            messagebox.showinfo("成功", "更改已保存")
            
        except Exception as e:
            messagebox.showerror("错误", f"保存时出错: {str(e)}")


class MainTextbookDialog:
    def __init__(self, parent, title, volume="", api_url="", textbook_name="", editor_first="", publisher=""):
        self.result = None
        
        self.dialog = tk.Toplevel(parent)
        self.dialog.title(title)
        self.dialog.geometry("500x300")
        self.dialog.transient(parent)
        self.dialog.grab_set()
        
        frame = ttk.Frame(self.dialog, padding=20)
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="类型/册数:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.volume_var = tk.StringVar(value=volume)
        volume_combo = ttk.Combobox(frame, textvariable=self.volume_var, values=[
            "教材上册", "教材中册", "教材下册", 
            "教材第1册", "教材第2册", "教材第3册",
            "试卷", "习题集", "实验指导", "其他", ""
        ])
        volume_combo.grid(row=0, column=1, sticky=tk.EW, pady=5, padx=(10, 0))
        
        ttk.Label(frame, text="API链接:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.api_url_var = tk.StringVar(value=api_url)
        api_frame = ttk.Frame(frame)
        api_frame.grid(row=1, column=1, sticky=tk.EW, pady=5, padx=(10, 0))
        
        api_entry = ttk.Entry(api_frame, textvariable=self.api_url_var)
        api_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # 添加"自动填写"按钮
        auto_fill_button = ttk.Button(api_frame, text="自动填写", 
                                    command=lambda: self.api_url_var.set("http://api.cqu-openlib.cn/file?key="))
        auto_fill_button.pack(side=tk.RIGHT, padx=(5, 0))
        
        ttk.Label(frame, text="教材名称:").grid(row=2, column=0, sticky=tk.W, pady=5)
        self.textbook_name_var = tk.StringVar(value=textbook_name)
        ttk.Entry(frame, textvariable=self.textbook_name_var).grid(row=2, column=1, sticky=tk.EW, pady=5, padx=(10, 0))
        
        ttk.Label(frame, text="主编:").grid(row=3, column=0, sticky=tk.W, pady=5)
        self.editor_first_var = tk.StringVar(value=editor_first)
        ttk.Entry(frame, textvariable=self.editor_first_var).grid(row=3, column=1, sticky=tk.EW, pady=5, padx=(10, 0))
        
        ttk.Label(frame, text="出版社:").grid(row=4, column=0, sticky=tk.W, pady=5)
        self.publisher_var = tk.StringVar(value=publisher)
        ttk.Entry(frame, textvariable=self.publisher_var).grid(row=4, column=1, sticky=tk.EW, pady=5, padx=(10, 0))
        
        button_frame = ttk.Frame(frame)
        button_frame.grid(row=5, column=0, columnspan=2, pady=20)
        
        ttk.Button(button_frame, text="确定", command=self.ok_clicked).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="取消", command=self.cancel_clicked).pack(side=tk.LEFT, padx=5)
        
        frame.columnconfigure(1, weight=1)
        
        self.dialog.wait_window()
    
    def ok_clicked(self):
        if not self.api_url_var.get().strip():
            messagebox.showwarning("警告", "请输入API链接")
            return
        
        if not self.textbook_name_var.get().strip():
            messagebox.showwarning("警告", "请输入教材名称")
            return
        
        self.result = {
            'volume': self.volume_var.get().strip(),
            'api_url': self.api_url_var.get().strip(),
            'textbook_name': self.textbook_name_var.get().strip(),
            'editor_first': self.editor_first_var.get().strip(),
            'publisher': self.publisher_var.get().strip()
        }
        self.dialog.destroy()
    
    def cancel_clicked(self):
        self.dialog.destroy()


class SubEntryDialog:
    def __init__(self, parent, title, entry_title="", api_url=""):
        self.result = None
        
        self.dialog = tk.Toplevel(parent)
        self.dialog.title(title)
        self.dialog.geometry("500x200")
        self.dialog.transient(parent)
        self.dialog.grab_set()
        
        frame = ttk.Frame(self.dialog, padding=20)
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="标题:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.title_var = tk.StringVar(value=entry_title)
        ttk.Entry(frame, textvariable=self.title_var).grid(row=0, column=1, sticky=tk.EW, pady=5, padx=(10, 0))
        
        ttk.Label(frame, text="API链接:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.api_url_var = tk.StringVar(value=api_url)
        api_frame = ttk.Frame(frame)
        api_frame.grid(row=1, column=1, sticky=tk.EW, pady=5, padx=(10, 0))
        
        api_entry = ttk.Entry(api_frame, textvariable=self.api_url_var)
        api_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # 添加"自动填写"按钮
        auto_fill_button = ttk.Button(api_frame, text="自动填写", 
                                    command=lambda: self.api_url_var.set("http://api.cqu-openlib.cn/file?key="))
        auto_fill_button.pack(side=tk.RIGHT, padx=(5, 0))
        
        button_frame = ttk.Frame(frame)
        button_frame.grid(row=2, column=0, columnspan=2, pady=20)
        
        ttk.Button(button_frame, text="确定", command=self.ok_clicked).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="取消", command=self.cancel_clicked).pack(side=tk.LEFT, padx=5)
        
        frame.columnconfigure(1, weight=1)
        
        self.dialog.wait_window()
    
    def ok_clicked(self):
        if not self.title_var.get().strip():
            messagebox.showwarning("警告", "请输入标题")
            return
        
        if not self.api_url_var.get().strip():
            messagebox.showwarning("警告", "请输入API链接")
            return
        
        self.result = {
            'title': self.title_var.get().strip(),
            'api_url': self.api_url_var.get().strip()
        }
        self.dialog.destroy()
    
    def cancel_clicked(self):
        self.dialog.destroy()


def main():
    root = tk.Tk()
    
    try:
        root.iconbitmap('icon.ico')
    except:
        pass
    
    menubar = tk.Menu(root)
    root.config(menu=menubar)
    
    file_menu = tk.Menu(menubar, tearoff=0)
    menubar.add_cascade(label="文件", menu=file_menu)
    file_menu.add_command(label="刷新课程列表", command=lambda: app.load_courses())
    file_menu.add_separator()
    file_menu.add_command(label="退出", command=root.quit)
    
    # 删除了工具菜单
    
    help_menu = tk.Menu(menubar, tearoff=0)
    menubar.add_cascade(label="帮助", menu=help_menu)
    help_menu.add_command(label="关于", command=lambda: messagebox.showinfo("关于", 
        "教材文档管理系统 v1.2\n\n"
        "程序逻辑模块由何晟旭同学负责设计与开发；图形用户界面（GUI）的开发工作借助 Claude 与 Qwen 两款大语言模型辅助完成。不过本程序不支持log更新与自动git！\n"
        "功能特性:\n"
        "• 课程搜索和选择\n"
        "• 教材条目管理\n"
        "• Markdown格式支持\n"
        "• 跨文件复制粘贴教材条目\n"
        "• 新增：添加课程号功能（在文件末尾添加）\n"
        "• 新增：API链接自动填写功能\n\n"
        "使用说明:\n"
        "1. 在左侧搜索并选择课程\n"
        "2. 选择课程编号（含'无课程号'）\n"
        "3. 管理教材条目\n"
        "4. 使用复制/粘贴按钮在不同课程间移动条目\n"
        "5. 保存更改"))

    app = TextbookManagerGUI(root)
    
    def on_closing():
        if messagebox.askokcancel("退出", "确定要退出吗？"):
            root.destroy()
    
    root.protocol("WM_DELETE_WINDOW", on_closing)
    
    root.mainloop()


if __name__ == "__main__":
    main()
