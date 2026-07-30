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

1. **只有「实质内容」发生变化时**，才维护 `updated`：
   - 已有 frontmatter → 把 `updated` 改成**当天**日期（`YYYY-MM-DD`）。
   - 没有 frontmatter → **补上**上述块（至少包含 `updated`）。
2. 实质内容 = 读者看到的信息本身变了：新增/删除/修改资源链接、教材、试卷、正文表述、结论等。
3. **不算实质内容，一律不要动 `updated`，也不要为此新建 frontmatter：**
   - 修缩进、空格、换行、列表层级等格式与排版修正
   - 错别字、标点修正
   - 为配合解析器改动而做的等价改写
4. 日期必须是合法的 `YYYY-MM-DD` 字符串；不要写成时间戳或其它格式。
5. **目录例外（通常不要加 / 不必更新 `updated`）：**
   - `public/doc/contributor/**`（贡献者个人页）
   - `public/doc/sundry/更新日志/**`（日志本身以路径/标题表达日期）
6. 用户明确要求不要动日期时，一律跳过。拿不准时**先问**，不要默认加日期。

可选字段（按需，勿虚构）：

- `description`：短描述
- `hide`：字符串列表（页面展示相关）

实现参考：`app/utils/docFrontmatter.ts`。

## 更新日志（`public/doc/sundry/更新日志/**`）

写给读者看的，不是 commit log。判断标准与上面的 `updated` 一致：**只记录站点「收录了什么内容」和「内容怎么呈现给读者」的变化。**

1. **写**：新增 / 更新 / 下线资源、页面、正文信息；影响内容能否被正确读到的渲染修复（某语法不生效、内容显示错误等）。
2. **不写**：重构、依赖升级、构建与 CI、测试、代码风格、性能与缓存优化，以及任何读者在文档页上看不到的改动。
3. **黑名单，一律不得出现在日志里：**
   - 管理页（`app/routes/admin.tsx` 等站内工具路由，含提交审核、表单后台）
   - `public/doc/42/**`（该目录不进侧边栏也不进搜索索引，见 `vite/doc-nav-index.ts` 的 `SKIP_DIRS`）
4. 一条改动一行，用相对链接指向被改的页面。日志正文不写 frontmatter（见上面的目录例外）。
5. **写一次日志要同步改三处，漏掉任何一处站点上就会对不上：**
   1. `public/doc/sundry/更新日志/YYYY/YYYY-MM/YYYY-MM-DD.md` —— 当天的日志文件，不存在就按这个路径新建。
   2. `public/doc/sundry/更新日志/index.md` —— 两个地方：顶部「最新更新日志」的链接改成当天；在对应「年 / 季度 / 月」的 tab 下补一行条目。新建季度或月份的 tab 时注意既有顺序：年、季度升序，季度内月份降序，月内日期升序。
   3. `public/doc/index.md` —— 首页「公告」里 `[更新日志](…) / [YYYY-MM-DD](…)` 那条的日期链接，同时把该文件 frontmatter 的 `updated` 改成同一天（首页不在目录例外里，照常规则走）。

## 文档与代码习惯（简）

- 优先改现有文件与既有写法；不要顺手大重构或扩写无关文档。
- Markdown 扩展语法（`=== "tab"`、`!!! admonition`、`??? admonition`（可折叠）、`` :l-icon:`文字` ``、`++keys++` 等）以现有页面与 `app/utils/remark/**`、`app/utils/preprocess/**` 为准；改解析器时补边界测试。
- 用户未要求时不要自动 commit / push；要求提交时用普通 git，不要附加无关署名流程。

## 验证

改解析 / 工具函数后跑相关测试：`pnpm test`。涉及类型时再跑 `pnpm typecheck`。
