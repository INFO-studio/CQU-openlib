---
name: cqu-openlib-code-style
description: CQU-openlib 的 TypeScript、React 和 Node.js 代码书写范式。编辑 app/**、vite/**、TypeScript 工具、状态管理、数据转换、路由、组件或后端源码时使用，要求函数式优先、const 优先、箭头函数、适度使用 ts-pattern，并限制命令式循环和可变状态
---

# CQU-openlib 代码范式

## 核心取向

代码以清晰易读、局部可推为主，可接受少量运行时开销，不为微优化引入共享可变状态或复杂控制流，热点以实测为准

## 必须遵守

- 只用箭头函数（框架或第三方 API 明确要求时才用 `function`）
- 默认使用 `const`；仅变量必须跨步骤重新赋值时用 `let`，禁用 `var`
- 优先使用 `map`、`filter`、`flatMap`、`reduce`、`some`、`every`、`find`、`Object.entries`、`Object.fromEntries` 与 `Set` / `Map` 组合表达转换
- 数据沿「输入 → 纯函数 → 输出」流动，把 DOM、网络、存储、日志和文件读写等副作用集中在边界
- 不修改传入数组、对象和集合，返回新值；确需就地修改时，限定在刚创建且未传出的局部对象内并加注释说明原因
- 提前返回减少嵌套，每个函数只承担一个可命名的转换或副作用
- 使用判别联合表达状态，避免多个布尔值拼出非法状态

## ts-pattern

以下场景优先使用已安装的 `ts-pattern`：

- 判别联合三种及以上分支匹配
- 按节点、请求、页面或状态的 `type` / `kind` 组合分发
- 状态机和协议转换的多分支分发
- 多字段条件组合，普通条件链难以一眼确认完整性

优先使用 `.otherwise()` 而非 `.exhaustive()` 以保证代码健壮性，`.otherwise()` 应放最广泛、默认的分支或空操作/fallback。因短路求值，允许把同一表达式既提前写在前面分支又作为 `.otherwise()` 兜底

一到两个布尔判断、空值回退或单字段提前返回继续用 `if`、三元表达式或可选链，不为出现 `ts-pattern` 而增加抽象

## 循环与可变状态

- 不新增可直接改写为清晰数组变换的 `for`、`for...of`、`for...in` 或 `while`
- 仅短路、异步串行、复杂状态机、迭代器消费或性能测量证明必要时保留命令式循环
- 循环内把可变状态限制在函数局部、起清楚变量名，不同时改多个外部集合
- 不把长链式调用压成一行，每个阶段有独立语义时拆成命名常量或小函数

## React

- 派生值优先直接计算，仅计算很重且高频复用时使用 `useMemo`，不用 Effect 同步可推导状态
- 事件与异步流程使用小型箭头函数组合，共享逻辑下沉到纯函数或 hook
- 复合交互优先 Base UI，样式与图标遵守项目 `AGENTS.md`
- 保持 effect 依赖真实完整；若必须规避依赖规则，先重构函数边界再考虑局部说明

## 示例

优先：

`const visible = items.filter(isVisible).map(toViewModel);`

`match(state).with({ status: 'ready' }, renderReady).with({ status: 'error' }, renderError).otherwise(() => {});`

避免：

`let result = []; for (const item of items) { if (item.visible) result.push(toViewModel(item)); }`

## 提交前检查

- 搜索本次新增的 `let`、`for`、`while`、`function`，逐个确认必要性
- 检查能否用判别联合或 `ts-pattern` 消除不完整分支
- 运行相关测试、`pnpm typecheck` 和 `pnpm check`
- 不为迎合本 Skill 重构任务范围之外的旧代码
