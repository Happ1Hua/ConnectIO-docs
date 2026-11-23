---
layout: default
title: 突触检测
lang: zh
permalink: /zh/synful/
---

# 用 Synful 检测突触前后端配对

Synful 根据电镜原图预测突触后位点和指向突触前端的位移。最终要复核的是一对位置。需要按神经元 ID 过滤候选时，再提供已有的神经元分割。

## 先预测一块能人工复核的区域

按[权重与推理配置]({{ "/zh/models/" | relative_url }})用配对权重生成 `runs/synful/synful.json`，并执行 `inspect --inference-only`。普通 Zarr 或 HDF5 原图按三维 **ZYX** 排列，体素间距和物理原点也按 ZYX 填写，单位为 nm。使用 XYZ 转换器的输出时，先核对真实轴序。Synful 的相对路径从运行命令的工作目录解析。WEBKNOSSOS 数据的图层坐标见 [Zarr 格式与坐标]({{ "/zh/zarr/" | relative_url }})。

把示例中的 ROI 换成原图内的区域。起点和范围均按**纳米**填写，并与体素网格对齐。示例使用 CUDA，从登录节点运行时默认提交 Slurm。在工作站上加 `--backend local`。

```bash
connectio-synful predict --config runs/synful/synful.json --device cuda \
  --roi-offset-nm 0 0 0 --roi-shape-nm 512 1024 1024 \
  --output-dir synful-results/roi-check
```

完成后，打开 `synful-results/roi-check` 下的 `prediction.zarr`。`volumes/pred_syn_indicator` 为突触后位点概率场，`volumes/pred_partner_vectors` 为以 nm 表示的位移场，二者均为 float32。只想验证读写时，可加 `--max-blocks 1` 试一块；之后用同一 ROI、同一输出目录继续至完整预测。变更权重、分块或原图时请用新输出目录。

## 提取配对并核对位置

将 `export.dataset` 填为目标 WEBKNOSSOS 数据集名。提取时沿用刚才 ROI 的输出目录：

```bash
connectio-synful extract --config runs/synful/synful.json \
  --output-dir synful-results/roi-check
```

`synapses/synapses.npz` 保存候选 ID、分数和两端位置。导出的 `03.synapses.csv` 在列名中标明坐标（`pre_z_nm` 至 `post_x_nm`）。`06.synapses.nml` 中一棵树代表一对端点，有两个节点和一条边。先找一个容易辨认的位置，在 WEBKNOSSOS 里对照原图。NML 使用**倍率 1 的 XYZ 整数体素坐标**。若叠加后有旋转或平移，逐项核对 `export.axis_order`、体素大小和 `export.origin_nm_xyz`。已有 CSV 也可单独转换：

```bash
python -m connectio.synapse_detection.synful_pytorch.io.nml \
  --csv synful-results/roi-check/03.synapses.csv \
  --output synful-results/roi-check/review.nml \
  --dataset YOUR_WEBKNOSSOS_DATASET \
  --voxel-size-xyz 8 8 8 --axis-order xyz
```

| `extraction` 参数 | 行为 |
|---|---|
| `method: "cc"` | 对高于 `threshold` 的体素做连通域提取；`score_type` 可为 `sum`、`mean`、`max` 或 `count`。 |
| `method: "nms"` | 在高于 `threshold` 的概率场中取局部峰值；score 是峰值概率。 |
| `score_threshold` | 丢弃不高于阈值的候选；数值含义取决于所选方法。 |
| `context_nm` | 分块提取时的 halo；必须覆盖 NMS 半径。CC 延伸到 halo 边界时会报错。 |
| `block_shape` | 提取核心区域大小，单位为 ZYX 体素。 |
| `min_distance_nm` | 允许的最短 pre/post 距离。 |

连通域和峰值检测的分数含义不同，应分别选阈值。若需按神经元标签过滤、去除邻近重复点，填写 `postprocessing.segmentation_file`、`segmentation_dataset` 和 `distance_threshold_nm`。将 `04.filtered_synapses.csv` 与原候选及 `export_report.json` 一起看。扩大到整个体积时，去掉两个 ROI 参数并另选输出目录。`connectio-synful run` 会依次完成预测、提取和导出。

## 用带标注的区域训练

复制 `connectio/synapse_detection/configs/synful.example.json` 为 `my-synful.json`。准备含原图、神经元标签和 CREMI 配对标注的 HDF5。标注项为 `annotations/ids`、`annotations/locations` 和 `annotations/presynaptic_site/partners`。按绝对 ZYX 纳米坐标设置 `splits.train` 和 `splits.validation`，先查看各区域内的标注数，再开始训练。

```bash
connectio-synful inspect --config my-synful.json
```

```bash
connectio-synful train --config my-synful.json --device cuda --steps 100
```

训练目录包含 `metrics.jsonl`、`latest.pt` 和定期保存的 checkpoint。`--steps` 是本次额外运行的步数。只加载已有权重微调时，在新目录使用 `--init-checkpoint`。接着原有优化器和采样进度训练，再评估留出区，可用下面两条命令：

```bash
connectio-synful train --config my-synful.json --device cuda \
  --resume synful-results/training/latest.pt --steps 100
```

```bash
connectio-synful validate --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda
```

验证报告给出留出区的精确率、召回率、F1 和端点距离误差。前后两端都在容差内才算匹配。在 `tests/synful_real` 的一次流程测试中，验证块内有 5 对标注；两步训练后命中 1 对，误检 0 对，漏检 4 对。这组数据用于检查输入到导出的链路，历史权重可能与标注区域有重叠。[测试步骤与记录](https://github.com/Happ1Hua/ConnectIO/tree/main/tests/synful_real)

## 提取或导出报错时

| 报错或现象 | 处理方式 |
|---|---|
| 缺少 `resolution` 或 “Expected ZYX volume” | 检查数据集键和元数据；要求三维体积及有效 ZYX 体素大小。 |
| “Input shape must align with pooling grid” | 调整网络输入 tile，使其符合池化网格；修改后运行 `inspect`。 |
| “No annotated posts in split” | 将 GT ROI 调到有 post 标注且仍在标签体积内的位置。 |
| “Output belongs to a different input/checkpoint/config” | 新运行使用新的预测或提取输出目录。 |
| “Prediction is incomplete” | 以相同输入继续 `predict`，所有块完成后再 `extract`。 |
| “CC exceeds extraction halo” | 增大 `extraction.context_nm`，并改用新的提取目录。 |
| NML “Off-grid/negative/nonfinite coordinate” | 核对 raw 体素大小、原点、轴映射及候选坐标。 |
| NML 在查看器中旋转或偏移 | 同时核对 `export.axis_order`、`export.origin_nm_xyz`、raw 的 `resolution`/`offset` 和 WEBKNOSSOS 数据集元数据。 |

## 设计选择 · 何时引入神经元标签过滤
{: #design-choice}

先在一个小区域导出未过滤的配对，把前后端分别叠回原图，核对位移方向与轴序。再用神经元标签过滤并对照两份候选表。如果一对看起来合理的端点被删掉，查看两端落在哪些神经元 ID 上。分割中的一次误合并，就可能让两个端点被当成属于同一个神经元。
