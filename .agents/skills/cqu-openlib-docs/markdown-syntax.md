# 扩展语法

站点在标准 Markdown（remark + GFM）之上实现了一批 MkDocs / Material 风格的语法。实现分两层：`app/utils/preprocess/**` 先把这些块换成 HTML 注释哨兵，`app/utils/remark/**` 再重新组装成 AST 节点。改解析器时补边界测试。

## 内容 tab

```markdown
## 资源  
=== ":l-book:`MATH20041`"  
    * [教材](https://api.cqu-openlib.cn/file?key=AAA) - :l-book-open:`概率论与数理统计教程` - :l-user:`茆诗松` - :l-printer:`高等教育出版社`  
=== ":l-book:`MATH20042`"  
    * [教材](https://api.cqu-openlib.cn/file?key=BBB) - :l-book-open:`概率论与数理统计` - :l-user:`荣腾中` - :l-printer:`高等教育出版社`  
```

- 标记行是 `=== "标题"`，单引号 `=== '标题'` 也认，但引号必须成对（`=== "A'` 会退化成默认标题）。
- `===` 后面**必须有空格**再接内容：`==="A"`、`==== "A"` 都不成立。
- 标题里可以放行内代码和图标，课程页就是靠这个写 `:l-book:`课程号``。标题里放链接会让标记匹配提前中断。
- **tab 内容缩进 4 个空格**。规则上只要求比 `===` 行更深，但全库 1.3 万处 tab 都用 4 空格，照做。缩进变浅就关闭这一组。
- 嵌套 tab（更新日志 index 的年 / 季度 / 月）就是在 4 空格缩进的基础上再写 `===`：

```markdown
=== "2026年"
    === "第三季度"
        === "7月"
            * [2026-07-31](2026/2026-07/2026-07-31.md)
```

实现 `app/utils/remark/remarkContentTabs.ts` + `app/utils/preprocess/preprocessContentTabs.ts`，测试 `app/tests/remark/`。

## 折叠组

```markdown
^^^ 第一个标题
    第一项正文。

^^^ 第二个标题
    第二项正文，可以继续写列表：

    - A
    - B
```

- 标记行是 `^^^ 标题`，标题不能为空，`^^^` 后必须有空格。裸 `^^^`、`^^^^ 标题` 都是普通文本。
- 正文缩进 4 个空格；连续、同级的 `^^^` 会自动组成一个折叠组，各项可以分别展开。
- 标题支持普通行内 Markdown。正文支持段落、列表等块级语法。
- 折叠组和内容 tab 可以按缩进互相嵌套。
- 所有项默认收起，暂不提供默认展开标记。需要带提示色或默认展开的单个块时，使用下方的可折叠 Admonition，不要用折叠组模拟。

实现 `app/utils/remark/remarkCollapseGroup.ts` + `app/utils/preprocess/preprocessContentTabs.ts`，渲染 `app/components/ui/collapse-group.tsx`。

## Admonition

```markdown
!!! info "如果您知晓本门课程需要什么教材，欢迎[填表贡献](/form/textbook)，您只需要告知信息，并不必要持有pdf文件"
```

- 形式是 `!!! 类型 "标题"`，三部分都不能少。
- 标题**必须有，且必须用双引号**包裹。单引号标题和无标题的 `!!! info` 会被预处理认下、却过不了 remark 的 `ADMONITION_PATTERN`，结果静默失效。标题里可以写链接、行内代码、图标。
- 多行正文缩进 4 个空格：

```markdown
!!! warning "注意"
    第一段正文。

    第二段正文。
```

- 可折叠版本用 `???`（默认收起）和 `???+`（默认展开）：

```markdown
??? example "展开看例子"
    正文
```

支持的类型共 12 种，清单在 `app/utils/admonition.ts` 的 `ADMONITION_TYPES`：`note`、`abstract`、`info`、`tip`、`success`、`question`、`warning`、`failure`、`danger`、`bug`、`example`、`quote`。类型大小写不敏感（`Failure` 也能渲染），但**一律写小写**——全库已统一。未知类型按 `note` 的样式渲染。语料里最常用的是 `info`（3570 次，大半来自占位页）和 `warning`（196 次）。

**只能用空格缩进，不能用 tab 字符**——head 行的正则是 `/^( *)(?:!!!|\?\?\?\+?)\s+\S+(\s+".*")?\s*$/`，tab 缩进的 head 定不出正文该从第几列开始，会静默失效。

实现 `app/utils/remark/remarkAdmonition.ts` + `app/utils/preprocess/preprocessAdmonition.ts`，渲染 `app/components/ui/admonition.tsx`。

## 图标

```markdown
:l-book-open:`书名`
```

`:l-` 后面接 lucide 的 kebab 名。**只认 `l-` 前缀**，`:material-xxx:`、`:lucide-xxx:`、裸名 `:book:` 全都不是图标。正文里的 `8:00-8:30`、`:foo:` 也不会被误吞。

图标必须先在 `app/utils/parser/parserIcon.tsx` 的 `STATIC_ICONS` 注册，否则渲染成灰色字面文本。完整步骤见 [site-structure.md](site-structure.md)。

`STATIC_ICONS` 里注册了 17 个，语料实际在用 15 个（`arrow-left` 和 `frown` 是遗留，没有页面用）：`l-book`（课程号）、`l-circle-arrow-up`（学分）、`l-book-open`（书名）、`l-user`（作者）、`l-printer`（出版方）、`l-calendar`（学期）、`l-tag`（卷别）、`l-building-2`（学院）、`l-list-checks`（教材需求）、`l-file-text`（文档名）、`l-gallery-vertical-end`（版次）、`l-quote`（非书名的标题）、`l-message-square-text`（备注）、`l-scan-barcode`（ISBN）、`l-arrow-right`。

