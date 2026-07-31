# pdfopt — 扫描版 PDF 体积优化

把扫描版教材压到指定体积上限，同时让文字**比原来更清晰**，并附一层干净可搜的中文文本层。

实测 626 页医学教材：**584MB → 45MB（13×）**，文字全程 300 DPI，彩色图片区域原样保留，全书可精确搜索中文。

## 为什么不是「降 DPI + 压 JPEG」

扫描件的可读性就来自 DPI，降 DPI 等于直接砍掉清晰度来源。而 JPEG 是为连续色调设计的 DCT 编码，用低质量参数压文字只会在笔画边缘产生振铃和块糊；对中文更糟，笔画密、字腔小，稍一模糊就糊成一团（形态学膨胀式的「加粗」同理，会把「陈」「医」的内部空洞填死）。

正确做法是分开对待两种内容：

- **文字**：保持扫描原生 DPI（一般 300），自适应阈值转 1-bit，用 JBIG2 generic region 编码。这是专为二值文字设计的编码，体积远小于 JPEG，且边缘是纯黑白，比原始灰度渲染更锐。
- **图片**：只有连续色调区域（病理切片、超声、人像、渐变插画）才裁出来单独按 JPEG 编码，可降到 150 DPI。

两者按 MRC（Mixed Raster Content）叠在同一页：正文层是全页 JBIG2，图片区域在正文层里挖白，再把 JPEG 补丁盖回原位。所以一页正文里夹两张切片图时，正文仍是 300 DPI 锐利黑字，字节只花在那两张图上。

## 依赖

```bash
brew install jbig2enc qpdf
brew install tesseract tesseract-lang        # 只有 --ocr 需要

cd tools/pdf_optimize
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
./pdfopt.sh ocr-setup                        # 拉 tessdata_best 模型，见下
```

## 用法

```bash
./pdfopt.sh probe "某教材.pdf"                        # 先看它是什么、该用哪个 mode
./pdfopt.sh run   "某教材.pdf" --max-mb 50 --ocr      # 自动求参命中上限
./pdfopt.sh run   "某教材.pdf" --pages 1-20,285 --ocr # 先抽几页看效果
./pdfopt.sh verify "out/某教材.pdf"                   # 逐页解码校验
./pdfopt.sh clean "某教材.pdf"                        # 清掉分页缓存
```

`run` 按 probe → plan → encode → assemble → ocr → verify 分阶段执行，每页产物落在 `out/.pdfopt/` 缓存里，中断后重跑只补没做完的页。

超预算时 `plan` 的自动调参顺序是固定的：**先降 `--photo-dpi` / `--photo-quality`，最后才考虑 `--dpi`**。组装出来实测仍超预算时会再降一档重编，所以不会因为估算保守而白白牺牲画质。

**但别让它自动跑到底——先看字节花在哪。** 这个阶梯假设图片是大头，对图版书成立，对以正文为主的书是反的：一本 898 页医学教材在 300dpi 下，JBIG2 文字层 44MB（88%），图片补丁只有 2.89MB（5.8%）。阶梯从 150dpi/q72 一路降到 75dpi/q45，总共只省了 3MB，代价是每张插图里的文字全糊了。这种书唯一的大杠杆是 `--dpi`：降到 200dpi 文字层就少 15MB，而 200dpi 的中文正文仍然锐利。

先跑一遍编码（不加 `--ocr`，898 页约 40 秒），按流的位深分开数：

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

文字层占大头就动 `--dpi`，图片占大头才动 `--photo-*`。

