# 压缩原理与调参

## MRC 分层原理

文字清晰度依赖 DPI，JPEG 压文字会在笔画边缘产生振铃和块糊。MRC 将页面拆为两层再叠加（正文层对应图片区挖白，JPEG 补丁盖回原位）：

- **文字**：保持原生 DPI，局部自适应阈值转 1-bit，JBIG2 generic region 编码
- **图片**：连续色调区（照片、切片、渐变）单独裁出，JPEG 编码并可降至 150 DPI

## 何时不重编码（不跑 `run`）

`probe` 报 `color`、体积已不大、图像占约 97%，**或原生只有 150 DPI** 时不要重编码：150 DPI 中文扫描二值化会丢掉灰度抗锯齿边缘致笔画缺损（实测见 [benchmarks.md](benchmarks.md)）。正确路径是清广告（[ad-removal.md](ad-removal.md)）后只运行：

```bash
pdfopt ocr 某教材.clean.pdf --out out/某教材.pdf
```

## 曝光判据（不单看 DPI）

跑 `run` 前看 240 DPI 渲染测得的正文页墨核灰度 `p0.5`（详细对比数据见 [benchmarks.md](benchmarks.md)）：

- **`p0.5 < 50` 且墨覆盖 5–8%**：笔画与纸面分界清楚，240 DPI 以上即可直接默认 `--sauvola-k 0.20` 二值化（不必将 `--bilevel-min-dpi` 提到 480）
- **`p0.5 > 100`**：曝光过亮，笔画已与纸面发糊，禁用二值化，保留灰度或用色阶调暗

## 扫描太淡：用 `--text-contrast`，不用阈值

`--text-contrast 0-100`（默认 0 关）按页从直方图（`Tone` 的 `paper_pct` / `ink_pct`）做单调色阶曲线，不合并灰阶也不会切断笔画；守卫条件为纸面亮度 `p80 < 200`（封面、整幅照片）或墨纸差 `< 32` 时整页跳过

- **体积代价**：拉伸对比度会放大纸张颗粒、增加体积，可配 `--page-quality 70` 控制
- **勿调低 `paper_pct`**：默认 `p80` 最稳最省，压低锚点反而让斜率更陡并放大字周晕圈（实测涨体积，见 [benchmarks.md](benchmarks.md)）
- **配 `--drop-showthrough 20` 去背透**（30 无额外收益）：前提是背透像素与正文墨核灰阶分位不重叠（薄纸双面重墨需少切或不切）。白点同时作拉伸上锚点，连续衔接到 255 无硬边；彩色页按亮度比例调校色相，MRC 彩色插图补丁保持原色不被正文色阶污染

## 二值化三步（仅 `p0.5 < 50` 时）

1. 上采样到不低于 300 DPI（`--bilevel-min-dpi`），让细笔画落在够细网格上（不增加信息）
2. 轻度高斯平滑（`--text-smooth 0.3`，源像素单位）去锯齿与颗粒
3. Sauvola 局部阈值（`--sauvola-k` / `--sauvola-window-in`）同时适配淡页与深页

`--bw-threshold` 为固定全局阈值逃生阀，仅局部阈值失效时使用

### 断笔与正文误判调参

- **笔画切断**：紧邻粗笔画的淡笔画被丢掉（`岩`、`层`、`中` 缺横）时，降 `--sauvola-k` 至 `0.10`（`0.05` 开始粘连，正常曝光维持 `0.20`），必要时再提高 DPI。**禁用二值化前反锐化与黑顶帽/小窗口并集**（反效果或无额外收益，实测见 [benchmarks.md](benchmarks.md)）
- **正文被误判为图片**：`find_regions` 按纸白占比区分区域，大字号密排正文在 `--white-level 235` 下易被判为 JPEG 图片区（放大发糊）。裁出 `find_regions` 矩形检查，若里面是文字则将 `--white-level` 降至 `215`

## 禁 AI 超分 & 双色 MRC 误判分流

- **禁 AI 超分**：实测仅多恢复 1.1pp 字符却损失 −7dB PSNR 并编造笔画，仓库不留其代码与权重（7 模型评测见 [benchmarks.md](benchmarks.md)）
- **双色教材与 MRC 误判**：浅蓝栏目、淡网底、二维码或细工程图常致 MRC 把密排正文判成图片区。若无照片却几乎每页报图片区，或同段文字跨矩形边界灰阶突变，改走 `pdfopt continuous`（[continuous-tone.md](continuous-tone.md)）

## 预算与彩色模式

- `--max-mb` 默认 100：150 DPI 上采样无信息增益；预算余量用于原生 300 DPI 大书保住 300 DPI 文字层，或提高 JPEG 质量减二次压缩损失
- `--mode color` 逐页执行 `is_colourful()` 判定，只留封面彩页直接用即可（仅封面封底走彩色），勿手工按页拆分支

## 自动调参顺序与字节分布

超预算时 `plan` 固定顺序：尊重显式参数、绝不上采样超原生 DPI、在未锁定参数上先降 `--photo-dpi` / `--photo-quality`，最后降 `--dpi` 至 `240` / `200`；组装超预算按同候选列表再降一档重编

文字为主的大书往往 JBIG2 占大头，盲目压 `--photo-*` 省不下多少体积还会糊插图。先按位深统计字节分布再决定动 `--dpi`（文字大头）还是 `--photo-*`（图片大头）：

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

## 主要参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `--max-mb` | 100 | 体积上限（MB） |
| `--mode` | auto | `mrc` / `bilevel` / `gray` / `color`；auto 按 probe |
| `--dpi` | 原生 | 文字层 DPI |
| `--photo-dpi` | 150 | MRC 图片补丁 DPI |
| `--photo-quality` | 72 | MRC 图片补丁 JPEG 质量 |
| `--page-dpi` / `--page-quality` | — | gray/color 整页模式 |
| `--text-contrast` | 0（关） | 按页色阶加深淡墨；单调曲线，不切断笔画，会增体积 |
| `--drop-showthrough` | 0（关） | 把比「墨纸区间的百分之几」更淡像素压白清背透；试 20 |
| `--bilevel-min-dpi` | 300 | 二值化前把文字层上采样到不低于此 DPI |
| `--text-smooth` | 0.3 | 二值化前高斯 sigma（源像素单位）；0 关闭 |
| `--sauvola-k` | 0.2 | 局部阈值严格度；调高笔画更细，调低更饱满 |
| `--sauvola-window-in` | 0.10 | 局部阈值窗口（英寸），约一个字宽 |
| `--bw-threshold` | 关 | 逃生阀：改用固定全局阈值绕开 Sauvola |
| `--seed-white` / `--grow-white` | 0.25 / 0.60 | 连续色调区域判定与生长 |
| `--white-level` | 235 | 多深的灰算纸白；淡底纹约 230，降至 ~212 可让底纹回文字层 |
| `--tint-std` | 关 | 低对比大片当图片；默认关，易误伤稀疏文字 |
| `--chroma-seed` | 0.08 | 块内强彩色像素占比阈值，检出白底红蓝曲线图；0 关闭 |

## 页脚重复小图标（可选）

每页约 40pt 非正文装饰图标（如页脚「数字资源」图章）可按实心中蓝（`B-R>25` 且灰度 `110~225`）盖白矩形并跳过首末页，页码深蓝细笔画不会被误认
