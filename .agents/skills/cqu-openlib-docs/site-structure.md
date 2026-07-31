# 目录结构、链接与图标注册

## 目录地图

`public/doc/` 下有 7 个进导航的一级目录，对应 `app/lib/nav.ts` 的 `NAV_SECTIONS`：

| 目录 | 侧边栏标签 | 装什么 | 页面数量级 |
| --- | --- | --- | --- |
| `course/` | 课程 | 每门课一页，资源主体 | 3768 |
| `academic/` | 学业 | 培养方案、专业总览、入学必看 | 234 |
| `club/` | 社团 | 社团介绍 | 57 |
| `skill/` | 技巧 | 工具与方法 | 23 |
| `life/` | 生活 | 校园生活、学生团体 | 17 |
| `contributor/` | 贡献者 | 每位贡献者一页 | 28 |
| `sundry/` | 杂项 | 说明书、更新日志、待办事项 | 159 |

不进导航的目录（`vite/doc-nav-index.ts` 的 `SKIP_DIRS`，既不进侧边栏也不进搜索）：`assets`、`javascripts`、`resources`、`42`、`notice`。

`sundry/更新日志/` 是特例：**进侧边栏但不进搜索**（`SKIP_SEARCH_PREFIXES`），因为 130 多个日期标题的页面正文都是别处内容的摘要，会挤掉读者真正要找的页面。只有它的 `index.md` 进搜索。

`public/doc/42/**` 的任何改动**不得写进更新日志**。

## URL 映射

`vite/doc-nav-index.ts` 的 `urlFromDocFile`：

| 文件 | URL |
| --- | --- |
| `public/doc/index.md` | `/` |
| `public/doc/course/高等数学.md` | `/course/高等数学` |
| `public/doc/sundry/说明书/index.md` | `/sundry/说明书` |

侧边栏标题就是**文件名去掉扩展名**（目录节点用目录名，也不读 `index.md` 里的 H1）。所以文件名即标题，重命名文件等于改标题。同级按标题 `localeCompare('zh-CN')` 排序，不是文件系统顺序；`course/` 下的叶子还会在构建期烘焙拼音首字母，客户端按 A–Z 加 `#` 分组。

**页面正文的标题**是另一套：优先取 AST 里第一个 H1，没有 H1 才回落到侧边栏标题。课程页的惯例是不写 H1（只有 `## 资源` 这类二级标题），标题由文件名提供——所以课程页的文件名必须就是课程名。

目录下有 `index.md` 时，目录节点指向它；没有就指向第一个子页。`index.md` 自己不作为单独叶子出现。以 `.` 开头的文件和目录全部跳过。

## 查课程号（收录教材前必做）

课程号的权威来源是 `metadata/course-codes.json`，由 `public/doc/academic/专业培养方案/**` 抽取而来，覆盖 3643 门课、5550 个课程号。一条命令查：

```bash
python3 -c "
import json
d = json.load(open('metadata/course-codes.json'))['courses']
print(d.get('/course/泌尿系统与疾病'))
"
# {'codes': ['CM31005'], 'labels': {'CM31005': '泌尿系统与疾病'}}
```

key 是 URL 形式的 `/course/页面名`。一门课有多个课程号时（如高等数学有 8 个），`labels` 会告诉你每个号对应哪个具体开课名，据此决定写哪几个 tab。

**不要凭课程名猜课程号。** 书名和课程名一致也不代表课程号对得上——《泌尿系统与疾病》这本书属于 `CM31005`，而 `CM21120` 是「人体分子与细胞-1st」，两者只差一个字都不到。

## 站内链接

**文档之间**：相对路径 + 带 `.md` 后缀。站点会在渲染时转成路由链接。

```markdown
见 [高等数学](../course/高等数学.md) 与 [说明书](../../sundry/说明书/index.md)
```

`.md` 后缀其实可省（`normalizeDocHref` 两种都能转），但全库普遍带着，照抄先例。

**锚点**由标题文本 `slugify` 而来：去空白、转小写、空格换 `-`、丢掉除中文和 `\w-` 以外的字符（`app/utils/headingText.ts`）。`## A. 镜像站` → `#a-镜像站`。旧 MkDocs 时代的 `#_6` 这类数字锚点和新规则不兼容，全库残留 3 处，遇到就顺手改成真锚点。

**站内工具路由**：绝对路径、无后缀。共 5 个表单，slug 写错会被重定向到 `feedback`：

```markdown
[教材收集](/form/textbook)   [问题反馈](/form/feedback)   [文件上传](/form/upload)
[社团信息更正](/form/club)    [学生团体收录](/form/group)
```

