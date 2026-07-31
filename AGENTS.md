# AGENTS.md

面向在本仓库工作的编码 Agent。Cursor / Codex 等会读取本文件。

## 项目概要

- 重庆大学资源共享站点 **CQU-openlib**：Vite + React + TanStack Router SPA，文档源在 `public/doc/**/*.md`。
- 包管理：`pnpm`。常用：`pnpm dev` / `pnpm test` / `pnpm typecheck` / `pnpm check`。
- 默认分支：`main`。

## 改 `public/doc/**` 之前

编写规范全部收在 `.agents/skills/cqu-openlib-docs/`，动手前按需读。入口是该目录下的 `SKILL.md`，四份细则：

| 你要做的事 | 读这个 |
| --- | --- |
| 资源条目：教材、试卷、课件、贡献者署名 | `entry-formats.md` |
| 判断要不要动 `updated`、要不要写更新日志 | `updated-and-changelog.md` |
| 扩展语法：内容 tab、admonition、图标、键位 | `markdown-syntax.md` |
| 新建页面、放图片、写站内链接、加图标 | `site-structure.md` |

以下三条最容易违反，先记住再去读细则：

1. **`updated` 只在读者看到的信息真的变了时才动。** 格式统一、错别字修正、图标换名都不算，一律不要动日期。
2. **写更新日志要同步改三处文件**：当天日志、`更新日志/index.md`（顶部链接 + 年/季度/月 tab）、首页 `index.md` 公告的日期链接。漏一处站点上就对不上。
3. **`:l-xxx:` 图标必须先在 `app/utils/parser/parserIcon.tsx` 的 `STATIC_ICONS` 注册**，否则页面上渲染成灰色字面文本。加完跑 `pnpm test`，`iconCoverage` 用例会兜住漏注册。

## 动 `tools/pdf_optimize/` 之前

规范在 `.agents/skills/pdf-optimize/`，入口 `SKILL.md`：

| 你要做的事 | 读这个 |
| --- | --- |
| 安装、probe/run/verify | `setup-and-usage.md` |
| 压体积、调 `--dpi` / `--mode` | `compression.md` |
| 去广告（必须在 run 之前） | `ad-removal.md` |
| 要不要 `--ocr` | `ocr.md` |
| 产物校验、勿提交大文件 | `integrity.md` |

## 文档与代码习惯

- 优先改现有文件与既有写法；不要顺手大重构或扩写无关文档。抄先例，不要发明写法。
- 改解析器（`app/utils/remark/**`、`app/utils/preprocess/**`）时补边界测试。
- 用户未要求时不要自动 commit / push；要求提交时用普通 git，不要附加无关署名流程。

## 验证

改解析 / 工具函数后跑相关测试：`pnpm test`。涉及类型时再跑 `pnpm typecheck`。
