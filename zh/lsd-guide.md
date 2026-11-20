---
layout: default
title: 从亲和图生成标签
lang: zh
permalink: /zh/lsd-guide/
---

# 从亲和图生成神经元实例标签

准备原图和配套的 LSD、ACRLSD 权重，或从已知原点和体素大小的亲和图继续。Spider 权重对应 8 nm 各向同性 FIB-SEM 数据。根据权重生成 `lsd.json`、`acrlsd.json` 和阶段配置的步骤见[权重与推理配置]({{ "/zh/models/" | relative_url }})。

## 分方向检查亲和图

```bash
connectio-segmentation-stage affinity runs/spider/affinity.json --dry-run
connectio-segmentation-stage affinity runs/spider/affinity.json
```

先生成 10 通道的形状描述子，再单独生成 3 通道的亲和图，均为通道在前的 `uint8`。将三个方向逐一与原图叠加，特别看膜跨过分块边缘的位置。缺块、极性颠倒、某个方向在膜两侧一直很亮，都会影响后面的片段提取。用 `connectio-lsd-predict --max-blocks` 限制试跑范围时，另选测试输出。

## 从片段到合并图

| 配置 | 用途 | 一致性检查 |
|---|---|---|
| `02_affinity.json` | 在一份 GPU 作业中依次运行两个网络 | 两份底层推理配置使用同一原图网格及配套权重。 |
| `03_over_segmentation.json` | 分水岭片段 | `affs_file`/`affs_dataset` 指向已检查的亲和图。 |
| `04_agglomeration.json` | 区域邻接图边打分 | 沿用片段数组、`db_name` 和 `_connectio.mongodb_dir`。 |
| `05_lut.json` | 生成阈值查找表 | `edges_collection` 对应构图时使用的合并函数。 |
| `06_segmentation.json` | 单个阈值的标签体 | 使用已接受的 LUT，并写入独立 `out_dataset`。 |

例如 `hist_quant_75` 合并函数对应的边集合是 `edges_hist_quant_75`。前后阶段要沿用同一数据库和同一份片段。本地 worker 可用自动启动的回环 MongoDB。跨节点 worker 要通过 `_connectio.mongodb_uri`、`CONNECTIO_MONGODB_URI` 或 `db_host` 指向可达且启用认证的服务。共享配置中请勿写入凭据。具体设置见[作业与 worker]({{ "/zh/slurm/" | relative_url }})。

先看片段边界在原图上是否对齐，再在**同一个区域**比较多个 LUT 阈值。分别记录一个神经元被切成几块、两个不同神经元被并成一块的情况。记录所选 `threshold` 时一并保存边集合名。调整分块要区分单位，Funke 的 `block_size` 和 `context` 使用物理长度，推理的 `input_shape` 和 `output_block_shape` 使用体素数。

假设已将示例另存为下列文件名，每次选一条命令，检查其结果后再提交后续阶段。

```bash
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json
connectio-segmentation-stage agglomeration configs/04_agglomeration.json
connectio-segmentation-stage lut configs/05_lut.json
connectio-segmentation-stage segmentation configs/06_segmentation.json
```

## 中断后续跑，或与标注比较

中断后先查阶段状态和 worker 日志。恢复预测会核对权重、输入修订、几何和已完成的块。如果这些条件变化，另选输出位置。保留输入数组和恢复记录。新建 `run_dir` 可以另存日志，但恢复合并图仍需原数据库。

若有真值标注，可在同一网格上比较两个整数标签体。示例显式声明两个数组都是 XYZ；旧数据缺少轴属性时，按其真实轴序填写。

```bash
connectio-lsd-evaluate GT.zarr volumes/labels/neuron_ids \
  RESULT.zarr volumes/segmentation --gt-axes xyz --seg-axes xyz \
  --output evaluation.json
```

程序根据 `resolution` 和 `offset` 取两个体积在物理空间的交集，在真值非零处计算 VOI 和 Rand。轴、单位和体素间距要一致，原点应落在同一网格上（允许误差 `1e-6` 体素）。错开半个体素要先修正几何。大体积评估的设置见[内存与续跑]({{ "/zh/optimization/" | relative_url }})。
