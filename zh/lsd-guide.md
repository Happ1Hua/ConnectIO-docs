---
layout: default
title: LSD 与 ACRLSD 操作指南
lang: zh
permalink: /zh/lsd-guide/
---

# LSD 与 ACRLSD：完整操作指南

本页在[分割概览]({{ "/zh/segmentation/" | relative_url }})和[阶段流程]({{ "/zh/pipeline/" | relative_url }})的基础上，详细说明模型推理、图数据库状态、审查与失败恢复。Synful 是独立的突触配对流程。

## 准备输入和运行目录

首先准备 XYZ 轴顺序的三维 raw Zarr，记录 shape、dtype、`resolution` 和 `offset`；后两个字段决定物理坐标，不只是查看器设置。准备与网络结构匹配的 LSD、ACRLSD checkpoint。默认 Spider 模型面向 8 nm 各向同性 FIB-SEM，不能未经验证直接用于其他分辨率或成像方式。manifest 只记录身份和迭代次数，并不会自动下载权重。

将 `connectio/segmentation/configs/stages/` 中的 JSON 模板复制到运行目录的 `configs/`，修改数据路径、dataset、权重、block、worker 和 `_connectio.run_dir`。阶段 JSON 中的相对路径以该 JSON 所在目录解析；不同实验使用不同输出路径。分割作业读取 raw 时，不要同时覆盖该 Zarr。

| 配置 | 用途 | 一致性检查 |
|---|---|---|
| `02_affinity.json` | 一次 GPU 分配内先 LSD、后 ACRLSD | 两份底层推理配置使用同一 raw 几何和匹配的权重。 |
| `03_over_segmentation.json` | watershed fragments | `affs_file`/`affs_dataset` 指向已经审查的 affinity。 |
| `04_agglomeration.json` | 区域邻接图边打分 | 沿用 fragments、`db_name` 和 `_connectio.mongodb_dir`。 |
| `05_lut.json` | 生成阈值查找表 | `edges_collection` 与 agglomeration 的 merge function 对应。 |
| `06_segmentation.json` | 单个阈值的标签体 | 使用已接受的 LUT，并写入独立 `out_dataset`。 |

原生 Funke 配置中的 `block_size`、`context` 遵循该库的物理单位约定；推理 JSON 的 `input_shape`、`output_block_shape` 则是体素数。调整分块时不能混用。

## 推理与 affinity 审查

```bash
connectio-segmentation-stage affinity configs/02_affinity.json --dry-run
connectio-segmentation-stage affinity configs/02_affinity.json
```

`--dry-run` 只展示提交计划，不验证权重文件与 Zarr 内容。正式提交在 Slurm 中先运行 LSD、再运行 ACRLSD，并保存解析后的运行配置。输出是通道优先 `uint8`：LSD 为 10 通道，affinity 为 3 通道，后面是 XYZ；输出复制 raw 的 `resolution` 和 `offset`。当推理使用 `mongo_required=false` 时，本地 JSON block tracker 支持断点续跑。推理入口还可用 `--max-blocks` 和重复的 `--block-index` 做小范围测试，但应使用专用测试输出，不能把部分体积当作完整预测。

作业结束不等于科学结果合格。将三个方向的 affinity 与 raw 在 XY、XZ、YZ 中逐一比较，检查膜对比、轴向漂移、极性、缺块和拼缝，并记录 checkpoint 与接受的路径。修正后的监督仅将同一个非零对象的体素对标为正边；端点 mask 允许时，零边界仍可作为有效负边。

## 逐阶段后处理

```bash
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json
connectio-segmentation-stage agglomeration configs/04_agglomeration.json
connectio-segmentation-stage lut configs/05_lut.json
connectio-segmentation-stage segmentation configs/06_segmentation.json
```

每个阶段都应等待结果、审查并确认后才提交下一个。过分割从已接受的 affinity 产生 fragments，需检查与 raw 的边界贴合和 block 拼缝。Agglomeration 给持久化区域邻接图的边打分；LUT 将不同阈值下的 fragments 映射到合并组件；标准最后阶段按选定的 `threshold` 写出标签体。标签体是新的结果，不应覆盖 fragments。

过分割、agglomeration 和 LUT 阶段各自在运行时启动 MongoDB，结束后停止服务。三个阶段必须使用**相同** `db_name` 与 `_connectio.mongodb_dir` 以保留数据文件，且不能并发访问同一个目录。`edges_collection` 要对应 merge function，例如模板中的 `hist_quant_75` 与 `edges_hist_quant_75`。仅保留 `status.json` 而丢失数据库文件，无法恢复图状态。

阈值选择是科研判断：在有代表性的区域比较多个 LUT 阈值，分别检查错误合并和错误拆分，并记录阈值、merge function、审查区域和结论。如果模型或 affinity 改变，应使用新路径重新生成下游 fragments 和图数据，不复用旧 LUT。

## 状态、失败恢复与验证

每个阶段在 `<run_dir>/<stage>/status.json` 写入 `RUNNING`、`COMPLETED` 或 `FAILED`，Slurm 作业目录另有 stdout/stderr。失败时可能留下部分 dataset 或数据库状态，应先检查错误及现存输出，再决定重试。`--no-slurm` 只适用于已经位于 Slurm allocation 内的进程，不能用于登录节点的大规模计算。后处理前须确保分割环境能访问旧版 Funke 依赖与 `mongod`。

定量比较要求 GT 与结果在世界坐标中有交集：

```bash
connectio-lsd-evaluate GT.zarr volumes/labels/neuron_ids \
  RESULT.zarr volumes/segmentation --output evaluation.json
```

评估按 Zarr 的 `offset`、`resolution` 求交集并输出 VOI、Rand 等指标。指标不能取代视觉审查：仍需检查缺失标签、异常大组件、拼缝与解剖合理性。[digspider 案例]({{ "/zh/case-study/" | relative_url }})展示了作业成功结束仍可能隐藏监督错误。
