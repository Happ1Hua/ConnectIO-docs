---
layout: default
title: 代码优化与资源控制
lang: zh
permalink: /zh/optimization/
---

# 代码优化与资源控制

2026-10-04 更新包含六项工程优化：训练几何校验、Synful 输入/输出版本检查、受控内存重采样、磁盘计数评估、可复现训练恢复和推理流水线。默认推理仍为完整精度。本次 CPU 验证不代表实际 GPU 加速倍数，也不能替代生物学验证。

## 训练几何与可复现恢复

LSD/ACRLSD 在采样前检查 raw、labels 和 label mask：均为三维，空间轴和单位一致，分辨率有限且为正，offset 位于同一体素网格。label 与 mask 的几何及形状相同；监督 label ROI 必须位于 raw 内部，并能容纳输出 patch。缺少轴元数据时保留历史 XYZ 顺序；三份数组都需要 resolution 元数据。配置中的 `voxel_size` 必须与 raw 元数据一致。标签必须为非负整数，mask 必须有限且位于 `[0, 1]`。

LSD/ACRLSD 的 `seed` 默认为 13，`max_sampling_attempts` 默认为 1000。无法从 mask 采到有效 patch 时明确报错，不再无限等待。全局样本编号决定随机 patch 和增强，与 worker 调度无关；续训时改变 `num_workers` 不改变样本序列。

Checkpoint 写入相邻临时文件，刷新后替换，保存优化器、Python/NumPy/Torch/CUDA 随机状态、下一个全局样本编号及训练输入/配置身份。Synful 还保存混合精度 scaler。CPU 回归测试比较了两阶段 LSD 和 Synful 的连续训练与中断恢复。不同 GPU、软件版本或非确定性 GPU 算子之间不保证逐位相同。`deterministic: true` 开启 Torch 确定性算法；不支持的算子会报错。

旧 checkpoint 缺少恢复元数据，可用于初始化新训练，不能完整续训。请使用新的 checkpoint/output 目录：

```bash
connectio-lsd-train lsd --config train.json --iterations 100 --init-checkpoint legacy.pt
connectio-synful train --config synful.json --steps 100 --init-checkpoint legacy.pt
```

`--resume` 与 `--init-checkpoint` 互斥。初始化只读取模型权重，优化器和样本进度重新开始。运行期间不得修改训练输入。

## Synful 预测身份

Synful 除 checkpoint、配置和几何外，还记录本地 raw 数据版本。目录式 Zarr 扫描文件元数据；HDF5 使用文件大小、修改/变更时间及 dataset 元数据。它们不是全体积像素 hash；复制、编辑或移动输入后，可能需要新的预测输出。

续跑前检查两份输出数组的几何、dtype，以及已完成 probability/vector chunk 的文件版本。chunk、数组或整个输出缺失/被修改，或 legacy manifest 不兼容时，在重写预测前报错。请选择新 `output_dir`，保留旧结果用于审查。Synful raw 为 ZYX，空间坐标单位为 nm；矛盾的显式轴或单位会被拒绝。

## 受控内存重采样

`resample_zarr`、`downsample_zarr` 和 `upsample_zarr` 只读取当前输入块及插值上下文。使用全局体素中心坐标映射，块边界不会改变插值坐标。这与旧版逐 slab 的局部 zoom 对齐不同。offset 不变，resolution 按指定比例更新，输出形状取整决定最终范围。

```python
from connectio.processing import resample_zarr

job = resample_zarr(
    "volume.zarr", "volumes/raw", scale_factors=(0.5, 0.5, 1.0),
    output_dataset_name="volumes/raw_half", output_block_shape=(64, 64, 32),
    num_workers=2, max_pending=2, memory_mb=256,
)
```

`memory_mb` 默认 256 MiB，按输入/输出工作缓冲区及在途任务的保守估计缩小有效块形状。它不是整个进程 RSS 或 codec 缓存的硬上限。仍支持 `out_block_slices_z`。由于相邻块可能共享压缩 chunk，写入统一串行执行。类别标签使用 `interpolation="nearest"`，直接整数索引保留大于 `2**63` 的 uint64 ID；线性插值用于强度数据。

先完成临时 dataset，再发布结果。计算失败保留原输入及已有目标。替换非空目录需要恢复日志，不是一次原子重命名；下次调用会恢复在两次重命名之间中断的原输入，或清理已成功发布的替换。启动时在输出锁内清理遗留临时 dataset。原地发布的短暂窗口内，应避免其他读取进程打开该目标。

## 内存预算内的评估

拒绝浮点或负数标签，保留 uint64 ID。`--memory-mb` 默认 256 MiB；必要时缩小请求的块形状，标签配对计数刷新到临时 SQLite 数据库，边缘计数和指标从磁盘流式计算。仍计算非零 GT 上的 VOI/Rand，空 GT 报错。报告包含有效块形状、预算和计数后端。

```bash
connectio-lsd-evaluate GT.zarr labels RESULT.zarr segmentation \
  --gt-axes xyz --seg-axes xyz --memory-mb 128 \
  --temporary-dir /tmp --output evaluation.json
```

临时文件系统需有足够空间存放标签配对计数。预算控制估计的工作缓冲区及 SQLite 缓存，不等于进程总 RSS。完成或普通异常退出时自动清理计数数据库。

## 推理读写流水线

LSD/ACRLSD JSON 支持以下可选设置；Synful 将相同参数放入 `inference`：

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

通过有界队列，让读取和压缩写入与模型计算重叠。队列按块或 batch 限制，不按字节限制；大 ACRLSD tile 需要较多主机内存。内存不足时减小预取、读 worker、写队列或 batch。改变 batch 可能改变浮点取整，应在代表性 ROI 上比较预测及后续分割指标。

单个进程协调多 GPU 时，设置不同的可见设备，如 `devices: ["cuda:0", "cuda:1"]`。协调进程为每张 GPU 建立模型，通过受限计算池分配 batch，只使用一个写入线程。多个独立进程仍不能同时拥有同一输出。解析后指向同一 GPU 的别名，如 `cuda` 与 `cuda:0`，会被拒绝。

混合精度须显式开启且需要 CUDA：`amp: true`，`amp_dtype` 为 `float16` 或 `bfloat16`。它可能改变数值输出，需在目标 GPU 上与完整精度比较。推理配置变化需要新的带签名输出路径。

两套引擎记录 `inference_performance`，包含处理块数、batch 数、总耗时及读取/计算/写入累计秒数。LSD 可用 `--profile timing.json` 保存报告；Synful 支持 `inference.profile_file`。各阶段会重叠，累计时间相加可能超过总耗时。选择正式配置前，比较块/秒、主机峰值内存、显存、预测差异及后续精度。CPU 测试验证队列上限、重叠执行、失败行为、并行计算分配及批量预测；本次未实测 CUDA/多 GPU 吞吐量。
