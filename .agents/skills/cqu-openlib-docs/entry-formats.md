# 资源条目格式

资源条目一行一条，字段以 ` - `（空格+连字符+空格）分隔，每段为 `:l-图标:` 紧跟反引号包裹的值

## 教材 / 书目

```markdown
    * [教材](https://api.cqu-openlib.cn/file?key=FILEKEY) - :l-book-open:`书名` - :l-user:`第一作者` - :l-printer:`出版社`␠␠
```

`␠␠` 为**行尾双空格**，必留

### 字段

| 顺序 | 图标 | 内容 | 必填 |
| --- | --- | --- | --- |
| 1 | `:l-book-open:` | 书名 | 是 |
| 2 | `:l-user:` | 第一作者 | 是 |
| 3 | `:l-printer:` | 出版方（书上印的单位） | 是 |
| 4 | `:l-gallery-vertical-end:` | 版次 | 可选 |
| 5 | `:l-scan-barcode:` | ISBN13 | 可选 |

顺序固定，缺省可选字段连 ` - ` 省略。全字段示例：

```markdown
    * [教材](https://api.cqu-openlib.cn/file?key=FILEKEY) - :l-book-open:`泌尿系统与疾病` - :l-user:`第一作者` - :l-printer:`人民卫生出版社` - :l-gallery-vertical-end:`第2版` - :l-scan-barcode:`9787117325745`␠␠
```

### 逐字段规则

- **书名**：不加《》；分册全角括号 `高等数学（上）`；版次放第 4 字段；`（C语言版）`、`（Verilog版）`、`（MySQL版）` 属书名本体保留
- **作者**：**仅第一作者**（不用「、」「,」「等」）；编写组带书名号 `《西方经济学》编写组`、`2023版编写组`；外文作者照原印文字，不译不缩写
- **出版方**：写全称；多家用 `&`（`高等教育出版社&人民出版社`）；校内讲义写院系（`重庆大学自动化学院`）
- **版次**：**仅用户明说「第几版」时录**（勿据 ISBN/出版时间/网页/PDF 自补）；写 `第N版`（阿拉伯数字，「第七版」→`第7版`）
- **ISBN**：13 位纯数字，不加 `ISBN` 前缀

### 链接文本、附属文件与备注

链接文本默认 `[教材]`；分册 `[教材上册]`/`[教材中册]`/`[教材下册]`；同书不同版 `[教材（原版）]`/`[教材（重排）]`；其它 `[实验教材]`、`[习题集]`、`[教辅]`、`[参考教材]`

习题解答/习题集挂教材下作子列表，只给链接，不重复元信息；备注写整行末全角括号，勿进反引号：

```markdown
    * [教材上册](https://api.cqu-openlib.cn/file?key=AAA) - :l-book-open:`高等数学（上）` - :l-user:`第一作者` - :l-printer:`高等教育出版社`␠␠
        * [高等数学上册习题解答](https://api.cqu-openlib.cn/file?key=BBB)
- [教辅](https://api.cqu-openlib.cn/file?key=CCC) - :l-book-open:`概率论与数理统计《原神》版教学辅导用书` - :l-user:`展未央` - :l-printer:`须弥教会院出版社`（内容确实很牛）
```

## 试卷

```markdown
        * [试卷+答案](https://api.cqu-openlib.cn/file?key=FILEKEY) - :l-calendar:`2024秋` - :l-tag:`A卷`␠␠
```

- 链接文本三选一：`试卷+答案`、`试卷`（无答案）、`答案`（仅答案）
- `:l-calendar:` 学期：`2024秋`、`2021春`（年份+春/秋，无空格）
- `:l-tag:` 卷别：`A卷`、`B卷`；无答案行尾补 `（暂无答案）`
- 多学院出卷在学期与卷别间插 `:l-building-2:` 接 `` `学院名` ``：

```markdown
        * [试卷+答案](https://api.cqu-openlib.cn/file?key=FILEKEY) - :l-calendar:`2025秋` - :l-building-2:`数统学院` - :l-tag:`A卷`␠␠
```

## 其它字段

`:l-file-text:` 标文档资源名；`:l-quote:` 仅用于非书名标题位（占位、试卷范围、笔记标题），出版物用 `:l-book-open:`：

```markdown
    * [文档](https://api.cqu-openlib.cn/file?key=FILEKEY) - :l-file-text:`学堂在线答案`␠␠
```