字段语义见 [entry-formats.md](entry-formats.md)，不要给同一语义换图标。

## 键盘键

```markdown
++ctrl+f++    ++cmd+spc++    ++win+i++    ++plus++    ++"My Key"++
```

pymdownx.keys 风格，token 用 `+` 分隔，别名表在 `app/lib/kbdKeys.ts`（`spc` → Space、`cmd` → Cmd）。多词键名用双引号包起来。只在普通文本里生效，代码块和行内代码里不处理，所以正文写 `C++` 不会被误当键帽。实现 `app/utils/remark/remarkKeys.ts`。

## 高亮与删除线

```markdown
{==这段会高亮==}
{!!这段是警示高亮!!}
{--这段是删除线--}
```

- `{==…==}`：普通强调，使用主色浅背景。
- `{!!…!!}`：警示强调，使用 `errorSoft` 背景和 `error` 字色。
- `{--…--}`：删除线。

`{++插入++}`、`{~~替换~~}` 没有实现，写了会原样显示。实现 `app/utils/remark/remarkFormatting.ts`。

## 属性列表

```markdown
* [下载-svg](/doc/resources/学业_重庆大学视觉形象/校徽/校徽_蓝色.svg){:download="校徽_蓝色.svg"}
<ImageGallery>
![第一张证据的图注](/doc/resources/生活_谨防诈骗_2026-08_劣质床品诈骗_001.webp){:preview}

![第二张证据的图注](/doc/resources/生活_谨防诈骗_2026-08_劣质床品诈骗_002.webp){:preview}
</ImageGallery>
```

`{:download="文件名"}` 让链接变成强制下载（视觉形象页的校徽等素材靠它，全库 72 处）。`{:preview}` 让图片可点击进入全屏预览，预览支持缩放、旋转、恢复和下载；点击图片与工具栏之外的背景可关闭。用 `<ImageGallery>` 与 `</ImageGallery>` 包住一组 preview 图片，会生成响应式 figure 画廊，图片 alt 文本就是图注；边界外的图片不会被隐式合并。`{.class}`、`{#id}`、`{:class="a b"}` 也支持。实现 `app/utils/remark/remarkAttrList.ts`。

两个硬性约束：属性块必须**紧挨**在链接或图片之后，中间隔了任何节点就失效；`download` **只对链接生效**，写在图片后没有作用。

带 `{:download=}` 的图片 URL 会被 `pnpm image:optimize` 跳过，不会被转成 WebP，所以 PNG / SVG / PDF 原件能留住。

## 四空格缩进不是代码块

CommonMark 里 4 空格缩进等于代码块，但本站禁用了这条规则（`app/utils/remark/remarkDisableIndentedCode.ts`），因为 MkDocs 风格的内容大量使用 4 空格缩进的列表和 tab 正文。

所以：**要写代码块必须用围栏** ```` ``` ````，不要靠缩进。

围栏在 tab、admonition、列表内部照常工作：CommonMark 的「缩进不超过 3 空格」是相对所在容器的内容基线算的，不是相对行首。所以 `=== "x"` 里缩进 4 空格的围栏、`* 项`下缩进 4 空格的围栏都成立，`public/doc/course/程序设计进阶实践.md` 等页面就是这么写的。真正要保证的是：**围栏的开始行和结束行缩进一致**，且不比容器基线更浅。

## HTML

单行的居中图片会被转成标准 Markdown 图片：

```markdown
<center><img src="/doc/resources/学业_专业总览_数统_数统教材_001.webp" alt="pic001"></center>
```

多行 `<figure>` 会被隔离处理（CommonMark 的 HTML 块会一直吃到空行，不隔离的话内部的 `![...](...)` 永远不会变成图片节点）。实现 `app/utils/preprocess/preprocessHtmlBlocks.ts`。

**HTML 注释会被直接删掉**（`app/utils/preprocess/stripHtmlComments.ts`），别拿 `<!-- TODO -->` 存待办，它不会出现在页面上也不会报错。待办写进 `public/doc/sundry/待办事项/`。

## 软换行

行尾两个空格是软换行。全库的资源条目行都以两个空格结尾（书目条目 341/349 有），新写的照做。

## 首页专属

`public/doc/index.md` 用 `<div class="docs-home-pair">` 让两个块在桌面端并排，并且可以写 `<HomeBookmarks />` 插入书签组件。**只有 PascalCase 的自闭合标签会被映射成组件，且注册表里目前只有 `HomeBookmarks`**（`app/utils/parser/parserHtml.tsx`）。别在其它页面模仿这套写法。

## 不支持的东西

写了不会报错，只会静默变成普通文本，别用：

- **数学公式**：没有 remark-math / KaTeX，`$x^2$`、`$$...$$` 原样显示。
- **GFM 单波浪删除线** `~文字~`：`singleTilde: false` 关掉了。双波浪 `~~文字~~` 可用，但和 `{--文字--}` 语义重复，删除线统一用 `{--...--}`。
- **`{++插入++}`、`{~~替换~~}`**：critic markup 只实现了高亮和删除两种。
- **`:material-xxx:`、`:fontawesome-xxx:`、裸名 `:book:`**：图标只认 `l-` 前缀。
- **`<!-- TAB -->` 等哨兵注释**：那是 preprocess 内部用的，作者手写会打乱组装。

GFM 表格、脚注、任务列表解析器都在，只是语料里目前一次都没用过——要用可以用。

## frontmatter

只认 `updated` 和 `description` 两个键。何时该动 `updated` 见 [updated-and-changelog.md](updated-and-changelog.md)。
