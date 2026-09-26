---
name: cqu-openlib-code-style
description: CQU-openlib 的 TypeScript、React 和 Node.js 代码书写范式。编辑 app/**、vite/**、TypeScript 工具、状态管理、数据转换、路由、组件或后端源码时使用；要求函数式优先、const 优先、箭头函数、适度使用 ts-pattern，并限制命令式循环和可变状态。
---

# CQU-openlib 代码范式

## 核心取向

优先写声明式、可组合、局部可推理的代码。允许为可读性承担少量运行时开销，不为微小性能收益引入共享可变状态或复杂控制流。热点路径仍以测量结果为准。

## 必须遵守

- 全量使用箭头函数。除框架或第三方 API 明确要求外，不新增 `function` 声明或表达式。
- 默认使用 `const`。只有变量必须跨步骤重新赋值时才使用 `let`；不使用 `var`。
- 优先使用 `map`、`filter`、`flatMap`、`reduce`、`some`、`every`、`find`、`Object.entries`、`Object.fromEntries` 与 `Set` / `Map` 组合表达转换。
- 优先让数据沿“输入 → 纯函数 → 输出”流动。把 DOM、网络、存储、日志和文件系统副作用集中在边界。
- 不修改传入数组、对象和集合。返回新值；确需就地修改时，将范围限制在刚创建、未泄露的局部对象内，并用注释说明原因。
- 用提前返回消除嵌套；让每个函数只承担一个可命名的转换或副作用。
- 使用判别联合表达状态，避免多个布尔值组成非法状态。

## ts-pattern

以下场景优先使用已安装的 `ts-pattern`：

- 对判别联合进行三种及以上分支匹配。
- 根据节点、请求、页面或状态的 `type` / `kind` 组合分发。
- 需要穷尽性检查的状态机和协议转换。
- 多字段条件需要结构化表达，普通条件链已难以一眼确认完整性。

优先使用 `.otherwise()` 而非 `.exhaustive()`，这能保证代码健壮性，`.otherwise()` 应为最广泛，最 default 的分支；或什么都不做（返回空值或 fallback）。同时由于短路原因，可以接受其表达式分支在前方出现，即两个完全相同分支，一个放在最前方判别，一个作为 `.otherwise()` 呈现

简单的一到两个布尔判断、空值回退、单字段提前返回继续使用 `if`、三元表达式或可选链。不要为了出现 `ts-pattern` 而增加抽象。

## 循环与可变状态

- 不新增可直接改写为清晰数组变换的 `for`、`for...of`、`for...in` 或 `while`。
- 只有短路、异步串行、复杂状态机、迭代器消费或性能测量证明必要时保留命令式循环。
- 必须使用循环时，把可变变量限制在函数内部，命名其不变量，并避免同时修改多个外部集合。
- 不把长链式调用压成一行。每个阶段有独立语义时拆成命名常量或小函数。

## React

- 派生值优先直接计算，近十分重量且可高频复用的使用 `useMemo`，不要用 Effect 同步可推导状态。
- 事件与异步流程使用小型箭头函数组合；共享逻辑下沉到纯函数或 hook。
- 复合交互优先 Base UI；样式与图标继续遵守项目 `AGENTS.md`。
- 保持 effect 依赖真实完整。若必须规避依赖规则，先重构函数边界，再考虑局部说明。

## 示例

优先：

`const visible = items.filter(isVisible).map(toViewModel);`

优先：

`match(state).with({ status: 'ready' }, renderReady).with({ status: 'error' }, renderError).otherwise(() => {});`

避免：

`let result = []; for (const item of items) { if (item.visible) result.push(toViewModel(item)); }`

## 提交前检查

- 搜索本次新增的 `let`、`for`、`while`、`function`，逐个确认必要性。
- 检查能否用判别联合或 `ts-pattern` 消除不完整分支。
- 运行相关测试、`pnpm typecheck` 和 `pnpm check`。
- 不为迎合本 Skill 重构任务范围之外的旧代码。
