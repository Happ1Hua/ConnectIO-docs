---
layout: default
title: 内存与续跑
lang: zh
permalink: /zh/optimization/
---

# 作业内存不足或中途停止时

先在日志里找到停下来的步骤。推理时缩小输入块、减少预取块数、评估时换更大的临时盘，分别解决不同问题。保留原配置，下次在同一区域比较。

## 从保存点接着训练

LSD/ACRLSD 和 Synful 的训练保存点包含优化器状态、随机数状态、下一个样本编号以及训练输入和配置标识。Synful 还保存混合精度的 scaler。继续同一次训练用 `--resume`。如果手里是分发权重或缺少上述状态的历史权重，在新输出目录初始化：

```bash
connectio-lsd-train lsd --config train.json --iterations 100 --init-checkpoint legacy.pt
connectio-synful train --config synful.json --steps 100 --init-checkpoint legacy.pt
```

训练期间保持原图、标签、掩膜和划分区域不变。`deterministic: true` 可要求 Torch 使用确定性算子。更换软硬件仍可能影响结果的可重复性。

## 控制重采样的主机内存

```python
from connectio.processing import resample_zarr

job = resample_zarr(
    "volume.zarr", "volumes/raw", scale_factors=(0.5, 0.5, 1.0),
    output_dataset_name="volumes/raw_half", output_block_shape=(64, 64, 32),
    num_workers=2, max_pending=2, memory_mb=256,
)
```

`memory_mb` 限制估算的工作缓冲区，默认 256 MiB。`output_block_shape`、`num_workers` 和 `max_pending` 控制单块大小及同时处理多少块。还要为解码缓存和进程本身留出余量。标签选 `interpolation="nearest"`，包括 uint64 在内的整数 ID 都能保留。新数组完整写好后再替换目标；替换被中断时，下次调用会根据日志处理。

## 给大体积评估留出临时盘

```bash
connectio-lsd-evaluate GT.zarr labels RESULT.zarr segmentation \
  --gt-axes xyz --seg-axes xyz --memory-mb 128 \
  --temporary-dir /tmp --output evaluation.json
```

评估时，标签对的计数会暂存到磁盘。将 `--temporary-dir` 指向空间够用的位置，以容纳 SQLite 计数表。报告会记录实际块尺寸和内存预算。VOI 与 Rand 在真值非零体素上计算；标签应为非负整数，并使用相同轴序、间距与对齐的网格。

## 调整分块推理

```json
{
  "batch_size": 1,
  "read_workers": 2,
  "prefetch_blocks": 2,
  "write_queue": 2,
  "amp": false,
  "amp_dtype": "float16"
}
```

上述设置在 LSD/ACRLSD 推理 JSON 顶层填写，在 Synful 中放入 `inference`。主机内存紧张时，先减少预取数和写队列长度，它们都是按块或批次计数。显存紧张时，从 `batch_size: 1` 和网络允许的输入块大小开始。单进程使用多卡可给 `devices` 指定互不重复的设备，如 `["cuda:0", "cuda:1"]`，由协调进程统一写入。

调参前后在同一个 ROI 比较完成块数和总耗时。`inference_performance` 中读、算、写各项时间可重叠。LSD 可设 `--profile timing.json`，Synful 可设 `inference.profile_file`。CUDA 混合精度用 `amp: true` 并将 `amp_dtype` 设为 `float16` 或 `bfloat16`。用单独输出比较全精度和混合精度的预测及实例合并差异。

## 恢复部分预测

Synful 会记录原图修订、权重、配置、几何和已完成的概率块及向量块。目录型 Zarr 的输入修订依据文件元数据，HDF5 还会用文件大小和时间戳。复制或编辑数据都可能导致标识变化。接续原结果时沿用原输入和同一组参数。若已完成的块缺失或不兼容，保留旧结果供核查，另选新目录运行。旧完成记录的处理见[升级与恢复]({{ "/zh/audit/" | relative_url }})。
