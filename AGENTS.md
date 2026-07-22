# AGENTS.md

面向在本仓库工作的编码 Agent。Cursor / Codex 等会读取本文件。

## 项目概要

- 重庆大学资源共享站点 **CQU-openlib**：Vite + React + TanStack Router SPA，文档源在 `public/doc/**/*.md`。
- 包管理：`pnpm`。常用：`pnpm dev` / `pnpm test` / `pnpm typecheck` / `pnpm check`。
- 默认分支：`main`。

## 文档 frontmatter（必守）

文档页使用 YAML frontmatter。站点会解析并展示 **`updated`**（标题下「编辑于 YYYY-MM-DD」）。

```yaml
---
updated: 2026-07-22
---
```

### 规则

1. **改动 `public/doc/` 下正文时，必须同步维护 `updated`：**
   - 已有 frontmatter → 把 `updated` 改成**当天**日期（`YYYY-MM-DD`）。
   - 没有 frontmatter → **补上**上述块（至少包含 `updated`）。
2. 日期必须是合法的 `YYYY-MM-DD` 字符串；不要写成时间戳或其它格式。
3. **例外（通常不要加 / 不必强行更新 `updated`）：**
   - `public/doc/contributor/**`（贡献者个人页）
   - `public/doc/sundry/更新日志/**`（日志本身以路径/标题表达日期）
4. 纯格式无关的机械改动（如只改错别字以外的空白）、或用户明确要求不要动日期时，可跳过；**内容增删改默认都要更新日期。**

可选字段（按需，勿虚构）：

- `description`：短描述
- `hide`：字符串列表（页面展示相关）

实现参考：`app/utils/docFrontmatter.ts`。

## 文档与代码习惯（简）

- 优先改现有文件与既有写法；不要顺手大重构或扩写无关文档。
- Markdown 扩展语法（`=== "tab"`、`!!! admonition`、`:l-icon:`…``、`++keys++` 等）以现有页面与 `app/utils/remark/**`、`app/utils/preprocess/**` 为准；改解析器时补边界测试。
- 用户未要求时不要自动 commit / push；要求提交时用普通 git，不要附加无关署名流程。

## 验证

改解析 / 工具函数后跑相关测试：`pnpm test`。涉及类型时再跑 `pnpm typecheck`。
