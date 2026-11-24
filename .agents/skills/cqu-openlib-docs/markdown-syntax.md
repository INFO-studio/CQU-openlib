# 扩展语法

站点在 CommonMark + GFM 之上实现了一批 MkDocs / Material 语法：`app/utils/preprocess/**` 先把块级结构替换为 HTML 注释哨兵，`app/utils/remark/**` 再重组为 AST。改解析器时补边界测试

## 内容 tab

```markdown
## 资源  
=== ":l-book:`MATH20041`"  
    * [教材](https://api.cqu-openlib.cn/file?key=AAA) - :l-book-open:`概率论与数理统计教程` - :l-user:`茆诗松` - :l-printer:`高等教育出版社`  
=== ":l-book:`MATH20042`"  
    * [教材](https://api.cqu-openlib.cn/file?key=BBB) - :l-book-open:`概率论与数理统计` - :l-user:`荣腾中` - :l-printer:`高等教育出版社`  
```

- 标记行 `=== "标题"`（单引号 `'标题'` 也可，引号须成对，`===` 后必须有空格，`==== "A"` 无效）
- 标题可含行内代码与图标，含链接会提前截断匹配
- 正文统一缩进 4 空格，缩进变浅即关闭该组；嵌套 tab 在 4 空格缩进后再写 `===`：

```markdown
=== "2026年"
    === "第三季度"
        === "7月"
            * [2026-07-31](2026/2026-07/2026-07-31.md)
```

实现 `app/utils/remark/remarkContentTabs.ts` + `app/utils/preprocess/preprocessContentTabs.ts`，测试 `app/tests/remark/`

## 折叠组

```markdown
^^^ 第一个标题
    第一项正文。

^^^ 第二个标题
    第二项正文：

    - A
    - B
```

- 标记行 `^^^ 标题`（标题非空且 `^^^` 后有空格；裸 `^^^`、`^^^^ 标题` 为普通文本）
- 正文缩进 4 空格，连续同级 `^^^` 自动成组，可与内容 tab 按缩进互嵌
- 标题支持普通行内 Markdown，正文支持块级语法；全部默认收起（无默认展开标记），需配色或默认展开改用可折叠 Admonition

实现 `app/utils/remark/remarkCollapseGroup.ts` + `app/utils/preprocess/preprocessContentTabs.ts`，渲染 `app/components/ui/collapse-group.tsx`

## Admonition

```markdown
!!! info "如果您知晓本门课程需要什么教材，欢迎[填表贡献](/form/textbook)，您只需要告知信息，并不必要持有pdf文件"
```

- 格式 `!!! 类型 "标题"`（可折叠用 `???` 默认收起、`???+` 默认展开）
- **标题必填且必须双引号包裹**（单引号或无标题会在 remark 层静默失效），可写链接、行内代码、图标
- 正文缩进 4 空格；**只能用空格缩进，禁止 tab 字符**（否则 head 行定不出正文起始列并静默失效）
- 支持 12 种类型（`app/utils/admonition.ts` `ADMONITION_TYPES`）：`note`、`abstract`、`info`、`tip`、`success`、`question`、`warning`、`failure`、`danger`、`bug`、`example`、`quote`；一律写小写，未知类型回退 `note`

实现 `app/utils/remark/remarkAdmonition.ts` + `app/utils/preprocess/preprocessAdmonition.ts`，渲染 `app/components/ui/admonition.tsx`

## 图标

```markdown
:l-book-open:`书名`
```

`:l-` 后接 lucide kebab 名，**只认 `l-` 前缀**（`:material-xxx:`、`:lucide-xxx:`、`:book:` 无效，`8:00-8:30`/`:foo:` 不误吞）。须先在 `STATIC_ICONS` 注册，步骤见 [site-structure.md](site-structure.md)，字段语义见 [entry-formats.md](entry-formats.md)

