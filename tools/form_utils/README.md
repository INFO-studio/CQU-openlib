# 维护台表单

读取维护台「表单收集」的提交，按页面上的字段名打印，或沿同样的状态边做流转。命令在仓库根目录执行。

本地副本放在 `data/`。全量快照是 `data/submissions.json`。筛选后的导出也放这里，例如 `data/textbook.json`，不要写到 `/tmp` 或仓库根目录。`data/` 已在 `.gitignore` 里，里面有联系方式与会话缓存，不要提交，也不要贴到公开场合。

## 快速开始

```bash
# 全量快照。用 tsx 写文件：pnpm 会先往标准输出打依赖检查，把 JSON 弄脏
./node_modules/.bin/tsx tools/form_utils/json.ts > tools/form_utils/data/submissions.json

pnpm form:list
pnpm form:list -- --type textbook --status pending_confirm
pnpm form:show -- --id 674abc
pnpm form:update -- 674abc pending_change
pnpm form:update -- 674abc completed --note "已写入课程页"
```

`--id` 和 `form:update` 的第一个参数可以是完整 id，或唯一后缀。后缀对上多条时更新会停下。

## 命令

| 命令 | 作用 |
| --- | --- |
| `pnpm form:list` | 每条一行：时间、类型、状态、摘要、id |
| `pnpm form:show` | 按维护台的中文字段打印回答 |
| `pnpm form:json` | JSON 数组，适合再导入 `data/` |
| `pnpm form:update` | 流转一条提交的状态 |

`list`、`show`、`json` 可用 `--type`（`feedback` `textbook` `upload` `club` `group`）和 `--status`（`pending_confirm` `pending_change` `invalid` `blocked` `completed`）筛选。

`form:update` 的状态也可以写中文名：等待确认、等待变更、表单无效、暂时阻塞、变更完成。等待确认只能进入后三者；后三者可以互转，也可以标为变更完成；变更完成只能回到这三者。`--note` 只在进入变更完成时写入。这个命令不改回答内容。

## 鉴权

脚本仅使用维护台「本地码 + 群码」会话鉴权（通过 `POST /admin/session` 换取 24 小时会话，并缓存在 `tools/form_utils/data/.session.json`）。凭证按以下优先级读取：

1. 命令行 `--token <会话 token>`，或环境变量 `ADMIN_SESSION_TOKEN`。
2. 命令行 `--local-code <8位本地码>` 与 `--group-code <4位群码>`。
3. 环境变量 `ADMIN_LOCAL_CODE` 与 `ADMIN_GROUP_CODE`。
4. 本仓库 `.env` 中的 `ADMIN_LOCAL_CODE` 与 `ADMIN_GROUP_CODE`（不带 `VITE_` 前缀，不会打入前端构建产物）。

接口默认 `https://api.cqu-openlib.cn`，可用 `--api` 覆盖。

## 验证

```bash
pnpm exec tsx --test tools/form_utils/*.test.ts
```
