---
name: cqu-openlib-docs
description: Rules for editing the CQU-openlib documentation site (public/doc/**/*.md) — resource entry formats for textbooks and exam papers, custom Markdown syntax (content tabs, admonitions, l- icons), the updated frontmatter field, and the three-file changelog sync. Use when adding or editing any page under public/doc, recording a textbook or exam paper, writing a changelog entry, or touching the Markdown parser under app/utils/remark or app/utils/preprocess.
---

# CQU-openlib 文档编写

重庆大学资源共享站点。Vite + React + TanStack Router SPA，文档源是 `public/doc/**/*.md`，包管理 `pnpm`，默认分支 `main`。

## 动手前先读对应的那一份

| 你要做的事 | 读这个 |
| --- | --- |
| 收录教材、试卷、课件等资源条目 | [entry-formats.md](entry-formats.md) |
| 判断要不要改 `updated`、要不要写更新日志 | [updated-and-changelog.md](updated-and-changelog.md) |
| 用 tab / 折叠块 / 图标 / 键盘键等扩展语法 | [markdown-syntax.md](markdown-syntax.md) |
| 新建页面、放图片、写站内链接、改解析器 | [site-structure.md](site-structure.md) |

不确定读哪份就先读 `entry-formats.md`，站点九成的改动都是资源条目。

## 五条铁律

**一、抄现有写法，不要发明写法。** 这个仓库有 4000 多个文档页，几乎任何格式问题都已经有 300 个先例。动手前先 `rg` 一个同类页面看它怎么写的。你觉得「更合理」的写法一律不要用。

**二、`updated` 只在读者看到的信息真的变了时才动。** 格式统一、错别字、图标换名都不算。判定表在 [updated-and-changelog.md](updated-and-changelog.md)，照表执行，不要自己推理。

**三、写更新日志必须同步改三处文件。** 只改当天日志文件、忘了 `更新日志/index.md` 和首页 `index.md`，站点上的日期就会对不上。清单在 [updated-and-changelog.md](updated-and-changelog.md)。

**四、图标必须先在代码里注册。** `:l-xxx:` 不是直通 lucide 的。没在 `app/utils/parser/parserIcon.tsx` 的 `STATIC_ICONS` 里注册过的图标，在页面上会渲染成灰色的字面文本 `:l-xxx:`。加新图标的完整步骤见 [site-structure.md](site-structure.md)。

**五、不要自动 commit / push。** 用户要求提交时用普通 git，不要附加任何署名流程。

## 最常见的任务：收录一本教材

1. **查课程号**：在 `public/doc/academic/专业培养方案/**` 里 `rg` 课程名，那里每门课都标了 `:l-book:`课程号``。不要自己编，也不要凭课程名猜——书名和课程名一致不代表课程号一样。
2. **查书目信息**：书名、第一作者、出版方、版次、ISBN13。作者只写第一个。拿不准就搜 ISBN 核实，不要照抄 PDF 文件名（网上流传的文件名经常把主编写错）。
3. **写条目**：按 [entry-formats.md](entry-formats.md) 的模板写。目标页面如果是「暂无数据，欢迎贡献」占位页，整体替换成课程页骨架，不要在占位内容下面追加。
4. **改 `updated`** 为当天日期。
5. **写更新日志三处**。

## 验证

```bash
pnpm test        # 改了解析器、图标注册、或任何 app/ 下代码就必须跑
pnpm typecheck   # 动了类型再跑
```

改文档不需要跑构建，但**新增图标后必须跑 `pnpm test`**：`app/tests/parser/iconCoverage.test.ts` 会扫描全库 `:l-xxx:`，漏注册直接失败并报出图标名和文件路径。

自查用得上的命令：

```bash
# 看某种写法的既有先例
rg -n ':l-book-open:' public/doc/course | head

# 确认没有残留的旧写法
rg -n ':l-quote:' public/doc

# 确认书目条目行尾有两个空格
rg -n ':l-printer:`[^`]+` ?$' public/doc
```
