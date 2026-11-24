---
name: cqu-openlib-docs
description: Rules for editing the CQU-openlib documentation site (public/doc/**/*.md) — resource entry formats for textbooks and exam papers, custom Markdown syntax (content tabs, admonitions, l- icons), the updated frontmatter field, and the three-file changelog sync. Use when adding or editing any page under public/doc, recording a textbook or exam paper, writing a changelog entry, or touching the Markdown parser under app/utils/remark or app/utils/preprocess
---

# CQU-openlib 文档编写

重庆大学资源共享站点，Vite + React + TanStack Router SPA，文档源 `public/doc/**/*.md`，包管理 `pnpm`，默认分支 `main`

## 动手前先读对应的那一份

| 你要做的事 | 读这个 |
| --- | --- |
| 收录教材、试卷、课件等资源条目 | [entry-formats.md](entry-formats.md) |
| 判断要不要改 `updated`、要不要写更新日志 | [updated-and-changelog.md](updated-and-changelog.md) |
| 用 tab / 折叠块 / 图标 / 键盘键等扩展语法 | [markdown-syntax.md](markdown-syntax.md) |
| 新建页面、放图片、写站内链接、加图标 | [site-structure.md](site-structure.md) |

不确定读哪份先读 `entry-formats.md`

## 硬性规则

- 抄既有先例（动手前 `rg` 同类页），不发明写法
- 仅读者可见信息变动才改 `updated`，按 [updated-and-changelog.md](updated-and-changelog.md) 判定表执行
- 写更新日志必须同步改 3 处文件（[updated-and-changelog.md](updated-and-changelog.md)）
- `:l-xxx:` 图标须先在 `app/utils/parser/parserIcon.tsx` 的 `STATIC_ICONS` 注册（[site-structure.md](site-structure.md)）

## 收录一本教材

1. 查课程号（勿凭书名或课名猜）：

```bash
python3 -c "import json; print(json.load(open('metadata/course-codes.json'))['courses'].get('/course/课程名'))"
```

2. 核对书目：书名、第一作者（只写第一人）、出版方、ISBN13，不盲信流传 PDF 文件名；**版次仅在用户明确告知「第几版」时录入**，不从 ISBN 或外部书目补填
3. 按 [entry-formats.md](entry-formats.md) 写条目；目标页为 `placeholder: course` 占位页时整页替换成课程页骨架，不在占位下追加
4. `updated` 改当天
5. 同步 3 处更新日志
6. 若兑现待办：删掉 `sundry/待办事项/textbook.md` 对应条目、该页 `updated` 改当天、日志补 `完成 …`

仅有书目拿不到文件时只登记 `sundry/待办事项/textbook.md`，课程页保持 `placeholder: course`（[entry-formats.md](entry-formats.md)）

## 验证

```bash
pnpm test        # 改了解析器、图标注册或 app/ 代码必跑
pnpm typecheck   # 动了类型再跑
```

纯改文档不需构建。`app/tests/parser/iconCoverage.test.ts` 只检注册表和 3 个样本页不扫全库，全库图标漏注册与格式自查用 `rg`：

```bash
rg -o --no-filename -e ':l-[a-z0-9-]+:' public/doc | sort -u   # 对照 STATIC_ICONS
rg -n ':l-book-open:' public/doc/course | head                 # 看既有先例
rg -n ':l-printer:`[^`]+` ?$' public/doc                       # 查书目行尾双空格
```