### 主要参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `--max-mb` | 50 | 体积上限（MB） |
| `--mode` | auto | `mrc` / `bilevel` / `gray` / `color`；auto 按 probe 结果选 |
| `--dpi` | 原生 | 文字层 DPI |
| `--photo-dpi` | 150 | 图片补丁 DPI |
| `--photo-quality` | 72 | 图片补丁 JPEG 质量 |
| `--bw-threshold` | 200 | 二值化阈值；扫描偏淡、笔画发虚时调高（如 215）让笔画更实。这是调阈值不是膨胀，不会糊字 |
| `--seed-white` / `--grow-white` | 0.25 / 0.60 | 连续色调区域的判定与生长阈值，按「纸白像素占比」算 |
| `--white-level` | 235 | 多深的灰算「纸白」。淡色底纹（章节标题带、侧边色条、表头）的灰度常在 230 上下，卡在默认值下面，于是整块被判成图片，既吃字节又让压过的底纹发花。降到 212 让它们回到文字层：底色在二值化里直接消失，压在上面的标题反而更清楚 |
| `--tint-std` | 关 | 也把大片低对比区域（浅色底纹、水印）当图片；默认关，因为会误伤稀疏文字 |

## 先去掉非原书内容

网上流传的扫描件常被二次加工，页面上盖了广告（二维码、微信号）。**这一步必须在 `run` 之前做完**：pdfopt 把页面栅格化，广告会被烧进输出图片，OCR 还会把广告文字写进文本层，事后再也摘不出来。

广告藏在四个地方，实测一本 898 页的医学教材前三种全中：

| 位置 | 该书实例 | 处理 |
| --- | --- | --- |
| 页面内容流里的水印块 `/Artifact <</Subtype/Watermark>> BDC … EMC` | 页脚红字「获取更多资料及代找电子书添加微信：…」，4 页 | 切掉整块；块外的扫描图不受影响 |
| Stamp 注释（图章） | 盖在扉页和索引页上的二维码，2 页 | `page.delete_annot()` |
| 书签 | 目录最前面 3 条「电子书代找 / 微信号 / 公众号」 | 过滤后 `set_toc()` |
| 直接合进扫描图的像素 | 该书没有 | 只能裁掉整块或者接受 |

每本书的加工方式都不一样，所以这一步没做成子命令：先看清楚再动手。扫描件本身没有文本层也没有注释，所以任何文本、注释都是后加的：

```bash
.venv/bin/python - <<'PY'
import pymupdf as fitz
d = fitz.open("某教材.pdf")
print("有文本的页:", [i + 1 for i in range(d.page_count) if d[i].get_text().strip()][:20])
print("有注释的页:", [i + 1 for i in range(d.page_count) if list(d[i].annots())][:20])
print("书签前 5 条:", d.get_toc()[:5])
PY
```

对着结果确认哪些是广告（页码、注释类型、书签文字都对得上），再清一份副本出来。增量保存只往文件尾部追加几 KB，不会重排整个 790MB：

```bash
.venv/bin/python - <<'PY'
import re, shutil
import pymupdf as fitz

shutil.copy2("某教材.pdf", "某教材.clean.pdf")
doc = fitz.open("某教材.clean.pdf")

BLOCK = re.compile(rb"/Artifact\s*<<[^<>]*/Watermark[^<>]*>>\s*BDC.*?EMC", re.S)
for page in doc:
    for annot in list(page.annots()):
        page.delete_annot(annot)
    for xref in page.get_contents():
        data = doc.xref_stream(xref)
        if data and b"/Watermark" in data:
            doc.update_stream(xref, BLOCK.sub(b"", data))

ADS = ("微信", "公众号", "代找")
doc.set_toc([t for t in doc.get_toc(simple=False) if not any(k in t[1] for k in ADS)])
doc.saveIncr()
PY
```

删完再跑一遍上面的检测：文本和注释两行应该空，书签第一条应该已经是原书目录。然后 `run` 这份 `.clean.pdf`，用 `--out` 指定原来的文件名。

### 每页重复的小图标

这本书每页页脚都印着一个「数字资源」图标（圆角方框加一支笔，约 40pt 见方，左右下角交替）。它是原书元素，但每页一个，都会被判成图片补丁——541 页各占一份字节，而读者一次也不会看它。想去掉就在扫描图上盖白矩形：按颜色认（实心中蓝，`B-R>25` 且灰度 110~225），页码是深蓝细笔画，不会被误认，同时跳过首末页，封面上的圆形图标是封面设计的一部分。

### 书签要自己搬回去

