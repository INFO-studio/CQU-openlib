# OCR 文本层

文本层由本工具自己铺，不走 ocrmypdf。

## 为什么自己铺

**空格。** OCR 工具按「词」定位，PDF 抽取器把词间几何缝隙还原成空格，中文变 `浙 江 大 学 医学 院`。换 `sandwich` / `hocr` 没用。本工具一行一个连续文本段，CJK 无分隔，Latin 保留空格。

**识别源。** 从**原始扫描**识别，不从压缩后页面。JBIG2 二值化对人眼更锐，对 tesseract 是噪声：同一页源图能认出整段职称简介，压缩页只剩碎片。改体积参数也不会悄悄改变可搜内容。

默认 `--psm 4`（单列）。psm 3 遇页边人像会切碎、乱序；抽样 10 页 psm 4 多 6% 汉字、拉丁误判约减半。

## 模型

`brew install tesseract-lang` 是 2019 tessdata_fast，中文粗体标题常变拉丁乱码。`./pdfopt.sh ocr-setup` 在 `tools/pdf_optimize/tessdata/` 镜像系统目录并用 tessdata_best 覆盖。

必须是**完整镜像**（含 `configs/`、子语言如 `chi_sim_vert`），不能只放 `.traineddata`。缺文件时 tesseract **退出码 0 但不识别**；`ocr-setup` 结尾有冒烟测试。

```bash
./pdfopt.sh ocr-check
./pdfopt.sh run x.pdf --ocr --ocr-langs chi_sim+eng --ocr-psm 4
```

## 已有文本层：先量化再决定

`probe` 报 `text layer: yes` 就停。很多文件是 Acrobat Paper Capture（看 `metadata.producer`），**重做可能是倒退**。

普通地质学（338 页，原生 150 DPI）实测：上采样 300 DPI 喂 tessdata_best，全面输给自带层。

| 抽样 60 页正文 | 自带 Acrobat 层 | 新 tessdata_best psm4 |
| --- | --- | --- |
| 书签标题召回 | **74.0%** | 55.3% |
| 高频术语命中 | **1841** | 1677 |
| 汉字→拉丁乱码 | **45** | 274 |

原因：150 DPI 插值到 300 DPI 不增加信息。工具默认 `--ocr-dpi 300` 面向 300 DPI 原生扫描。

别靠翻几页目测——偏差样本很常见（该书 p101、p334 上新 OCR 更好，不代表全书）。**书签是标准答案**：正确中文，每条命名其指向页上的标题。

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

- **≥ 70%**：别重做 OCR；标题页错字可手工重打几行（见 [ad-removal.md](ad-removal.md)）。
- **≤ 40%** 或 fast 模型拉丁乱码严重：值得 `--ocr`。

目录页（多点线、双栏）对新 OCR 尤其差；正文页旧层往往更稳。
