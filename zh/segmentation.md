---
layout: default
title: 分割
lang: zh
permalink: /zh/segmentation/
---

# 分割

## 独立阶段

推荐使用 `connectio-segmentation-stage`。affinity 阶段在一次 GPU allocation 中依次运行配套的 LSD 和 ACRLSD 配置；之后的阶段完全分开，便于在 affinity、fragments、合并阈值和最终标签之间逐步人工审查。

示例配置位于 `connectio/segmentation/configs/stages/`。Funke 原生字段保持不变，可选的 `_connectio` 对象保存运行器设置：

```json
{
  "db_name": "sample_segmentation",
  "_connectio": {
    "run_dir": "../logs/stages",
    "mongodb_dir": "../logs/stages/mongodb",
    "mongod": "/path/to/mongod"
  }
}
```

运行 over-segmentation、agglomeration 或 LUT 时，作业内启动阶段专用 MongoDB，结束时关闭，数据库文件保留在 `mongodb_dir`。这三步必须复用同一目录和 `db_name`。文件锁会阻止两个阶段同时访问同一数据库；Daisy worker 会收到所在计算节点的 MongoDB 地址。

每步写入 `<run_dir>/<stage>/status.json`，状态为 `RUNNING`、`COMPLETED` 或 `FAILED`。affinity 还保存解析为绝对路径的运行时配置。外层作业的时间、资源、account 和队列由 `--slurm-options` 控制；Funke 配置中的 `queue` 控制其分块 worker。

## 模型与训练

默认 Spider 模型适用于 8×8×8 nm FIB-SEM：

| 阶段 | checkpoint | 迭代 |
|---|---|---:|
| LSD | `lsd_spider_8x8x8nm_fibsem_v1_450000.pt` | 450000 |
| ACRLSD | `acrlsd_spider_8x8x8nm_fibsem_v1_230000.pt` | 230000 |

权重来自内部 TensorFlow/MALA checkpoint 转换，并通过 Git LFS 管理。配置设置 `activate_upsampling=true`，保留原网络反卷积后的 ReLU。manifest 记录物种、分辨率、成像方式、版本和迭代数。

训练样本需要 `volumes/raw`、`volumes/labels/neuron_ids`、`volumes/labels/labels_mask`。GPU 训练使用 `connectio-lsd-train` 或 `connectio/segmentation/scripts/submit_training.sh`；配置中的网络结构必须与 checkpoint 一致。

修正后的 affinity 监督将 target 和 valid 分开：两端属于同一非零对象时 target 才为正；valid 由两端 mask 和邻居是否存在决定。GrowBoundary 产生的零边界仍是有效负样本。生产训练同时补齐邻居 halo，并按跨通道、带裁剪的规则平衡权重。

## 推理和后处理

推理输出 channel-first `uint8`，继承 raw 的 `resolution` 与 `offset`。当 `mongo_required=false` 时，本地 JSON block tracker 可用于断点继续。独立 affinity 阶段关闭推理 MongoDB，并先运行 LSD、再运行 ACRLSD。

watershed 根据已修复模型的 affinity 约定提取 fragments；agglomeration 写入区域邻接图和 merge score；LUT 阶段扫描阈值；最终一步用选定阈值重新标记 fragments。进入下一步前必须将 affinity、fragments 与 raw 叠加检查。改变 watershed 的 affinity 极性只适合作为诊断，不能替代正确监督。

旧的 `00.submit_affinity.sh` 和 `01.submit_crop_postprocess.sh` 仍保留兼容；后者会串行执行多个后处理步骤，不推荐用于需要逐步人工审查的新流程。

## 评估与查看

评估根据 Zarr 的 `offset` 和 `resolution` 求 ground truth 与 prediction 的物理坐标交集，并输出 VOI、Rand、标签数、前景体素数和最大 segment 占比：

```bash
connectio-lsd-evaluate \
  GT.zarr volumes/labels/neuron_ids \
  RESULT.zarr volumes/segmentation \
  --output evaluation.json

connectio-lsd-view RESULT.zarr volumes/raw volumes/segmentation
```

CPU 轻量 smoke test 可用缩小网络验证 I/O 和控制流。生产尺寸 Spider smoke test 应在 `GPUA800` 分别运行一个真实 LSD block 和一个 ACRLSD block，并写入独立测试 Zarr，不修改源体积。