`/club/**` 和 `/life/学生团体/**` 的页脚会自动注入对应表单链接，正文里不用重复写。`/admin` 是维护者后台，**任何读者文档和更新日志里都不要出现**。

**资源文件**：走 API，filekey 由维护者上传后给出，不要自己构造。

```markdown
[教材](https://api.cqu-openlib.cn/file?key=iALhU3zsk0zc)
```

## 图片

放在 `public/doc/resources/`，文档里用**绝对路径** `/doc/resources/...` 引用。全库 41 张图无一例外是 `.webp`。

命名规则是「板块_路径_页面_序号」，段之间下划线，板块名用中文：`academic` → 学业、`club` → 社团、`life` → 生活、`skill` → 技巧、`contributor` → 贡献者。

```
学业_专业总览_数统_数统教材_001.webp
社团_文联_说唱社_002.webp
42_index_001.webp
contributor/贡献者名/贡献者_贡献者名_001.webp
```

贡献者页的图放 `resources/contributor/<名字>/` 子目录。

例外：站点 logo 和 favicon 在 `public/doc/assets/`，由 `pnpm logo:generate` 维护，**不参与** `image:optimize`。`{:download}` 承诺了具体格式的下载文件（SVG、PDF、PNG 素材）也不要转 WebP，优化脚本本身会跳过它们。

居中显示用 HTML 块：

```markdown
<center><img src="/doc/resources/学业_专业总览_数统_数统教材_001.webp" alt="pic001"></center>
```

**加完图必须跑一次：**

```bash
pnpm image:optimize        # 加 --dry 先看会改什么
```

它会把光栅图压到 1600px 宽、q80 重编码成 WebP（原地替换）、**改写所有 Markdown 里的引用**，并把尺寸写进 `metadata/image-sizes.json`。渲染器靠这份清单在图片字节到达前先占好位置，不跑就会有布局跳动。

## 加一个新图标

`:l-xxx:` 不是直通 lucide 的，漏一步就会在页面上渲染成灰色的字面文本 `:l-xxx:`。

1. 确认 lucide 里有这个图标：`ls node_modules/lucide-react/dist/esm/icons/ | rg '^你要的名字'`。
2. 在 `app/utils/parser/parserIcon.tsx` 里 import 组件（PascalCase），并在 `STATIC_ICONS` 里加一行 `'kebab-name': PascalName`。两处都按字母序插入。
3. 在文档里写 `:l-kebab-name:`。
4. 跑 `pnpm test`。

图标短名的规则由 `app/lib/icons.ts` 定：**只认 `l-` 前缀**，`l-` 后面就是 lucide 的 kebab 名。`remarkIcon` 的正则也只匹配 `:l-xxx:`，所以正文里的 `8:00-8:30`、`:foo:` 不会被误当图标。

白名单是刻意的：lucide 有 1911 个图标、ESM 源 7.6MB，动态取会让 tree-shaking 失效、全量进 bundle。全库至今只用了 15 种图标，注册一行的成本远低于此。

`app/tests/parser/iconCoverage.test.ts` 守着注册表本身：每个键都要对应一个真的 import、键名合法且按字母序、教材页在用的图标都已注册。它**不扫全库**——读 4000 多个文档要几十秒，不值得压在每次 `pnpm test` 上。写了新图标想确认全库没有漏网的，跑这一行（不到 1 秒）：

```bash
rg -oh ':l-[a-z0-9-]+:' public/doc | sort -u
```

拿结果对一遍 `STATIC_ICONS`。漏注册的后果是页面上出现灰色字面文本 `:l-xxx:`，`pnpm dev` 打开页面就能看见。

## 构建期产物（不要手改）

| 产物 | 谁生成 |
| --- | --- |
| `public/nav-index.json` | `vite/doc-nav-index.ts`，每次 build / dev 改动重写 |
| `public/search/chunks/*.json` | 同上，搜索索引分片 |
| `metadata/doc-folder-pages.json` | 同上，内容变化时才写 |
| `metadata/image-sizes.json` | `pnpm image:optimize` |
| `metadata/course-codes.json` | 从培养方案抽取，只读 |

## 命令

```bash
pnpm dev         # 开发服务器，会监听 public/doc 并重建 nav 索引
pnpm test        # vitest，35 个文件
pnpm typecheck   # tsc
pnpm check       # biome check .（只管 JS/TS/JSON，不会碰 Markdown）
pnpm build       # 生产构建
```

没有任何脚本会格式化或 lint Markdown：`pnpm check` 只管 JS/TS/JSON，pre-commit hook 跑的也是 `biome check --write --staged`，同样绕过 Markdown 正文。所以文档的格式一致性只能靠抄先例和 `rg` 自查。
