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
./pdfopt.sh run   "某教材.pdf" --max-mb 50 --ocr      # 自动求参命中上限
./pdfopt.sh run   "某教材.pdf" --pages 1-20,285 --ocr # 先抽几页看效果
./pdfopt.sh verify "out/某教材.pdf"                   # 逐页解码校验
./pdfopt.sh clean "某教材.pdf"                        # 清掉分页缓存
```

`run` 按 probe → plan → encode → assemble → ocr → verify 分阶段执行。每页产物在 `out/.pdfopt/` 缓存里，中断后重跑只补没做完的页。

## 子命令

| 命令 | 作用 |
| --- | --- |
| `probe` | 描述源文件，推荐 `--mode` |
| `plan` | 抽样求解参数，不跑全书 |
| `run` | 完整流水线 |
| `verify` | `qpdf --check` + 逐页解码 |
| `ocr-setup` / `ocr-check` | tessdata_best 模型 |
| `clean` | 删 `.pdfopt` 缓存 |

## `--ocr` 的体积余量

工具按 OCR 文本层约占 2% 预留。898 页实测 2.3MB（4.8%）。`--max-mb 50` 时组装到 47.7MB 已贴上限；宁可 `--max-mb 48` 先跑，避免 OCR 完再降参重编。

## 书签

pdfopt 重建 PDF **不搬书签**。页数一一对应（没用 `--pages`）时，从清理前的副本 `set_toc()` 补回，再 `save(garbage=4, deflate=True, use_objstms=1, clean=True)` 重存一遍，然后 `verify` 再覆盖 `out/`。示例见 [ad-removal.md](ad-removal.md) 末尾相关节。
