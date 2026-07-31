# 压缩原理与调参

## 为什么不是「降 DPI + 压 JPEG」

扫描件可读性来自 DPI，降 DPI 等于砍清晰度。JPEG 的 DCT 编码压文字会在笔画边缘产生振铃和块糊；中文笔画密、字腔小，稍一模糊就糊成一团。

正确做法是分开对待两种内容：

- **文字**：保持原生 DPI（一般 300），自适应阈值转 1-bit，JBIG2 generic region 编码。体积小、边缘纯黑白，往往比原始灰度更锐。
- **图片**：连续色调区域（切片、超声、人像、渐变）单独裁出，JPEG 编码，可降到 150 DPI。

两者按 MRC（Mixed Raster Content）叠在同一页：正文层全页 JBIG2，图片区在正文层挖白，JPEG 补丁盖回原位。

## 自动调参顺序

超预算时 `plan` 固定顺序：**先降 `--photo-dpi` / `--photo-quality`，最后才 `--dpi`**。组装仍超预算会再降一档重编。

**别让它自动跑到底——先看字节花在哪。** 阶梯假设图片是大头；以正文为主的书往往相反。898 页医学教材 300dpi：JBIG2 文字层 44MB（88%），图片补丁 2.89MB（5.8%）。从 150dpi/q72 降到 75dpi/q45 只省 3MB，插图里的字全糊。这种书的大杠杆是 `--dpi`：200dpi 文字层少 15MB，中文正文仍锐利。

## 先看字节分布

跑一遍编码（不加 `--ocr`），按位深统计：

```bash
.venv/bin/python - <<'PY'
import pymupdf as fitz
d = fitz.open("out/某教材.pdf")
t = p = 0
for page in d:
    for b in page.get_image_info(xrefs=True):
        n = len(d.xref_stream_raw(b["xref"]))
        if b["bpc"] == 1: t += n      # JBIG2 文字层
        else: p += n                  # JPEG 图片补丁
print(f"text {t/2**20:.1f}MB  photos {p/2**20:.1f}MB")
PY
```

文字层占大头 → 动 `--dpi`；图片占大头 → 动 `--photo-*`。

## 主要参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `--max-mb` | 50 | 体积上限（MB） |
| `--mode` | auto | `mrc` / `bilevel` / `gray` / `color`；auto 按 probe |
| `--dpi` | 原生 | 文字层 DPI |
| `--photo-dpi` | 150 | MRC 图片补丁 DPI |
| `--photo-quality` | 72 | MRC 图片补丁 JPEG 质量 |
| `--page-dpi` / `--page-quality` | — | gray/color 整页模式 |
| `--bw-threshold` | 200 | 二值化阈值；扫描偏淡时调高（如 215），是调阈值不是膨胀 |
| `--seed-white` / `--grow-white` | 0.25 / 0.60 | 连续色调区域判定与生长 |
| `--white-level` | 235 | 多深的灰算纸白；淡色底纹常在 230 上下，降到 ~212 可让底纹回文字层 |
| `--tint-std` | 关 | 低对比大片当图片；默认关，易误伤稀疏文字 |

## 何时根本不 run

probe 报 `color`、文件已不大、图像占 97% 时，**再编码只会更差**。例如 150 DPI 原生 JPEG2000 的 337 页教材 ~50MB：正确路径是只清广告（见 [ad-removal.md](ad-removal.md)），337 张图逐张 sha256 不变。

## 页脚重复小图标（可选）

某医学教材每页页脚有「数字资源」图标（~40pt），每页一份图片补丁。原书元素但读者不看。可在扫描图上盖白矩形：实心中蓝（`B-R>25` 且灰度 110~225），跳过首末页。页码深蓝细笔画不会被误认。
