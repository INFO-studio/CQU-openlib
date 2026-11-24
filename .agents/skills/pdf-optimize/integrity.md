# 产物与校验

## 安全写入与 verify

产物先写临时文件再 `os.replace()`（权限 0644），中断不留坏文件；声明 PDF 1.6（防 `JBIG2Decode >= 1.4` / `JPXDecode >= 1.5` 报损坏）。删页或重存后跑：

```bash
./pdfopt.sh verify "out/某教材.pdf"
```

校验 `qpdf --check`（区分 warning/error）、图像滤镜最低 PDF 版本与逐页解码（报告解码失败页和全白页）。若源文件无书签，交付前先确认已用 `./pdfopt.sh toc show` 检查书签完整（[bookmarks.md](bookmarks.md)）

## 输出路径与缓存

产物位于 `tools/pdf_optimize/out/`：

| 文件 | 含义 |
| --- | --- |
| `*.layers.pdf` / `*.preview.layers.pdf` | 未 OCR（`--pages` 子集自动带 `.preview`，不覆盖全书中间文件） |
| `*.ocr.pdf` / `*.preview.ocr.pdf` | 已 OCR |
| 同名 `.pdf` | 最终文件 |
| `*.preview.pdf` | `--pages` 子集预览 |
| `*.continuous.pdf` | `continuous` 默认输出（原像素连续灰阶 JPEG 2000） |
| `*.no-ocr.pdf` | 压缩完成、待叠加 OCR 的中间稿 |

分页编码与 OCR 缓存在 `out/.pdfopt/`，`./pdfopt.sh clean 某教材.pdf` 只删该书缓存，`--all` 清空全部

## 勿提交大文件

`.gitignore` 已忽略 `tools/pdf_optimize/*.pdf`（输入）、`out/`、`.venv/`、`tessdata/`。最终成品由维护者上传 API 拿 filekey 后再写入 `public/doc/course/`

## 无损确认（只清内容流时）

```bash
.venv/bin/python - <<'PY'
import hashlib
import pymupdf as fitz
a, b = fitz.open("原.pdf"), fitz.open("清完.pdf")
def digests(doc, n):
    return [hashlib.sha256(doc.xref_stream_raw(im[0])).hexdigest()
            for i in range(n) for im in doc[i].get_images(full=True)]
print("图像流 sha256 一致:", digests(a, a.page_count) == digests(b, b.page_count))
PY
```

## 连续灰阶产物核对清单

`continuous` 完成后除 `qpdf --check "out/教材.pdf"` 与 `./pdfopt.sh verify "out/教材.pdf"` 外，逐项确认：

- 页数与源文件一致
- 无解码失败页和意外空白页
- 页面像素尺寸与源文件一致
- 保留彩色页的原始图像流 SHA-256 一致
- 中间页为 JPX / JPEG 2000，8-bit 灰度
- OCR 后所有预期页可抽取文本
- 最终体积低于上限（勿用抽样估算代替，给 OCR 与 PDF 对象留 2%–5% 余量）
