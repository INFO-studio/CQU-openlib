# 维护台表单

读取维护台「表单收集」的提交，按页面上的字段名打印，或沿同样的状态边做流转。命令在仓库根目录执行。

本地副本放在 `data/`。全量快照是 `data/submissions.json`。筛选后的导出也放这里，例如 `data/textbook.json`，不要写到 `/tmp` 或仓库根目录。`data/` 已在 `.gitignore` 里，里面有联系方式，不要提交，也不要贴到公开场合。

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

## 密钥

`--key` 传当天的完整密钥。否则用环境变量 `ADMIN_PAGE_TOKEN_PREFIX`，或相邻仓库 `CQU-openlib-api/.env` 里的同名变量，脚本拼上上海日期 `YYYYMMDD`。接口默认 `https://api.cqu-openlib.cn`，可用 `--api` 覆盖。

## 验证

```bash
pnpm exec tsx --test tools/form_utils/*.test.ts
```
