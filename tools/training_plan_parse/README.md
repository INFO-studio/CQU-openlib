# 培养方案清洗与更新

读取教务导出的 `data/*.xlsx`，生成培养方案预览、更新站点并补齐缺失课程页。

## 快速开始

```bash
cd tools/training_plan_parse
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt

# 全量只读验证与数量摘要
.venv/bin/python clean_training_plans.py --expect-rows 46327 --verify-stable

# 查看一个专业的 Markdown；JSON 模式包含全部原始字段、来源行及预览
.venv/bin/python clean_training_plans.py --format markdown --college 大数据与软件学院 --major 软件工程
.venv/bin/python clean_training_plans.py --format json

# 默认仅预览处理数量；确认后显式写入，并调用 pnpm codes:extract
.venv/bin/python update_site.py --expect-rows 46327
.venv/bin/python update_site.py --write --expect-rows 46327 --date 2026-09-15

# 同时删除已迁移到核心名称、且确认只有占位内容的旧页
.venv/bin/python update_site.py --write --prune-placeholders --expect-rows 46327 --date 2026-09-15
```

更新命令需要仓库已安装 Node.js / pnpm 依赖。示例日期应替换为实际更新日期；省略 `--date` 使用本机当天日期。`--expect-rows` 用于核对这批四表，后续批次应使用对应行数或省略。

## 输入与规则

- 固定按文件名排序，读取活动工作表第二行表头；兼容教务导出错误声明为 `A1` 的数据范围。
- 只排除专业名含「辅修」「双学位」的记录，不按层次筛选；完全相同的原始记录合并并保留所有来源行。
- 不合并不同类别、必选修、备注或其他字段的版本。零学分保留，缺学分显示「未提供」，缺学期归入「未注明学期」。无效学期、学分和缺少专业分组字段会报错。
- 课程与课程集均正常展示，课程行只显示名称链接、课程号和学分；备注和原始开课范围仅保留在结构化数据中。多学期课程按原始范围分组并显示总学分，不推测学制或拆分「形势与政策」学分。
- 展示名沿用原始课程名称，保留授课语言、分册序号、研讨课、本研共享、本硕共享等附注；只有链接匹配和课程文件名使用清理后的核心名称。不同课程号、学分或来源记录不因链接归并而合并。
- 含「体育」的课程按旧培养方案归入「体育」页，「体育心理学」单独保留。不把所有含「英语」的课程合为一页，不截断 CAD、UML 等技术缩写。影响学科内容的限定（如第二外语的语种、程序设计的编程语言）保留。
- 只读清洗仅链接存在的核心名称页；有名称时不接受旧课程号映射覆盖核心名称。无名称时才使用无歧义课程号映射，不按票数决定归属。

## 写入范围

- `public/doc/academic/专业培养方案/<学院>/<专业>.md`：用当前输入的年级重建对应专业；旧方案只迁移链接，不改展示名、不补入当前专业、不删除旧专业。
- `public/doc/course/*.md`：缺失页、空白页和纯占位页统一为同一模板，无 `updated`、资源标题或课程号 tab。不覆盖已有教材、试卷及其他实际内容。
- 旧脏名称纯占位页迁移到核心名称，并同步站内 Markdown 引用；只有显式传入 `--prune-placeholders` 才删除旧页。删除前再次确认目标存在、旧页仍为纯占位。
- `metadata/course-codes.json`：从站点全部培养方案重新提取；`courses` 保留全部关联，`byCode` 仅包含无歧义映射，`conflicts` 保留所有歧义候选。
- 占位页不写日期；其他页面只为内容改变更新日期。相同输入重复执行不会重写相同内容。更新日志需按站点规范另行同步三处，不由脚本自动发布。

输入 Excel 和任何层级的 `.venv/` 已被 Git 忽略，勿提交。目录改名后重新执行环境创建和依赖安装，不直接复用旧路径的激活入口。

## 验证

```bash
.venv/bin/python -m unittest discover -s . -p 'test_*.py'
.venv/bin/python -m pip install pyright types-openpyxl
.venv/bin/python -m pyright --pythonpath .venv/bin/python .

# 仓库根目录
pnpm exec tsx --test tools/course_codes/extract.test.ts
pnpm test
pnpm typecheck
```

完整测试会读取当前四份 Excel，检查 46,327 行、原始展示名、输出稳定性、链接目标和原文件未修改；更新流程单元测试使用临时目录，覆盖展示名保留、体育链接归并、占位模板一致性、脏名称迁移、真实资源保护和重复执行。
