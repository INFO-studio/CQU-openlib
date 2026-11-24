# 广告与非原书内容

**必须在 `run` 之前做完**，因为栅格化会把广告烧进像素，OCR 也会把广告写进文本层

## 藏在哪里

| 位置 | 实例 | 处理 |
| --- | --- | --- |
| 内容流水印块 `/Artifact <</Subtype/Watermark>> BDC … EMC` | 页脚红字「添加微信：…」 | 切掉整块 |
| 内容流里的**可见**文本块 | 封面红色网盘链接 | 见下「可见文本块」 |
| Stamp 注释（图章） | 扉页/索引页二维码 | `page.delete_annot()` |
| 书签 | 目录前「电子书代找 / 微信号 / 公众号」 | 过滤后 `set_toc()` |
| 整页来源标记 | 末页 `[General Information] / SS号=`（超星） | `delete_pages()` |
| 烧进扫描图像素 | 图内硬字 | 裁白矩形或接受 |

## 先侦察

纯扫描件没有文本层与注释，后加对象中需区分广告与需保留的 Acrobat Paper Capture OCR 层（[ocr.md](ocr.md)）：

```bash
.venv/bin/python - <<'PY'
import pymupdf as fitz
d = fitz.open("某教材.pdf")
print("有文本的页:", [i + 1 for i in range(d.page_count) if d[i].get_text().strip()][:20])
print("有注释的页:", [i + 1 for i in range(d.page_count) if list(d[i].annots())][:20])
print("书签前 5 条:", d.get_toc()[:5])
PY
```

对着页码、注释类型与书签文字确认广告范围后再动手

## 可见文本块（别烧像素）

封面广告常作为 PDF 文本对象叠加在扫描图上（Acrobat OCR 层通常用 `3 Tr` 不渲染，而广告块常用 `0 Tr` 或 `1 0 0 rg` 显式着色）。因 PDF 规范默认渲染模式本来就是 `0`，并非所有可见广告都会写 `0 Tr`，动手前先检查该页内容流与 `get_text("rawdict")` 里的颜色/字体，确认特征再删（图像流一字节不动）：

```bash
.venv/bin/python - <<'PY'
import re
import pymupdf as fitz
doc = fitz.open("某教材.pdf")
BLOCK = re.compile(rb"BT\b.*?\bET\b", re.S)
for page in doc:
    for xref in page.get_contents():
        data = doc.xref_stream(xref)
        # 优先仅当本页确认为广告且非 3 Tr（隐形 OCR）时再精准剔除；
        # 若广告块显式写了 0 Tr，可用 b"0 Tr" in m.group(0)；否则按关键词或颜色指令匹配
        kept = BLOCK.sub(lambda m: b"" if (b"0 Tr" in m.group(0) or b"1 0 0 rg" in m.group(0)) else m.group(0), data)
        if kept != data:
            print(f"p{page.number + 1}: 删掉 {len(data) - len(kept)} 字节可见文本")
            doc.update_stream(xref, kept)
PY
```

先仅打印不写回，确认命中页确实是广告页（部分书的页码、页眉也是后期可见文本，需保留）

## 水印 + 注释 + 书签（通用脚本）

```bash
.venv/bin/python - <<'PY'
import re, shutil
import pymupdf as fitz

shutil.copy2("某教材.pdf", "某教材.clean.pdf")
doc = fitz.open("某教材.clean.pdf")

# 注意：若水印字典内含嵌套 <<...>>，先打印检查结构再精准截取对应 BDC...EMC
BLOCK = re.compile(rb"/Artifact\s*<<(?:[^<>]|<<[^<>]*>>)*/Watermark(?:[^<>]|<<[^<>]*>>)*>>\s*BDC.*?EMC", re.S)
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

删完重跑侦察脚本，确认广告文本/注释为空且书签首条为原书目录

## 删页与保存

- 只改内容流用 `saveIncr()`（尾部追加几 KB）；删页必须全量 `save(garbage=4, clean=True)`
- PyMuPDF 不会重编码图像流，可逐张比对 `xref_stream_raw` 的 SHA-256 确认无损（脚本见 [integrity.md](integrity.md)）

## 标题页错字（可选）

封面或书名页自带 OCR 层若出现错字/乱码，可删掉该页全部 `BT…ET`，用 `pdfopt.textlayer.write_lines` 按原 bbox 重铺正确文字，正文层勿整本替换

## 补回书签

`pdfopt run` 与 `pdfopt continuous` 已默认搬回书签、DocInfo 元数据与页码标签，先清广告后直接运行即可。仅需事后手动覆盖书签时执行：

```bash
.venv/bin/python - <<'PY'
import pymupdf as fitz
src, dst = fitz.open("某教材.clean.pdf"), fitz.open("out/某教材.pdf")
dst.set_toc(src.get_toc(simple=False))
dst.save("/tmp/repack.pdf", garbage=4, deflate=True, use_objstms=1, clean=True)
PY
```

`verify` 通过后再覆盖回 `out/`
