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

## 四条铁律

**一、抄现有写法，不要发明写法。** 4000 多个文档页，任何格式问题都已有几百个先例，动手前先 `rg` 一个同类页面。你觉得「更合理」的写法一律不用。

**二、`updated` 只在读者看到的信息真的变了时才动。** 格式统一、错别字、图标换名都不算。照 [updated-and-changelog.md](updated-and-changelog.md) 的判定表执行，不要自己推理。

**三、写更新日志必须同步改三处文件。** 漏一处站点上的日期就对不上，清单见 [updated-and-changelog.md](updated-and-changelog.md)。

**四、`:l-xxx:` 图标必须先在 `app/utils/parser/parserIcon.tsx` 的 `STATIC_ICONS` 注册**，否则页面上渲染成灰色字面文本。步骤见 [site-structure.md](site-structure.md)。

## 最常见的任务：收录一本教材

1. **查课程号**：查 `metadata/course-codes.json`，覆盖 3643 门课 5550 个号，一条命令见 [site-structure.md](site-structure.md)。不要自己编，也不要凭课程名猜——书名和课程名一致不代表课程号一样。
2. **查书目信息**：书名、第一作者、出版方、ISBN13。作者只写第一个。拿不准就搜 ISBN 核实，不要照抄 PDF 文件名（流传的文件名经常把主编写错）。**版次只在用户明确说明「第几版」时录入**，从 ISBN 或外部书目查得到也不补。
3. **写条目**：按 [entry-formats.md](entry-formats.md) 的模板写。目标页面如果是「暂无数据，欢迎贡献」占位页，整体替换成课程页骨架，不要在占位内容下面追加。
4. **改 `updated`** 为当天日期。
5. **写更新日志三处**。
6. **兑现了待办条目**：删掉 `sundry/待办事项/textbook.md` 里那条、该页 `updated` 也改当天，日志补一行 `完成 … legacy#134`。

**只知道书目、拿不到文件**时不要把页面留成空占位：按 [entry-formats.md](entry-formats.md) 的「已知教材但没拿到文件」写说明并引用待办序号，让读者看出「知道是哪本，只是没有」。

## 验证

```bash
pnpm test        # 改了解析器、图标注册、或任何 app/ 下代码就必须跑
pnpm typecheck   # 动了类型再跑
```

改文档不需要跑构建。新增图标后跑 `pnpm test`，但别指望它兜住漏注册：`app/tests/parser/iconCoverage.test.ts` 只校验注册表自洽和三个样本页，**不扫全库**（读 4000 多个文档要几十秒）。全库自查得自己跑：

```bash
# 全库在用的图标种类，拿结果对 STATIC_ICONS
rg -o --no-filename -e ':l-[a-z0-9-]+:' public/doc | sort -u

# 看某种写法的既有先例
rg -n ':l-book-open:' public/doc/course | head

# 确认书目条目行尾有两个空格
rg -n ':l-printer:`[^`]+` ?$' public/doc
```
