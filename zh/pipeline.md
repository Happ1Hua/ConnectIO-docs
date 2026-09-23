---
layout: default
title: raw 到 segmentation 流程
lang: zh
permalink: /zh/pipeline/
---

# raw 到 segmentation 流程

可复用流程拆成以下独立提交阶段：

| 序号 | 阶段 | 输入 → 输出 | 资源 |
|---:|---|---|---|
| 00 | `precomputed` | Neuroglancer precomputed → Zarr raw | CPU |
| 01 | `alignment` | TIFF 栈 → 对齐 TIFF 栈 | CPU |
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
