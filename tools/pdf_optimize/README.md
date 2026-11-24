# pdfopt

扫描版教材 PDF 的清理与压缩工具（MRC/JBIG2、连续灰阶 JPEG 2000 + 可选 OCR）。

**完整说明在 Agent Skill：** [`.agents/skills/pdf-optimize/SKILL.md`](../../.agents/skills/pdf-optimize/SKILL.md)  
按需读子文档：安装用法、调参、去广告、OCR 决策、产物校验。

## 快速开始

```bash
brew install jbig2enc qpdf
cd tools/pdf_optimize
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

./pdfopt.sh probe "某教材.pdf"
./pdfopt.sh run   "某教材.pdf" --max-mb 100 --ocr  # 适合稳定可分区的文字扫描
./pdfopt.sh continuous "某教材.pdf" --auto-colour  # 单图扫描，不二值化（自动求 PSNR 或传 --ratio）
./pdfopt.sh ocr "压缩稿.pdf" --ocr-source "原稿.pdf" # 从原稿识别并叠加文本层
./pdfopt.sh toc pages "out/某教材.pdf" --pages 1-16   # 无书签时导出目录页供读取
./pdfopt.sh toc apply "out/某教材.pdf" --from toc.txt --offset 9 --page-labels
./pdfopt.sh verify "out/某教材.pdf"
./pdfopt.sh clean "某教材.pdf"                     # 只清该书分页缓存（--all 清全部）
```

有广告或二次加工痕迹时，**先读 skill 里的 [ad-removal.md](../../.agents/skills/pdf-optimize/ad-removal.md) 再 run**。  
`probe` 报已有文本层且文件不大时，可能只需清广告、不必 run。

输入 PDF、`out/`、`.venv/`、`tessdata/` 已进 `.gitignore`，勿提交。
