---
layout: default
title: raw 到 segmentation 流程
lang: zh
permalink: /zh/pipeline/
---

# raw 到 segmentation 流程

可复用流程先选择输入准备路线，再分别提交分割阶段。`precomputed` 与 `alignment` 是两种不同的输入准备方式，并非必须连续执行的前后两步。

| 序号 | 阶段 | 输入 → 输出 | 资源 |
|---:|---|---|---|
| 00 | `precomputed` | Neuroglancer precomputed → Zarr raw；可选输入路线 | CPU |
| 01 | `alignment` | TIFF 栈 → 对齐 TIFF 栈；可选输入路线 | CPU |
| 02 | `affinity` | raw + LSD/ACRLSD checkpoint → LSD + affinity | GPU |
| 03 | `over-segmentation` | affinity → watershed fragments | CPU |
| 04 | `agglomeration` | affinity + fragments → 带分数的 RAG | CPU |
| 05 | `lut` | RAG → 各阈值 lookup table | CPU |
| 06 | `segmentation` | fragments + 选定 LUT → 标签 | CPU |

任一步都可直接提交：

```bash
connectio-segmentation-stage precomputed configs/00_precomputed.json
connectio-segmentation-stage alignment configs/01_alignment.json
connectio-segmentation-stage affinity configs/02_affinity.json
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json
connectio-segmentation-stage agglomeration configs/04_agglomeration.json
connectio-segmentation-stage lut configs/05_lut.json
connectio-segmentation-stage segmentation configs/06_segmentation.json
```

每条命令只运行所选阶段，不自动运行前一步或后一步。能否成功由已有输入和持久化状态决定。`watershed`、`align`、`relabel` 可分别作为三个阶段的别名。

## 人工审查点

每一步检查 shape、dtype、轴顺序、resolution、offset、数值或标签范围，以及输出和 raw 的空间贴合。每个阶段的 `data/` 目录保留 `neuroglancer_view_zarr.py`，只修改 Zarr path 与 dataset。记录审查通过后再提交下一条命令。

建议在转换后进行逐体素核对；预处理后检查亮度趋势和伪影；对齐后检查 XY、XZ、YZ 连续性；affinity 后检查膜结构贴合；fragments 后检查与 raw 的重叠和块接缝；最终标签检查 merge/split。

## 可迁移目录

```text
project/
├── raw/source.zarr
├── configs/00_precomputed.json ... 06_segmentation.json
├── data/neuroglancer_view_zarr.py
├── logs/
├── reports/
└── reviews/
```

所有配置引用同一份 raw Zarr。相对数据路径以 JSON 位置解析。`_connectio.run_dir` 保存状态和运行时配置。`over-segmentation`、`agglomeration`、`lut` 必须使用相同的 `db_name` 和 `_connectio.mongodb_dir`，使图数据库能跨独立作业延续。

## 选择 raw 输入路线

源数据是本地 Neuroglancer precomputed 目录时用 `precomputed`，生成 `volumes/raw` 等 Zarr dataset。宽 XY 或大体积可选 `mode: "large"`，转换前先确认 `resolution`。源数据是需要配准的图像栈时用 `alignment`；它生成对齐 TIFF 和配准报告，**不会**生成 raw Zarr。审查并接受对齐结果后，再用 `tiff_stack_to_zarr` 转成供 LSD 使用的 raw Zarr。已有空间元数据正确的对齐 raw Zarr 时，可直接从 affinity 开始。

[ConnectIO 分支中的阶段模板](https://github.com/Happ1Hua/ConnectIO/tree/codex/synful-pytorch-integration/connectio/segmentation/configs/stages)需要复制到自己的运行目录并替换所有示例路径。stage JSON 中的路径相对该 JSON 文件解析。`block_size`、`context` 等 Funke 原生参数保留 Funke 所需单位，不会自动按体素数换算。

## 各阶段的输入、输出和审查

| 阶段 | 提交前必须具备 | 应检查的输出 |
|---|---|---|
| `precomputed` | precomputed 根目录、选定 `resolution` 和输出 Zarr 路径 | shape、dtype、抽样块逐体素一致性、`resolution`/`offset`。 |
| `alignment` | 已排序的源图像及配准方法 | 对齐 TIFF、累计变换、正交截面连续性与无效边缘。 |
| `affinity` | raw Zarr、LSD/ACRLSD 配置及匹配的 checkpoint | 先十通道 LSD、后三通道 affinity；检查与 raw 的贴合、通道顺序、数值和块接缝。 |
| `over-segmentation` | affinity、`db_name` 与 MongoDB 状态目录 | fragments ID，以及相对 raw/affinity 的空间贴合。 |
| `agglomeration` | 相同 affinity、fragments 和持久化图状态 | edge collection 和样例区域的合并分数。 |
| `lut` | agglomeration 图；`edges_collection` 与 merge function 相符 | 阈值 LUT；选择阈值前比较几个结果。 |
| `segmentation` | fragments 和选定的 LUT | 最终标签的误合并、误切分、缺失前景和块接缝。 |

affinity 阶段在一次 GPU allocation 中依次运行 LSD 与 ACRLSD，并保存两份已解析路径的推理配置。over-segmentation、agglomeration 和 LUT 各自启动阶段专用 MongoDB；数据库文件在作业间保留。这几步需一致使用 `db_name`、`_connectio.mongodb_dir`、fragment 路径和对应的 edge collection。标准最终标签提取通过选定 `threshold` 写入 `out_file/out_dataset`。

## 单步提交与状态检查

```bash
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json --dry-run
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json \
  --slurm-options '{"time":"24:00:00","cpus_per_task":8}'
```

`--dry-run` 打印资源计划并检查配置文件存在，不运行计算，也不验证所有科学输入。提交后，`<run_dir>/<stage>/status.json` 记录 `RUNNING`、`COMPLETED` 或 `FAILED`；通用 Slurm 作业目录另存 `stdout.log`、`stderr.log` 等执行信息。定位失败时应同时检查两处。阶段完成不会自动提交下一步。

复用已有结果时，先核对空间几何和来源；新建运行日志目录不会重新生成输入。两个后处理阶段不能同时占用同一 MongoDB 目录，运行器会加锁。更换模型、输入、merge function 或阈值策略时，应记录差异并使用独立输出路径，便于对比。

## 建议保存的审查记录

每个通过审查的阶段保留配置、输出文件及 dataset、相关模型/checkpoint 身份、作业号、状态 JSON 和简短图像审查说明。建议写明已检查的 XY/XZ/YZ 截面、裁剪区域的物理坐标，以及是否看到块接缝、误合并或误切分。[digspider 实测案例]({{ "/zh/case-study/" | relative_url }})说明“作业完成”并不等于“分割结果可接受”。
