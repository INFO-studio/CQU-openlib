# OCR 文本层

文本层由本工具直接铺设，不走 ocrmypdf

## 为什么自己铺

- **防 CJK 空格**：通用 OCR 工具按词定位导致 PDF 抽取还原几何缝隙成 `浙 江 大 学 医学 院`，本工具按行输出连续文本段，CJK 无分隔、Latin 保留空格
- **从原稿识别**：JBIG2 二值化对 tesseract 是噪声，必须从原始扫描识别，且调节压缩参数不会悄悄改变可搜文本
- **默认 `--psm 4`（单列）**：相比 `psm 3`（遇页边人像易切碎乱序），抽样 10 页多 6% 汉字且拉丁误判减半

目标 PDF 已压缩时用 `--ocr-source` 指向未压缩原稿（两份 PDF 页数必须一致）：按目标页宽高映射写入，目标图像流不动。`--ocr-dpi` 默认自适应（单图页不超过原图像素与 300 DPI 较小值，避免 150 DPI 上采样降质与畸形页框爆内存）；目标已有文本层默认报错保护，加 `--force` 才强制叠加。OCR 按页缓存在 `out/.pdfopt/ocr-*`，中断可续传（`--no-cache` 跳过）：

```bash
./pdfopt.sh ocr "out/教材.no-ocr.pdf" --ocr-source "原稿.pdf" --out "out/教材.pdf"
```

## 模型

`brew install tesseract-lang` 默认带 2019 `tessdata_fast`，中文粗体标题常变拉丁乱码。`./pdfopt.sh ocr-setup` 在 `tools/pdf_optimize/tessdata/` 镜像系统目录并用 `tessdata_best` 覆盖

必须是**完整镜像**（含 `configs/`、子语言如 `chi_sim_vert`），不能只放 `.traineddata`；缺文件时 tesseract 退出码 0 但不识别，`ocr-setup` 结尾含冒烟测试

```bash
./pdfopt.sh ocr-check
./pdfopt.sh run x.pdf --ocr --ocr-langs chi_sim+eng --ocr-psm 4
```

## 已有文本层：先量化再决定

`probe` 报 `text layer: yes` 先停。原生 150 DPI 若带 Acrobat Paper Capture 层（看 `metadata.producer`），上采样到 300 DPI 重跑 `tessdata_best` 通常全面倒退（60 页抽样书签召回 `74.0% vs 55.3%`，详表见 [benchmarks.md](benchmarks.md)）

勿凭翻几页目测（单页偏差样本很常见），用书签当标准答案算召回率：

```bash
.venv/bin/python - <<'PY'
import re
import pymupdf as fitz
doc = fitz.open("某教材.pdf")
noise = re.compile(r"[\s\u3000·．.…（）()、，,;:：0-9a-zA-Z]")
hit = total = 0
for _, title, page in doc.get_toc():
    total += 1
    hit += noise.sub("", title) in noise.sub("", doc[page - 1].get_text())
print(f"书签标题召回: {hit}/{total} = {hit / total:.1%}")
PY
```

- **≥ 70%**：别重做 OCR；标题页错字可手工重铺几行（[ad-removal.md](ad-removal.md)）
- **≤ 40%** 或 `fast` 模型拉丁乱码严重：值得 `--ocr`

目录页（多点线、双栏）对新 OCR 更差，正文页旧层往往更稳
