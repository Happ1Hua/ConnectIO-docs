---
layout: default
title: Synful PyTorch
lang: zh
permalink: /zh/synful/
---

# Synful PyTorch：突触检测与 pre/post 配对

ConnectIO 将 Synful 的 PyTorch 实现放在独立的 `connectio.synapse_detection.synful_pytorch` 包中，而不是 `segmentation` 目录。模型预测突触位置概率及指向配对端点的位移向量；后续流程提取 pre/post 候选，并导出 CSV 和 WEBKNOSSOS NML 骨架。包中还包含训练、验证、TensorFlow NPZ 权重转换、可选的分割过滤及分块 NMS 工具。

Synful 与 [LSD/ACRLSD 分割流程]({{ "/zh/segmentation/" | relative_url }})分别运行。两者可以引用同一 raw 或神经元分割体积，但配置、checkpoint 和输出目录各自独立。ConnectIO 不附带原 Synful 项目的实验数据或训练权重。

## 1. 安装

Synful 已收录于 [ConnectIO 主分支](https://github.com/Happ1Hua/ConnectIO/tree/main)：

```bash
git clone https://github.com/Happ1Hua/ConnectIO.git
cd ConnectIO
python -m pip install -e '.[synful-pytorch]'
connectio-synful --help
```

请选择与显卡和驱动兼容的 PyTorch 环境。`synful-pytorch` extra 安装 Python 依赖，但不替用户选择 CUDA 构建，也不自动申请 GPU 作业。正式训练、全体积推理和 GPU 验证应在已分配资源的计算节点执行；CPU 更适合小 ROI 流程检查。

如果命令行脚本不可用，也可运行 `python -m connectio.synapse_detection.synful_pytorch`。原先导入 `connectio.segmentation.synful_pytorch` 的脚本需要改为新路径；`connectio-synful` 命令名保持不变。

## 2. 准备输入和配置

复制[仓库中的示例 JSON](https://github.com/Happ1Hua/ConnectIO/blob/main/connectio/synapse_detection/configs/synful.example.json)：

```bash
cp connectio/synapse_detection/configs/synful.example.json my-synful.json
```

示例路径和 ROI 都是占位值，执行 `inspect` 前必须修改。当前实现以**命令执行时的工作目录**解析相对输入和输出路径；Slurm 脚本从不同目录启动时，绝对路径更稳妥。示例使用的 `my-synful.json` 和 `synful-results/` 已加入 `.gitignore`。

| JSON 字段 | 用途 | 使用前检查 |
|---|---|---|
| `data.gt_file` | 监督训练与验证所用的 HDF5 GT crop | 包含 raw、神经元标签及 CREMI 突触标注。 |
| `data.inference_file` | 待预测的 HDF5 或 Zarr raw 体积 | `raw_dataset` 对应三维 ZYX 数据。 |
| `data.raw_dataset` | 两份输入中的 raw 数据集键 | 例如 `volumes/raw`。 |
| `data.labels_dataset` | GT 文件中的神经元 ID 数据集键 | 例如 `volumes/labels/neuron_ids`。 |
| `splits.train` / `splits.validation` | 两个 GT ROI 的 `offset_nm`、`shape_nm` | 使用绝对 ZYX 纳米坐标；ROI 位于标签体积内，且包含标注的 post 端点。 |
| `model` | 网络宽度、输出头数、下采样因子 | 恢复训练和验证时必须与 checkpoint 网络结构相同。 |
| `training` | 输入形状、损失、增强、优化器、输出及保存周期 | 输入形状必须满足 valid convolution 与池化网格要求。 |
| `inference` | 推理输入 tile、输出目录、可选 AMP | 更换权重、raw、ROI 或 tile 后使用新输出目录。 |
| `extraction` | CC/NMS、阈值、分块形状及上下文 | CC 与 NMS 的 score 含义不同。 |
| `export` | WEBKNOSSOS 数据集名称与 XYZ 轴映射 | 对照目标数据集核对体素大小、原点和轴方向。 |
| `postprocessing`（可选） | 神经元分割体积及配对过滤 | 不配置时直接导出未过滤候选。 |

输入体积必须是三维，数据集属性 `resolution` 为三个正数，表示 ZYX 体素大小（纳米）。`offset` 也是 ZYX 纳米坐标；缺失时按零处理。无符号整数 raw 会自动归一化；浮点 raw 必须已经位于 `[0, 1]`。GT HDF5 还需有 `annotations/ids`、`annotations/locations` 和 `annotations/presynaptic_site/partners`；标注坐标会叠加 `annotations` group 中的 offset。

先检查体积、标注、ROI 内 post 数量和网络输出形状：

```bash
connectio-synful inspect --config my-synful.json
```

`inspect` 会实际打开 GT 和推理输入，并不是脱离数据的 dry run；任何占位路径或缺失的数据集都会报错。

## 3. 从头训练与续训

在已分配 GPU 的节点上运行：

```bash
connectio-synful train --config my-synful.json --device cuda --steps 100
```

100 步只用于检查流程，不能代表模型收敛。`--steps` 表示**本次额外运行的步数**；不指定时按 `training.max_steps` 训练。训练从 GT crop 采样 raw 和标签，生成 indicator 与位移监督目标，按配置增强，并按 `training.validation_every` 检查 validation split。

训练目录包含 `config.json`、`metrics.jsonl`、`latest.pt` 及定期保存的 `step_XXXXXXX.pt`。不指定 `--resume` 时，如果目录中已有 `latest.pt`，训练会拒绝复用。继续同一次训练：

```bash
connectio-synful train --config my-synful.json --device cuda \
  --resume synful-results/training/latest.pt --steps 100
```

续训恢复模型、优化器、scaler、步数和保存的 PyTorch RNG 状态。模型、数据、split 和指定的训练语义必须与 checkpoint 相容；独立实验请换输出目录。

Python API 提供 `train(config, init_checkpoint=...)` 以只读取初始权重，但目前 `connectio-synful train` **没有** `init_checkpoint` 参数。`--resume` 是完整续训，不是“仅加载权重”的微调开关。

## 4. 先检查 ROI，再运行全体积推理

`predict` 需要同时包含 indicator 与 partner-vector 输出的已训练 checkpoint。先指定一个在 raw 内、与体素网格对齐的小 ROI；offset 和 shape 均为 ZYX 纳米：

```bash
connectio-synful predict --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda \
  --roi-offset-nm 0 0 0 --roi-shape-nm 512 1024 1024 \
  --output-dir synful-results/roi-check
```

上面的 ROI 数字只是命令格式示例，应替换为你的数据范围。两个 ROI 参数必须同时提供。`--max-blocks 1` 可在写入首块后停止，适合控制流程检查；此时预测仍未完成，不能提取，需用同一输入继续 `predict`。全体积推理则省略 ROI 参数：

```bash
connectio-synful predict --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda
```

输出包括 `prediction.zarr` 中的 `volumes/pred_syn_indicator`（float32 概率）和 `volumes/pred_partner_vectors`（float32 纳米位移），以及 `prediction.sqlite` 和锁文件。预测保留 `resolution`、`offset` 元数据；两个数组都写入后才把该块记录为完成。同一输出目录和签名重复运行时会跳过完成块。签名包含输入路径与几何信息、checkpoint 哈希、tile、ROI、halo 和量化设置；改变这些条件后须使用新目录。

`run` 在预测全部完成后，继续做提取和导出：

```bash
connectio-synful run --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda
```

预测未完成时，`run` 不执行导出；使用 `--max-blocks` 提前停止也一样。

## 5. 提取、过滤和导出

已有完整预测场时，无需重跑网络：

```bash
connectio-synful extract --config my-synful.json
```

命令读取 `inference.output_dir/prediction.zarr`，定位 post 端点并按位移场找到 pre 端点，写出 `synapses/synapses.npz`。NPZ 保存候选 ID、配对位置、score、体素大小和 offset；`synapses/` 中另有提取进度的 SQLite 文件。

| `extraction` 参数 | 行为 |
|---|---|
| `method: "cc"` | 对高于 `threshold` 的体素做连通域提取；`score_type` 可为 `sum`、`mean`、`max` 或 `count`。 |
| `method: "nms"` | 在高于 `threshold` 的概率场中取局部峰值；score 是峰值概率。 |
| `score_threshold` | 丢弃不高于阈值的候选；数值含义取决于所选方法。 |
| `context_nm` | 分块提取时的 halo；必须覆盖 NMS 半径。CC 延伸到 halo 边界时会报错。 |
| `block_shape` | 提取核心区域大小，单位为 ZYX 体素。 |
| `min_distance_nm` | 允许的最短 pre/post 距离。 |

CC 的概率和阈值不能直接用于 NMS 峰值概率。如果 CC 到达 halo 边界，应增大 `extraction.context_nm`，并换用新的提取目录或结果目录。提取签名绑定预测数据和提取参数。

默认导出在推理目录生成 `03.synapses.csv`、`06.synapses.nml` 和 `export_report.json`。配置可选 `postprocessing` 时，还会查询端点的神经元标签、移除邻近重复候选，并生成 `04.filtered_synapses.csv` 与 `06.filtered_synapses.nml`。该 section 需要 `segmentation_file`、`segmentation_dataset`、`distance_threshold_nm`；分割体积必须覆盖候选，物理坐标应与 raw 一致。

## 6. 坐标与 WEBKNOSSOS

Synful 内部使用 **ZYX 顺序的纳米坐标**。候选 CSV 显式包含 `pre_z_nm`、`pre_y_nm`、`pre_x_nm`、`post_z_nm`、`post_y_nm`、`post_x_nm`。NML 中每对突触为一个 tree、两个 node 和一条 edge；node 坐标是非负整数的 mag-1 **XYZ 体素坐标**。非有限、负数或未对齐体素网格的点会被拒绝。

`export.axis_order` 指定 NML 输出 XYZ 各轴分别取自原坐标的哪个轴。示例默认 `xyz`，部分数据集需要 `zyx`。导入前务必与目标 WEBKNOSSOS 数据集方向核对，尤其要叠加已知点检查。NML 的 scale 取自 raw 体积的体素大小；若目标数据集使用非零物理原点，应明确设置 `export.origin_nm_xyz` 并验证。NML 只含骨架，不附带 raw 或分割体积。

也可以单独把 CSV 转换为 NML：

```bash
python -m connectio.synapse_detection.synful_pytorch.io.nml \
  --csv synful-results/inference/03.synapses.csv \
  --output synful-results/inference/review.nml \
  --dataset YOUR_WEBKNOSSOS_DATASET \
  --voxel-size-xyz 8 8 8 --axis-order xyz
```

只有明确知道输入语义后，才使用 `--origin-nm-xyz`、`--schema` 或 `--score-threshold`。单独转换命令默认不覆盖已存在的 NML；确需重新生成时指定 `--overwrite`。

## 7. 验证与指标解释

```bash
connectio-synful validate --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda
```

验证在 GT 的 `validation` ROI 上预测和提取，并将 `metrics.json` 写到 `training.output_dir/validation/<checkpoint-hash>/`。指标包括 TP、FP、FN、precision、recall、F1 和 pre/post 平均端点误差。配对成功要求**两个端点**都在匹配距离内；Python API 默认 400 nm。匹配依据是端点距离，不检查神经元 ID。结果只说明该 GT ROI 的表现；如果旧权重与该区域有训练重叠，不能视作独立测试成绩。

将原 TensorFlow 权重先导出到 NPZ 后，可运行 `connectio-synful convert-tf --weights-npz WEIGHTS.npz --checkpoint OUTPUT.pt --config my-synful.json` 转换一个兼容网络。只有 indicator 或只有 vector 的单任务 checkpoint 无法完成配对推理；旧版两个独立网络应组成保留双方权重的 paired checkpoint。

## 8. 常见报错

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

[源码包说明](https://github.com/Happ1Hua/ConnectIO/blob/main/connectio/synapse_detection/synful_pytorch/README.md)和[示例配置](https://github.com/Happ1Hua/ConnectIO/blob/main/connectio/synapse_detection/configs/synful.example.json)可配合本页使用。
