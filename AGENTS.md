# AGENTS.md

面向在本仓库工作的编码 Agent。Cursor / Codex 等会读取本文件。

## 项目概要

- 重庆大学资源共享站点 **CQU-openlib**：Vite + React + TanStack Router SPA，文档源在 `public/doc/**/*.md`。
- 包管理：`pnpm`。常用：`pnpm dev` / `pnpm test` / `pnpm typecheck` / `pnpm check`。
- 默认分支：`main`。

## 改 `public/doc/**` 之前

编写规范全部收在 `.agents/skills/cqu-openlib-docs/`，动手前按需读。入口 `SKILL.md`（铁律与收录教材的完整步骤在那里），四份细则：

| 你要做的事 | 读这个 |
| --- | --- |
| 资源条目：教材、试卷、课件、贡献者署名 | `entry-formats.md` |
| 判断要不要动 `updated`、要不要写更新日志 | `updated-and-changelog.md` |
| 扩展语法：内容 tab、admonition、图标、键位 | `markdown-syntax.md` |
| 新建页面、放图片、写站内链接、加图标 | `site-structure.md` |

## 动 `tools/pdf_optimize/` 之前

规范在 `.agents/skills/pdf-optimize/`，入口 `SKILL.md`：

| 你要做的事 | 读这个 |
| --- | --- |
| 安装、probe/run/verify | `setup-and-usage.md` |
| 压体积、调 `--dpi` / `--mode` | `compression.md` |
| 去广告（必须在 run 之前） | `ad-removal.md` |
| 要不要 `--ocr` | `ocr.md` |
| 产物校验、勿提交大文件 | `integrity.md` |

## 开发习惯

- 抄先例，不要发明写法；不顺手大重构或扩写无关文档。
- 改解析器（`app/utils/remark/**`、`app/utils/preprocess/**`）时补边界测试，跑 `pnpm test`；动了类型再跑 `pnpm typecheck`。
- 用户未要求时不要自动 commit / push；要求提交时用普通 git，不要附加无关署名流程。

## 前端组件

- 项目使用 **Base UI + 类 shadcn 的本地组件管理方式**。页面优先复用 `app/components/ui/` 中的组件，不要在业务页面重复拼装同类交互与样式。
- Select、Dialog、Popover、Collapsible 等复合交互优先使用 Base UI primitive；缺少通用封装时，先在 `app/components/ui/` 增加可复用组件，再由页面调用。不要用原生 `<select>` 等控件临时替代。
- 组件样式使用 UnoCSS 和现有语义化 token；避免散落的自定义 CSS、重复样式和脱离主题的硬编码颜色。
- **所有图标必须使用不透明前景色**——Lucide 由多个 stroke/path 组成，带 alpha 的 `currentColor` 会在路径重叠处重复混色。弱图标 `text-icon`，接近正文或用于 hover 的强图标 `text-icon-strong`，品牌强调 `text-primary`，状态图标 `text-success` / `text-error`。禁止继承 `text-muted`、`text-ink`、`颜色/透明度` 或带 alpha 的硬编码色。两个不算违规：整枚 SVG 或外层容器用于显隐、禁用、动画的 `opacity-*` 是组后合成，不叠色；Lucide 的 `fill="none"` 是图形结构。
