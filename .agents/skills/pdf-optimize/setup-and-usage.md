# 安装与基本用法

## 依赖

```bash
brew install jbig2enc qpdf
brew install tesseract tesseract-lang        # 只有 --ocr 需要

cd tools/pdf_optimize
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
./pdfopt.sh ocr-setup                        # 拉 tessdata_best，见 ocr.md
```

## 常用命令

```bash
./pdfopt.sh probe "某教材.pdf"                        # 先看它是什么、该用哪个 mode
./pdfopt.sh run   "某教材.pdf" --max-mb 100 --ocr     # 自动求参命中上限
./pdfopt.sh run   "某教材.pdf" --pages 1-20,285 --ocr # 先抽几页看效果
./pdfopt.sh continuous "某教材.pdf" --auto-colour      # 单图扫描：自动求 PSNR（或指定 --ratio/--psnr）
./pdfopt.sh ocr   "某教材.clean.pdf"                  # 只补文本层，不重编码图像
./pdfopt.sh ocr   "压缩稿.pdf" --ocr-source "原稿.pdf" # 从原稿识别，写入压缩稿
./pdfopt.sh toc pages "out/某教材.pdf" --pages 1-16   # 无书签时导出目录页供读取
./pdfopt.sh toc apply "out/某教材.pdf" --from toc.txt --offset 9 --page-labels
./pdfopt.sh verify "out/某教材.pdf"                   # 逐页解码校验
./pdfopt.sh clean "某教材.pdf"                        # 只清该书分页缓存（--all 清全部）
```

`run` 按 probe → plan → encode → assemble → ocr → verify 分阶段执行，编码与 OCR 均有按页缓存（`out/.pdfopt/`），中断后重跑只补未完成页

## 子命令

| 命令 | 作用 |
| --- | --- |
| `probe` | 描述源文件、曝光、像素与页框异常，推荐 `--mode` 与工作流 |
| `plan` | 抽样求解参数，不跑全书（输出可直接复现的命令） |
| `run` | MRC/JBIG2 或整页 JPEG 流水线（自动保留书签/元数据/页码标签） |
| `continuous` | 每页单张全幅图时保留原像素与原流彩页，其余页原位换 8-bit 灰度 JPEG 2000（[continuous-tone.md](continuous-tone.md)） |
| `ocr` | **只加文本层**，图像流一字节不动；`--ocr-source 原稿.pdf` 可从未压缩原稿识别 |
| `toc` | 查看（`show`）、导出目录页图（`pages`）、无损写入书签与 PageLabels（`apply`），详见 [bookmarks.md](bookmarks.md) |
| `verify` | `qpdf --check` + 滤镜版本校验 + 逐页解码 |
| `ocr-setup` / `ocr-check` | 安装与校验 tessdata_best 模型 |
| `clean` | 删该书 `.pdfopt` 缓存（`--all` 清空全部） |

## `--ocr` 的体积余量

工具按 OCR 文本层预留 4% 预算（`OCR_RESERVE = 0.04`，898 页实测 2.3MB / 4.8%），上限贴满时仍建议留出余量防超标

## 书签

- 原书已有书签：`run` 与 `continuous` 默认自动搬回书签、DocInfo 元数据与全书 PageLabels（`--pages` 子集也会重映射对应书签）；仅剔除广告书签时按 [ad-removal.md](ad-removal.md) 用 `set_toc()` 覆写
- 原书无书签：交付前按 [bookmarks.md](bookmarks.md) 用 `pdfopt toc pages` + `pdfopt toc apply` 补全书签与逻辑页码标签
