# 目录结构、链接与图标注册

## 目录地图

`public/doc/` 下有 7 个进导航的一级目录（对应 `app/lib/nav.ts` `NAV_SECTIONS`）：

| 目录 | 侧边栏标签 | 用途 |
| --- | --- | --- |
| `course/` | 课程 | 每门课一页，资源主体 |
| `academic/` | 学业 | 培养方案、专业总览、入学必看 |
| `club/` | 社团 | 社团介绍 |
| `skill/` | 技巧 | 工具与方法 |
| `life/` | 生活 | 校园生活、学生团体 |
| `contributor/` | 贡献者 | 每位贡献者一页 |
| `sundry/` | 杂项 | 说明书、更新日志、待办事项 |

- `public/doc/` 只放 Markdown，静态资源统一放 `public/assets/doc/`
- `42/` 不进主导航和搜索但可访问，改动**不得写进更新日志**
- `sundry/更新日志/` 进侧边栏但设了 `skipSearchPrefixes`，仅其 `index.md` 进搜索

## URL 映射与排序

`vite/docNavIndex.ts` `urlFromDocFile`：

| 文件 | URL |
| --- | --- |
| `public/doc/index.md` | `/` |
| `public/doc/course/高等数学.md` | `/course/高等数学` |
| `public/doc/sundry/说明书/index.md` | `/sundry/说明书` |

- 侧边栏标题 = 去扩展名文件名（目录取目录名，不读 `index.md` H1）；默认同级按 `localeCompare('zh-CN')` 排序，启用 `indexOrder` 的栏目递归采用目录 `index.md` 链接顺序（未列排末尾）；`course/` 在构建期按拼音首字母 A–Z + `#` 分组
- 页面正文标题优先取 AST 首个 H1，无 H1 回落侧边栏标题（课程页不写 H1，故文件名必须即课程名）
- 目录下有 `index.md` 时目录节点指向它，否则指第一个子页，`index.md` 不作单独叶子；`.` 开头的文件目录跳过

## 查课程号

`metadata/course-codes.json` 抽自 `public/doc/academic/专业培养方案/**`，key 为 `/course/页面名`，多课程号看 `labels` 对应开课名（查询命令见 [SKILL.md](SKILL.md)），勿凭课名或书名猜

## 站内链接

- **文档间**：相对路径 + `.md` 后缀（`[高等数学](../course/高等数学.md)`；`normalizeDocHref` 兼容无后缀但全库统一保留）
- **贡献者页**：文件名保留空格（`contributor/Leo Moore.md`），链接里空格写成 `%20`（`@ [Zhenghong Sun](../contributor/Zhenghong%20Sun.md)`）
- **锚点**：标题经 `app/utils/headingText.ts` `slugify` 生成（`## A. 镜像站` → `#a-镜像站`）；遇到 `#_6` 等旧 MkDocs 数字锚点顺手改成真锚点
- **站内工具路由**：绝对路径无后缀，共 5 个表单（slug 写错重定向到 `feedback`）：`[教材收集](/form/textbook)`、`[问题反馈](/form/feedback)`、`[文件上传](/form/upload)`、`[社团信息更正](/form/club)`、`[学生团体收录](/form/group)`。`/club/**` 与 `/life/学生团体/**` 页脚会自动注入对应链接；`/admin` 禁止写入任何读者文档与更新日志
- **资源文件**：走 API `[教材](https://api.cqu-openlib.cn/file?key=FILEKEY)`，filekey 由维护者给出勿自造

## 图片

放 `public/assets/doc/`，文档用绝对路径 `/assets/doc/...` 引用；正文图用 `.webp`，带 `{:download}` 原件可保留 SVG/PDF/PNG

命名规则「板块_路径_页面_序号」（中文板块名：`academic`→学业、`club`→社团、`life`→生活、`skill`→技巧、`contributor`→贡献者）；持续追加的月度事件在页面名后加 `YYYY-MM`；贡献者图片放 `public/assets/doc/contributor/<名字>/`：

```
学业_专业总览_数统_数统教材_001.webp
社团_文联_说唱社_002.webp
生活_谨防诈骗_2026-08_劣质床品诈骗_001.webp
42_index_001.webp
contributor/贡献者名/贡献者_贡献者名_001.webp
```

站点 logo（`public/assets/logo/`，由 `pnpm logo:generate` 维护）与 `public/favicon.png` 不参与 `image:optimize`

居中显示用 `<center><img src="/assets/doc/..." alt="pic001"></center>`；preview 与 `<ImageGallery>` 语法见 [markdown-syntax.md](markdown-syntax.md)。加完图必须跑一次（压至 1600px q80 WebP、改写引用并写入 `metadata/image-sizes.json` 防布局跳动）：

```bash
pnpm image:optimize   # 可先加 --dry 预览
```

## 加一个新图标

1. 确认 lucide 存在：`ls node_modules/lucide-react/dist/esm/icons/ | rg '^你要的名字'`
2. 在 `app/utils/parser/parserIcon.tsx` import 组件（PascalCase）并在 `STATIC_ICONS` 加 `'kebab-name': PascalName`，两处按字母序插入
3. 文档写 `:l-kebab-name:`
4. 跑 `pnpm test`

仅允许 `STATIC_ICONS` 白名单以保留 lucide tree-shaking（`app/lib/icons.ts` 只认 `l-` 前缀）。`app/tests/parser/iconCoverage.test.ts` 不扫全库，全库自查跑 `rg -o --no-filename -e ':l-[a-z0-9-]+:' public/doc | sort -u` 对 `STATIC_ICONS`；漏注册页面上会显灰色字面文本 `:l-xxx:`

## 构建期产物（勿手改）

| 产物 | 生成者 |
| --- | --- |
| `public/nav-index.json` | `vite/docNavIndex.ts` |
| `build/client/search/pagefind/**` | `vite/docSearch.ts` |
| `build/client/search/codes/*.json` | `vite/docSearch.ts` |
| `metadata/doc-folder-pages.json` | `vite/docSearch.ts` |
| `metadata/image-sizes.json` | `pnpm image:optimize` |
| `metadata/course-codes.json` | 从培养方案抽取，只读 |

`pnpm dev` 会监听 `public/doc` 并重建 nav 索引。`pnpm check` / biome 不校验 Markdown，文档格式靠先例与 `rg` 自查