## 贡献者署名

名单、日志与资源条目署名相互独立

**教材默认不在条目末尾署名**（普通上传、代收或转交公开电子版只记名单与日志），仅同时满足两项才署：1. 电子版此前无法在公开网络找到；2. 信息提供者本人扫描

```markdown
    * [教材](https://api.cqu-openlib.cn/file?key=FILEKEY) - :l-book-open:`书名` - :l-user:`第一作者` - :l-printer:`出版社` @ [贡献者名](../contributor/贡献者名.md)␠␠
    * [公式汇总](https://api.cqu-openlib.cn/file?key=FILEKEY) @ [贡献者名](../contributor/贡献者名.md)␠␠
```

`@` 后**必留一空格**（勿写 `@[名字]`）；无个人页写 `@ 名字`

### 贡献者名单顺序

`public/doc/contributor/index.md` 分两段连续排列且不加小标题（上段有个人简介页链接，下段无简介页纯文本）：

- 段内按首次收录时间升序，新贡献者追加对应段尾，不按姓名、次数或活跃度重排
- 改名不动原位置；补建简介页时移入上段按首次收录位（无法确认历史顺序放上段末）
- 仅用户明定顺序或确认历史错序才调整
- 「有个人简介」以实际存在且有内容的 `public/doc/contributor/<名字>.md` 为准（仅名单链接、空文件或占位页不算）

## 分组小节

资源多用裸文本列表项分组，已有组名：`期末试卷`、`期中试卷`、`课件`、`学长共享资源`、`实验报告参考`、`代码参考`、`真题`

```markdown
    * 期末试卷
        * [试卷+答案](...) - :l-calendar:`2023秋` - :l-tag:`A卷`␠␠
        * [试卷](...) - :l-calendar:`2022秋` - :l-tag:`B卷`（暂无答案）␠␠
```

同 tab 多类资源按序排：**教材（含教辅/习题集/实验教材）→ 课件 → 试卷（`期中试卷`/`期末试卷`/`真题`）→ 其它拓展资源**（`课件` 必在 `期末试卷` 前）

## 课程页骨架

```markdown
---
updated: 2026-07-31
---

## 资源  
=== ":l-book:`课程号`"  
    * [教材](...) - :l-book-open:`书名` - :l-user:`作者` - :l-printer:`出版社`  
```

- 二级标题仅用 `## 攻略`、`## 资源`、`## 课外资源`，固定顺序，行尾双空格
- ``=== ":l-book:`课程号`"`` 内容缩进 4 空格；多课程代码 tab 按**字母前缀升序、数字升序**排（如 `EE30011` 在 `OE31600` 前，非课程代码 tab 不适用）
- 课程号查 `metadata/course-codes.json`（命令见 [SKILL.md](SKILL.md)），勿编

### 占位页与待办序号

```yaml
---
placeholder: course
---
```

- 占位页保留已有 `updated` 等元数据并追加 `placeholder: course`（正文源自 `app/utils/placeholderMap.ts`，不进全文索引）；加真实资源时整页替换成骨架并删 `placeholder`
- 已知教材无文件仅记入 `sundry/待办事项/textbook.md`，课程页维持 `placeholder: course`，不复制书目或待办号；已有其它资源页也不写「未能收集到电子版」或空链接 `[教材]()`
- `legacy#134` 为旧问卷号不再新增；站内表单 `#abcdefgh` 取提交 id 末 8 位（QQ 通知 `ID：xxxxxxxx`，见 `CQU-openlib-api` `src/lib/notifySubmission.ts`）
- 引用放链接后作行内代码，**禁写锚点**（仅标题经 `app/utils/headingText.ts` `slugify` 生成 id，列表项无 id）：

```markdown
详见[教材收集](../sundry/待办事项/textbook.md) `legacy#138`
完成 [待办事项-教材需求](../../../待办事项/textbook.md) `legacy#134`
```

待办条目本身不署贡献者，登记与兑现均写日志（[updated-and-changelog.md](updated-and-changelog.md)）

## 文件链接

filekey 由维护者给出勿自造（`https://api.cqu-openlib.cn/file?key=FILEKEY`）；文档间相对 `.md`（`../contributor/贡献者名.md`），站内工具绝对无后缀（`/form/textbook`），锚点与表单 slug 见 [site-structure.md](site-structure.md)
