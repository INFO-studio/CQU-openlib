# 广告与非原书内容

网上流传的扫描件常被二次加工。**必须在 `run` 之前做完**：pdfopt 栅格化整页，广告会烧进输出，OCR 还会把广告写进文本层。

## 藏在哪里

| 位置 | 实例 | 处理 |
| --- | --- | --- |
| 内容流水印块 `/Artifact <</Subtype/Watermark>> BDC … EMC` | 医学教材页脚红字「添加微信：…」，4 页 | 切掉整块 |
| 内容流里的**可见**文本块 | 普通地质学封面红色网盘链接，1 页 | 见下「可见文本块」 |
| Stamp 注释（图章） | 扉页/索引页二维码，2 页 | `page.delete_annot()` |
| 书签 | 目录前「电子书代找 / 微信号 / 公众号」 | 过滤后 `set_toc()` |
| 整页来源标记 | 普通地质学末页 `[General Information] / SS号=`（超星） | `delete_pages()`，全书唯一无扫描图的页 |
| 烧进扫描图像素 | 两本实测都没有 | 裁白矩形或接受 |

## 先侦察

扫描件本身没有文本层也没有注释；**任何文本、注释都是后加的**。但「后加的」≠「广告」——Acrobat Paper Capture 的 OCR 层也要留（见 [ocr.md](ocr.md)）。

```bash
.venv/bin/python - <<'PY'
import pymupdf as fitz
d = fitz.open("某教材.pdf")
print("有文本的页:", [i + 1 for i in range(d.page_count) if d[i].get_text().strip()][:20])
print("有注释的页:", [i + 1 for i in range(d.page_count) if list(d[i].annots())][:20])
print("书签前 5 条:", d.get_toc()[:5])
PY
```

对着页码、注释类型、书签文字确认哪些是广告，再动手。

## 可见文本块（别烧像素）

普通地质学封面广告**看着像在封面上**，其实是 PDF 文本对象：Acrobat OCR 层全用 `3 Tr`（不渲染），广告块显式 `0 Tr` + 红色 `1 0 0 rg`，全书就这一处。判据是**渲染模式**，不是关键词。删掉后封面图一个字节不动。

```bash
.venv/bin/python - <<'PY'
import re
import pymupdf as fitz
doc = fitz.open("某教材.pdf")
BLOCK = re.compile(rb"BT\b.*?\bET\b", re.S)
for page in doc:
    for xref in page.get_contents():
        data = doc.xref_stream(xref)
        kept = BLOCK.sub(lambda m: b"" if b"0 Tr" in m.group(0) else m.group(0), data)
        if kept != data:
            print(f"p{page.number + 1}: 删掉 {len(data) - len(kept)} 字节可见文本")
            doc.update_stream(xref, kept)
PY
```

先只打印、不写回，确认命中页正是广告页——有些书的页码、页眉也是后期可见文本，要留。

## 水印 + 注释 + 书签（通用脚本）

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

删完再跑侦察脚本：广告相关文本/注释应空，书签第一条应是原书目录。

## 删页与保存

只改内容流时 `saveIncr()` 往尾部追加几 KB。删页必须全量 `save(garbage=4, clean=True)`（49MB 约数秒）。PyMuPDF 不会顺手重编码图像流；事后逐张比对 `xref_stream_raw` 的 sha256 可确认。

## 标题页错字（可选）

广告清完后，封面/书名页 OCR 层若把书名写成「普遍地质学」、出版社乱码，可只重打那几页：删掉该页全部 `BT…ET`，用 `pdfopt.textlayer.write_lines` 按原 bbox 重铺正确文字（见普通地质学实测）。正文层别整本替换。

## 补回书签

清理前副本与 `out/` 产物页数一致时：

```bash
.venv/bin/python - <<'PY'
import pymupdf as fitz
src, dst = fitz.open("某教材.clean.pdf"), fitz.open("out/某教材.pdf")
dst.set_toc(src.get_toc(simple=False))
dst.save("/tmp/repack.pdf", garbage=4, deflate=True, use_objstms=1, clean=True)
PY
```

`verify` 通过后覆盖回 `out/`。
