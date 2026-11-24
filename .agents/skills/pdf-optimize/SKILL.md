---
name: pdf-optimize
description: Guide for processing scanned textbook PDFs with tools/pdf_optimize (pdfopt) — ad removal before rasterization, continuous-tone JPEG 2000 for image-only scans, MRC/JBIG2 compression, OCR text layer decisions, and when NOT to re-encode. Use when cleaning, compressing, or OCR-ing PDFs under tools/pdf_optimize, or before uploading textbook PDFs to the site
---

# pdfopt — 扫描版 PDF 处理

工具位于 `tools/pdf_optimize/`，CLI 入口 `./pdfopt.sh`，负责把扫描版教材压到体积上限、保留或改善可读性、附可搜中文文本层，以及只清广告不重编码图像

## 动手前先读对应的那一份

| 你要做的事 | 读这个 |
| --- | --- |
| 装依赖、跑 probe/run/verify | [setup-and-usage.md](setup-and-usage.md) |
| 压体积、调 `--dpi` / `--photo-*` / `--mode` | [compression.md](compression.md) |
| 单图扫描、双色教材、MRC 误判、JPEG 2000 | [continuous-tone.md](continuous-tone.md) |
| 去广告、水印、超星信息页（**必须在 run 之前**） | [ad-removal.md](ad-removal.md) |
| 要不要 `--ocr`、已有文本层怎么处理 | [ocr.md](ocr.md) |
| 无书签时补全目录书签与页码标签 | [bookmarks.md](bookmarks.md) |
| 产物校验、输出路径、勿提交大文件 | [integrity.md](integrity.md) |
| 被否决路径与分书实测数据（AI 超分、曝光、材料力学 I、OCR 对比） | [benchmarks.md](benchmarks.md) |

不确定从哪开始先跑 `./pdfopt.sh probe 某.pdf`，再对照上表

## 决策顺序

1. **probe**：看页数、页框尺寸、原图像素、原生/等效 DPI、墨核灰度 `p0.5`、文本层/注释、推荐 `--mode` 与工作流
2. **查广告**（[ad-removal.md](ad-removal.md)）：有二次加工痕迹先清副本，栅格化会把广告烧进像素
3. **核查 DPI 与曝光**：页框尺寸写错会导致标称 DPI 失真（如 1888×2992 px 报约 96 DPI），结合原图像素、页面矩阵与 `p0.5` 判断，勿单凭页框推导 DPI 决定降采样或二值化
4. **选路径**：
   - 文件已不大、`probe` 推荐 `color` 且体积可接受、或原生只有 150 DPI：跳过 `run`，清广告后只用 `pdfopt ocr` 补文本层；字发灰用 `--text-contrast`，不用二值化
   - 每页单张全幅图、原像素质量高、双色底纹或工程图导致 MRC 误判：改读 [continuous-tone.md](continuous-tone.md)，优先 `pdfopt continuous` 保留连续灰阶
   - 其余情况：读 [compression.md](compression.md) 走 `pdfopt run`
5. **已有文本层**（[ocr.md](ocr.md)）：用书签算召回率，**≥ 70% 不重做 OCR**
6. **run / continuous → 补书签 → verify**：若 `probe` 报 `0 bookmark(s)`（无书签），交付前必须按 [bookmarks.md](bookmarks.md) 用 `pdfopt toc` 补全目录书签；最后校验见 [setup-and-usage.md](setup-and-usage.md) 与 [integrity.md](integrity.md)

## 硬约束

- 广告必须在 `run` 前清完，栅格化后无法再从图像流剥离
- 封面红字等可见广告可能是 PDF 文本对象而非烧进像素，优先删内容流保图像无损
- 150 DPI 已有 Acrobat OCR 层通常不重做（上采样到 300 DPI 不增加信息），标题页错字只手工重铺该页
- 二值化判据是墨核曝光而非 DPI：`p0.5 < 50` 可二值化，`p0.5 > 100` 或原生 150 DPI 勿二值化
- 不单凭局部锐度接受 MRC：无照片教材若几乎每页报图片区，或同段正文跨矩形边界灰阶突变，改走 `continuous`（验收时抽样检查区域边界与 `probe --per-page`）
- 无书签的教材交付前必须补全目录书签（用 `pdfopt toc` 视觉读目录页 + 偏移核验写入，勿直接用目录页原始 OCR 乱码生成）
- 禁用 AI 超分：只多恢复 1.1pp 字符却损失 −7dB PSNR 并编造笔画（[benchmarks.md](benchmarks.md)）

## 收录交付与命名

清完/压完的 PDF 由维护者上传拿 filekey，文档条目格式见 `.agents/skills/cqu-openlib-docs/`

最终交付文件统一命名为 `教材-{书名}-{第一作者}-{出版社}-{ISBN13}.pdf`：

- 书名、第一作者、出版社和 ISBN 以书名页或版权页为准（勿照抄流传文件名），去书名号和版次，只写第一作者
- ISBN 使用不带连字符的 13 位数字（中文教材通常 `9787` 开头，无「ISBN11」，勿截断或补位）
- 示例：`教材-工程热力学-曾丹苓-高等教育出版社-9787040645477.pdf`
