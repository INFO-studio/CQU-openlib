# 产物与校验

## 安全写入

产物先写临时文件再 `os.replace()`，中断不会留下损坏的最终文件，权限 0644。声明 PDF 1.6（JBIG2Decode 需 1.4+，声明过低严格阅读器报损坏）。

## verify

```bash
./pdfopt.sh verify "out/某教材.pdf"
```

跑 `qpdf --check` 并逐页解码，报告解码失败页和全白页。删页或 `set_toc` 重存后应再跑一次。

## 输出路径

产物在 `tools/pdf_optimize/out/`：

| 文件 | 含义 |
| --- | --- |
| `*.layers.pdf` | 未 OCR |
| `*.ocr.pdf` | 已 OCR |
| 同名 `.pdf` | 最终文件 |
| `*.preview.pdf` | 用了 `--pages` 子集时的预览，不覆盖全书 |

分页缓存在 `out/.pdfopt/`；`./pdfopt.sh clean` 可删。

## 勿提交大文件

以下已在 `.gitignore`：

- `tools/pdf_optimize/*.pdf`（输入）
- `tools/pdf_optimize/out/`
- `tools/pdf_optimize/.venv/`
- `tools/pdf_optimize/tessdata/`

清完/压完的 PDF 由维护者上传 API 拿 filekey，再写入 `public/doc/course/` 条目。

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