pdfopt 重建 PDF，不搬书签——898 页教材跑完是一份没有目录的文件，翻起来很难受。页数一一对应（即没用 `--pages`）时补回去，顺便用对象流重存一遍，233 条书签加进去还净省了 0.3MB：

```bash
.venv/bin/python - <<'PY'
import pymupdf as fitz
src, dst = fitz.open("某教材.clean.pdf"), fitz.open("out/某教材.pdf")
dst.set_toc(src.get_toc(simple=False))
dst.save("/tmp/repack.pdf", garbage=4, deflate=True, use_objstms=1, clean=True)
PY
```

重存完 `pdfopt verify` 再跑一次，然后覆盖回 `out/`。

`--ocr` 的书要给上限留点余量：OCR 文本层的开销工具只按 2% 预留，实测 898 页、3.2 万行花了 2.3MB（4.8%），所以 `--max-mb 50` 组装到 47.7MB 就已经贴着上限了。宁可先按 48 跑，不然只能再等一轮十几分钟的 OCR。

## OCR

文本层由本工具自己铺，不走 ocrmypdf。两个原因：

**一、空格。** 让 OCR 工具把每个「词」单独定位，PDF 文本抽取器会把词间的几何缝隙还原成空格，中文就变成 `浙 江 大 学 医学 院`。这些空格不在 OCR 结果里，是抽取时推断出来的，所以换渲染器（`sandwich` / `hocr`）没用——实测两者空格率完全一样。代价是搜索：全书 `泌尿系统` 精确匹配只剩 197 次，实际有 349 次。本工具改成**一行一个连续文本段**，CJK 之间不留分隔，Latin 之间保留空格，空格率降到 0。

**二、识别源。** 文本层从**原始扫描**识别，不是从压缩后的页面。为 JBIG2 挑的二值化阈值让人看着更锐，但对 tesseract 是噪声：同一页源图识别出「主任医师、教授、博士生导师。浙江大学医学院附属第一医院…」，压缩后的页面只识别出「iva / 任 / 与小」。从源图识别同时也让文本层不再受压缩参数影响，改体积不会悄悄改变能搜到什么。

`--psm 4`（单列文本）是默认值。tesseract 的自动版面分析（psm 3）遇到页边人像会把页面切碎、丢掉放不下的片段、剩下的还乱序；抽样 10 页对比，psm 4 多识别 6% 的汉字，且把误判成拉丁字母的噪声减少约一半。

## 完整性

`brew install tesseract-lang` 装的是 2019 年的 tessdata_fast 模型，在中文书影上会把粗体标题识别成拉丁乱码（实测 `主编简介` → `FEI BGR EAE SU`）。`ocr-setup` 会在 `tools/pdf_optimize/tessdata/` 建一个镜像目录：符号链接系统的 `configs/` 和各语言文件，再用下载的 tessdata_best 覆盖目标语言。

必须是完整镜像而不是只放 `.traineddata`：`--tessdata-dir` 同时也是 tesseract 找 `configs/tsv` 的根目录，而 tessdata_best 的 `chi_sim` 还会引用 `chi_sim_vert` 子语言。缺任何一个，tesseract 都会**退出码 0 但什么都不识别**，所以 `ocr-setup` 结尾会真跑一次 OCR 冒烟测试。

```bash
./pdfopt.sh ocr-check                        # 当前会用哪个模型
./pdfopt.sh run x.pdf --ocr --ocr-langs chi_sim+eng --ocr-psm 4
```

## 完整性

产物先写临时文件再 `os.replace`，中断不会留下损坏的最终文件，权限固定 0644。声明 PDF 1.6（JBIG2Decode 需要 1.4+，声明过低会让严格的阅读器直接报「文件已损坏」）。

`verify` 阶段跑 `qpdf --check` 并逐页解码，报告解码失败页和全白页。

产物在 `out/`：`*.layers.pdf`（未 OCR）/ `*.ocr.pdf` / 最终同名文件。加了 `--pages` 时最终文件带 `.preview` 后缀，不会覆盖全书产物。

输入 PDF、`out/`、`.venv/`、`tessdata/` 已进 `.gitignore`，勿提交大文件。
