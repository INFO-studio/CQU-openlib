# 脚本

## 1. `addTextbook.py`

命令式 / 交互式 添加教材脚本

#### 作用
1. 在对应页面中添加教材
2. 在今日日志中添加教材方法
3. 使用 `updateLog.py` 更新日志
4. 支持Git操作（拉取、推送）
5. 自动解析蓝奏云分享链接

#### 使用方法
```bash
# 交互式运行
python addTextbook.py  //命令行交互

# 参数化运行
python addTextbook.py \
  --course_name "高等数学" \
  --course_code "MATH1234" \
  --key "https://lanzou.com/abc123def456" \
  --composite "教材上册-高等数学-张三-重庆大学出版社" \
  --push \
  --commit "更新: 新增高等数学教材"
```

#### 参数说明
- `--course_name`: 课程名称
- `--course_code`: 课程编号
- `--key`: 蓝奏云链接或12位密钥
- `--composite`: 教材信息（格式：教材[上册/下册]-教材名-主编-出版社）
- `--form-line`: 是否写入表单完成行（0=不写入，1=教材收集，2=文件上传）
- `--form-index`: 对应表单索引号
- `--push`: 是否推送到Git仓库
- `--skip-pull`: 跳过Git拉取操作
- `--force-pull`: 强制以云端为准重置本地更改

## 2. `updateTrainingPlan.py`

培养方案更新脚本

#### 作用
1. 从Excel文件读取培养方案数据
2. 自动生成Markdown格式的培养方案文档
3. 自动创建课程页面
4. 更新mkdocs.yml配置
5. 支持学期编号到中文的映射

#### 使用方法
1. 将培养方案Excel文件放入 `scripts/input/` 目录
2. 确保Excel文件包含以下列：学院、专业、年级、课程类别、课程性质、课程名称、课程代码、总学分、开课学期
3. 运行脚本：
```bash
python updateTrainingPlan.py
```

#### 输出结果
- `docs/academic/专业培养方案/`: 生成的培养方案文档
- `scripts/trainingPlan.json`: 中间数据文件
- `mkdocs.yml`: 更新的配置文件
- `docs/course/`: 自动创建的课程页面

## 3. `updateLog.py`

更新日志脚本

#### 作用
1. 遍历日志文件夹
2. 更新 日志索引页
3. 更新 首页
4. 更新 `mkdocs.yaml`

#### 使用方法
```bash
python updateLog.py
```

#### 处理流程
1. 扫描日志目录：遍历 `docs/sundry/更新日志/` 目录
2. 分析文件结构：按年/月/日组织日志文件
3. 生成索引：创建按季度分组的日志索引
4. 更新链接：更新主页和配置文件中的链接

## 4. `createFileViaNav.py`

批量创建课程文件脚本

#### 作用
1. 根据文本列表批量创建课程Markdown文件
2. 自动填充默认模板内容

#### 使用方法
1. 在 `docs/course/非限课/1.md` 中每行一个课程名称
2. 运行脚本：
```bash
python createFileViaNav.py
```

#### 生成内容
每个课程文件将包含默认模板：
```markdown
## 暂无数据，欢迎贡献
!!! info "如果您知晓本门课程需要什么教材，欢迎[填表贡献](https://forms.office.com/r/huSXS4xpuD)，您只需要告知信息，并不必要持有pdf文件"

- Github: [https://github.com/INFO-studio/CQU-openlib](https://github.com/INFO-studio/CQU-openlib)
- 站长QQ: `2247977881`
```

## 5. `Run-addTextbook_GUI.bat`

Windows启动脚本

#### 作用
1. 自动检查Python依赖
2. 自动安装缺失的包
3. 启动GUI应用程序

#### 使用方法
双击运行批处理文件即可

## 依赖要求

### Python包依赖
```bash
pip install openpyxl jieba
```

### Vercel部署依赖
```bash
mkdocs-material==9.6.13
jieba==0.42.1
```

## 技术支持

- GitHub: [https://github.com/INFO-studio/CQU-openlib](https://github.com/INFO-studio/CQU-openlib)
- QQ: `2247977881`
- 问题反馈: 通过GitHub Issues提交