当前在用 15 个（`arrow-left`、`frown` 已注册但未用）：`l-book`（课程号）、`l-circle-arrow-up`（学分）、`l-book-open`（书名）、`l-user`（作者）、`l-printer`（出版方）、`l-calendar`（学期）、`l-tag`（卷别）、`l-building-2`（学院）、`l-list-checks`（教材需求）、`l-file-text`（文档名）、`l-gallery-vertical-end`（版次）、`l-quote`（非书名标题）、`l-message-square-text`（备注）、`l-scan-barcode`（ISBN）、`l-arrow-right`

## 键盘键

```markdown
++ctrl+f++    ++cmd+spc++    ++win+i++    ++plus++    ++"My Key"++
```

pymdownx.keys 风格，别名表见 `app/lib/kbdKeys.ts`（`spc` → Space、`cmd` → Cmd）；多词键名用双引号。代码块和行内代码内不处理（`C++` 安全）。实现 `app/utils/remark/remarkKeys.ts`

## 高亮与删除线

```markdown
{==普通强调==}  {!!警示强调!!}  {--删除线--}
```

`{++插入++}`、`{~~替换~~}` 未实现；实现 `app/utils/remark/remarkFormatting.ts`

## 属性列表

```markdown
* [下载-svg](/assets/doc/学业_重庆大学视觉形象/校徽/校徽_蓝色.svg){:download="校徽_蓝色.svg"}
<ImageGallery>
![第一张图注](/assets/doc/生活_谨防诈骗_2026-08_劣质床品诈骗_001.webp){:preview}

![第二张图注](/assets/doc/生活_谨防诈骗_2026-08_劣质床品诈骗_002.webp){:preview}
</ImageGallery>
```

- `{:download="文件名"}`：强制下载（**仅对链接生效**，图片后无效；带此属性的下载链接会跳过 `pnpm image:optimize` 的 WebP 转换）
- `{:preview}`：点击全屏预览（支持缩放、旋转、恢复、下载，点背景关闭）；`<ImageGallery>` 包住一组 `{:preview}` 图生成响应式画廊，alt 为图注，边界外不合并
- 也支持 `{.class}`、`{#id}`、`{:class="a b"}`
- 硬约束：属性块必须**紧挨**在链接或图片之后。实现 `app/utils/remark/remarkAttrList.ts`

## 四空格缩进不是代码块

`app/utils/remark/remarkDisableIndentedCode.ts` 禁用了 CommonMark 4 空格缩进代码块，**代码块必须用围栏 ```` ``` ````**。在 tab、admonition、列表内使用时，起止围栏缩进须一致且不浅于所在容器内容基线

## HTML

- 单行 `<center><img src="/assets/doc/..." alt="pic001"></center>` 会转为居中 Markdown 图片
- 多行 `<figure>` 由 `app/utils/preprocess/preprocessHtmlBlocks.ts` 隔离，否则内部 `![...](...)` 不解析
- HTML 注释会被 `app/utils/preprocess/stripHtmlComments.ts` 直接删掉，待办勿写进注释，应写入 `public/doc/sundry/待办事项/`

## 软换行

行尾两个空格是软换行，资源条目末尾均须保留

## 文档内 React 组件

`public/doc/index.md` 支持 `<div class="docs-home-pair">` 与 `<HomeBookmarks />`，`public/doc/life/校车时刻表.md` 支持 `<BusTimeTable />`。仅 `app/utils/parser/parserHtml.tsx` 白名单列出的 PascalCase 自闭合标签会被映射为组件

## 不支持的东西

写了会静默变成普通文本：

- 数学公式（无 remark-math / KaTeX，`$x^2$`、`$$...$$` 原样显示）
- GFM 单波浪删除线 `~文字~`（`singleTilde: false`；删除线统一用 `{--...--}`）
- `{++插入++}`、`{~~替换~~}`、非 `l-` 前缀图标、手写 `<!-- TAB -->` 等内部哨兵注释

GFM 表格、脚注、任务列表解析器均可用

## frontmatter

支持字段、`search.*` 与 `updated` 规则见 [updated-and-changelog.md](updated-and-changelog.md)
