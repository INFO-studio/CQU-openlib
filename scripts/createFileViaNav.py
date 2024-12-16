import os

# 定义要读取的文件路径
input_file = "docs/course/非限课/1.md"

# 确保输入文件存在
if not os.path.exists(input_file):
    print(f"文件 {input_file} 不存在！")
    exit()

# 读取文件内容并逐行处理
with open(input_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

# 遍历每一行并创建相应的 .md 文件
for line in lines:
    line_content = line.strip()  # 去掉行首尾的空白字符
    print(line_content)
    if line_content:  # 确保行内容非空
        new_file_path = os.path.join("docs/course/非限课/", f"{line_content}.md")
        try:
            with open(new_file_path, "w", encoding="utf-8") as new_file:
                new_file.write("""## 暂无数据，欢迎贡献
!!! info "如果您知晓本门课程需要什么教材，欢迎[填表贡献](https://forms.office.com/r/huSXS4xpuD)，您只需要告知信息，并不必要持有pdf文件"

- Github: [https://github.com/INFO-studio/CQU-openlib](https://github.com/INFO-studio/CQU-openlib)
- 站长QQ: `2247977881`""")  # 可以自定义文件内容
            print(f"创建文件: {new_file_path}")
        except Exception as e:
            print(f"创建文件 {new_file_path} 失败: {e}")
