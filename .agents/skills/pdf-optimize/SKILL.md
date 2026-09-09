---
name: pdf-optimize
description: Guide for processing scanned textbook PDFs with tools/pdf_optimize (pdfopt) — ad removal before rasterization, MRC/JBIG2 compression for size limits, OCR text layer decisions, and when NOT to re-encode. Use when cleaning, compressing, or OCR-ing PDFs under tools/pdf_optimize, or before uploading textbook PDFs to the site.
---

# pdfopt — 扫描版 PDF 处理

工具在 `tools/pdf_optimize/`，CLI 入口 `./pdfopt.sh`。把扫描版教材压到体积上限、让文字更清晰、附可搜中文文本层；也覆盖**只清广告不动像素**的路径。

实测 626 页医学教材：**584MB → 45MB（13×）**，文字 300 DPI，彩色图区原样保留。

## 动手前先读对应的那一份

| 你要做的事 | 读这个 |
| --- | --- |
| 装依赖、跑 probe/run/verify | [setup-and-usage.md](setup-and-usage.md) |
| 压体积、调 `--dpi` / `--photo-*` / `--mode` | [compression.md](compression.md) |
| 去广告、水印、超星信息页（**必须在 run 之前**） | [ad-removal.md](ad-removal.md) |
| 要不要 `--ocr`、已有文本层怎么处理 | [ocr.md](ocr.md) |
| 产物校验、输出路径、勿提交大文件 | [integrity.md](integrity.md) |

不确定从哪开始：先 `./pdfopt.sh probe 某.pdf`，再对照上表。

## 决策顺序（别跳步）

1. **probe** — 页数、原生 DPI、有没有文本层、该用哪个 `--mode`。
2. **查广告** — 见 [ad-removal.md](ad-removal.md)。有二次加工痕迹就先清副本；**栅格化会把广告烧进像素**。
3. **决定要不要 run** — 文件已经很小、probe 推荐 `color` 且体积可接受、**或原生只有 150 DPI** → 只做第 2 步，再用 `pdfopt ocr` 补文本层（普通地质学：150 DPI / 50MB；新能源材料与器件：150 DPI / 25MB）。150 DPI 的中文扫描二值化必然更难读，见 [compression.md](compression.md) 开头。字发灰是曝光问题，用 `--text-contrast` 修，别用阈值。
4. **已有文本层时** — 见 [ocr.md](ocr.md) 用书签算召回率；**70% 以上别重做 OCR**。
5. **run → verify** — 见 [setup-and-usage.md](setup-and-usage.md)、[integrity.md](integrity.md)。

## 三条铁律

**一、广告必须在 `run` 之前清。** pdfopt 会栅格化整页，之后广告摘不出来。

**二、别假设字一定烧进像素。** 封面红字网盘链接可以是 PDF 文本对象（`0 Tr` 可见块），删内容流即可，图像流一个字节不动。

**三、已有 Acrobat OCR 层时，重做常常是倒退。** 150 DPI 源图上采样到 300 DPI 喂 tesseract 不会增加信息。标题页错得离谱的可以手工重打几行，正文层别整本替换。

**四、二值化不是默认动作，判据是曝光而非 DPI。** 先量正文页的墨核灰度：50 以下（机械设计基础 240 DPI，19–41）二值化是净收益，58.7 → 16.0MB 且更锐；100 以上（新能源材料与器件 150 DPI，128）笔画已和纸面糊在一起，灰度的抗锯齿就是笔画位置信息，切掉换不回来——任何参数都救不了，别在参数上耗时间。

**五、AI 超分不要用。** 已用原生 300 DPI 的书造真值实测：Real-ESRGAN 只多恢复 1.1 个百分点的字符，代价 −7dB PSNR，放大能看到编出来的笔画。详见 [compression.md](compression.md)。

## 收录到站点时

清完/压完的 PDF 由维护者上传拿 filekey；文档条目格式见 `.agents/skills/cqu-openlib-docs/`。ISBN 和出版社以书上印的为准，不要照抄流传文件名。
