# 连续灰阶扫描与 JPEG 2000

## 适用条件

以下条件同时成立时优先用 `pdfopt continuous`：

- 纯扫描件，每页恰好一张铺满页面的图像
- 原图像素足够，主要问题是文件超体积上限
- 内页为黑白或双色印刷，保留抗锯齿、浅底纹与细工程线优先于保留彩色
- MRC 将浅色栏、网底、二维码或密排正文误判为图片区，或低质量整页 JPEG 文字边缘糊化/振铃不可接受

禁用场景（复杂页面命令会报错，不静默丢内容）：

- 单页多图、含矢量内容、链接、批注、透明蒙版或已有文本层
- 正文颜色承载语义，不能转灰度
- 需保留交互表单、附件或复杂页面对象

## 为什么不用 MRC 或低质量 JPEG

- **MRC 否决信号**（命中任一即否决，验收以整页一致性为准）：无照片教材几乎每页检出图片区；同段正文一半纯黑白一半灰度；浅蓝栏目/标题底纹/二维码周出现明显矩形编码边界；放大后正文粗细或底色在矩形边界两侧跳变
- **PDF 标称 DPI 陷阱**：`probe` 的 native DPI 由「图像像素 ÷ PDF 页面物理尺寸」计算，页框 MediaBox 写错会导致 1888×2992 px 清晰扫描报约 96 DPI。每页全幅图需同步核查原始像素尺寸、页面矩阵与铺满状态、1:1 小字细线及是否发生误渲染放大
- **位深 vs 码率**：1-bit 二值化会不可逆丢失抗锯齿，3-bit 只有 8 级灰度易断档，故保留 8-bit 灰度并用 JPEG 2000 码率控制体积，不把整页 JPEG 压到 q52

## 工具路径

先抽样（覆盖封面、版权页、普通正文、密排正文、公式、工程图、表格、二维码、附录、封底）：

```bash
./pdfopt.sh continuous "原稿.pdf" \
  --pages 1-10,31,71,191,351,397,406 \
  --psnr 38 \
  --auto-colour \
  --out /tmp/preview.pdf
./pdfopt.sh verify /tmp/preview.pdf
```

确认后处理全书（不传 `--psnr`/`--ratio` 时默认二分求解命中 `--max-mb` 的最高 PSNR）：

```bash
./pdfopt.sh continuous "原稿.pdf" \
  --auto-colour \
  --out "out/教材.no-ocr.pdf"
```

需要 OCR 时从原稿识别、写入压缩稿：

```bash
./pdfopt.sh ocr "out/教材.no-ocr.pdf" \
  --ocr-source "原稿.pdf" \
  --out "out/教材.pdf"
```

`continuous` 通过 `pikepdf` 原位替换 Image XObject，不改像素尺寸、不经 PDF 渲染、不做阈值或区域检测，保留 `/Rotate`、`cm` 变换矩阵、书签、页码标签与元数据。保留的彩页（`--keep-first-colour`/`--keep-last-colour`/`--auto-colour`）直接保持原始 XObject 字节流；其余页解析 `/Decode`、CMYK 与 ICC 后转 8-bit 灰度 JPEG 2000，支持 `--workers` 并行

## 参数选择

优先用 `--psnr`（或省略自动求解）：恒定画质下空白页与稀疏扉页仅占 `<1 KB`，把字节留给密排正文与工程图；固定 `--ratio` 会给带轻微纸噪的空白页分配同样高码率

- 自动模式：省略 `--ratio`/`--psnr`，按 `--max-mb`（预留 4% 结构与 OCR 余量）二分求解 `32–44 dB` 最高 PSNR
- 手工 PSNR：从 `--psnr 38` 起试（`36–40 dB` 区间对比 1:1 笔画裁切）
- 手工倍率：`--ratio` 越大体积越小、损失越多，可试 `20–26`
- `--auto-colour` 按页自动保留书内偶有彩色插图的原流；`--keep-first-colour N` / `--keep-last-colour N` 按源 PDF 页序计数（无色彩信息的版权页不保留 RGB）

## 抽样验收与完整性检查

必须同时看整页（是否缺页、裁切、旋转或改版式）和 1:1 原像素裁切（小字横竖笔画、公式上下标、工程图细线、表格网格及浅蓝底纹转灰后层次），对比倍率时固定同页、同坐标、同缩放比例，以笔画和灰阶忠实度为准而非锐度

全书完整校验命令与 7 项核对清单见 [integrity.md](integrity.md)，《材料力学 I》路径对比实测见 [benchmarks.md](benchmarks.md)
