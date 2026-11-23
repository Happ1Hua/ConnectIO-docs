---
layout: default
title: 线粒体分割
lang: zh
permalink: /zh/mito/
---

# 用 Mito 分割线粒体

Mito 给每个线粒体分配一个整数 ID。与电镜原图叠加时应打开 `native.zarr/volumes/mitochondria`。概率图和分水岭的中间产物使用模型网格。

## 配置原图

在模型环境中安装 `.[mito-pytorch]`。下面从源码目录使用内置的 `mito-joint` 权重。原图应为三维 `uint8` 数组，XY 体素大小为 8 nm，可按 XYZ 或 ZYX 存储。`resolution`、`offset` 按数组实际轴序填写，单位为 nm。原数组缺少轴属性时，在配置中显式填 `"axes": "xyz"` 或 `"axes": "zyx"`。

```bash
connectio-models configure --bundle mito-joint \
  --checkpoint-dir connectio/mito_segmentation/models --raw /path/to/raw.zarr \
  --output mito-results --config-dir runs/mito
connectio-mito inspect --config runs/mito/mito.json
```

生成的配置使用绝对路径。`inspect` 检查权重与几何，并显示原图和输出轴序。例如原图 XYZ 间距 [8, 8, 12] nm，在模型中按 ZYX 读为 [12, 8, 8]。准备阶段沿 Z 重采样，得到 30 × 8 × 8 nm 的模型网格。

## 预测，再还原到原图网格

默认 Slurm 后端将下面各步分别提交，请等前一步完成。工作站可加 `--backend local`。预测可用 GPU。分割使用全局 CPU 分水岭，内存下限按模型网格每体素 64 字节估算。要在 Slurm 作业中另行申请足够的主机内存，`--memory-gib` 设置程序内部的保护阈值。

```bash
connectio-mito prepare --config runs/mito/mito.json
connectio-mito predict --config runs/mito/mito.json --device cuda
connectio-mito segment --config runs/mito/mito.json --memory-gib 192
connectio-mito restore --config runs/mito/mito.json
```

| 结果位置 | 检查内容 |
| --- | --- |
| `prepared.zarr/volumes/raw` | 模型网格上的 ZYX 原图 |
| `prediction.zarr/volumes/probabilities` | 先前景、后轮廓，形状 [2,Z,Y,X]，uint8 以 255 表示概率 1 |
| `instances.zarr/volumes/mitochondria` | 模型网格上全局唯一的 uint32 实例 ID |
| `native.zarr/volumes/mitochondria` | 最近邻映射回原图轴序、形状、体素大小和原点的标签 |

`run` 在同一份资源内运行以上四步。小范围试算可用 `predict --max-blocks N`，输入保持一致，去掉限制即可继续。准备或分水岭中断后，先检查留下的 `.partial.zarr` 再重试。

## 推理参数

| 配置 | 默认值与含义 |
| --- | --- |
| `inference.input_shape` | `[17,257,257]`，ZYX，网络同尺寸输出 |
| `inference.stride` | `[8,128,128]`，不允许大于 tile 留空洞 |
| `inference.block_shape` | `[64,512,512]`，控制拼接内存 |
| `inference.padding` | `[4,64,64]`，体积边界反射填充 |
| `inference.batch_size` | `1` |
| `inference.tta` | `4` 表示 XY 翻转，`1` 表示不增强 |
| 标准化 | `(uint8 / 255 - 0.5) / 0.5` |
| 拼接 | sigma=0.2、floor=1e-4 的高斯加权，量化为 uint8 概率 |
| 分水岭 | `thres1=.85`、`thres2=.6`、`thres3=.8`、`thres_small=1024`、`seed_thres=32` |

## 用实例标注训练和评估

复制 `connectio/mito_segmentation/configs/training/joint.json`，为每个标注体分别填写配对的原图和标签路径。两个体积内相同的整数可代表不同实例，因此要分开保存。`train_z` 和 `val_z` 在重采样后的模型网格上取值。整数标注与原图应覆盖相同物理范围，若轴序不同，可单独设置 `labels_axes`。

```bash
connectio-mito prepare-training --config my-training.json
connectio-mito train --config my-training.json --device cuda \
  --init-checkpoint connectio/mito_segmentation/models/joint/spider_fibsem_mito_v1.pt
connectio-mito train --config my-training.json --device cuda \
  --resume /path/to/new-mito-training/train/mito_1000.pt
```

用 `--init-checkpoint` 初始化新训练。原生训练保存点中包含优化器和随机数状态，可用 `--resume` 续训。评估时从留出区裁剪，并保留其真实物理原点。

```bash
connectio-mito evaluate --config runs/mito/mito.json \
  --gt-file /path/to/holdout.zarr --gt-dataset volumes/mito_segmentation \
  --prediction-file /path/to/holdout-output/native.zarr --memory-gib 16
```

## 内置权重来自哪次训练？

`spider_fibsem_mito_v1.pt` 来自 digspider 与 E1Sp5D3 的 5000 步联合微调，按两个留出区等权平均的 AP75 选中第 2000 步。每个标注块在模型网格的 Z [0,70) 用于训练、[86,107) 用于验证。下表为当时选模的结果。

| 验证集 | AP | AP50 | AP75 |
| --- | ---: | ---: | ---: |
| digspider | 0.349222 | 0.445545 | 0.445545 |
| E1Sp5D3 | 0.534018 | 0.745403 | 0.571465 |
| 等权平均 | 0.441620 | 0.595474 | 0.508505 |

转换后权重的 SHA-256 为 `b153d123e82fbe26346724c1a8cf82046445163c19ea0f5ae39676e042d8ef79`。清单和一致性记录位于 `connectio/mito_segmentation/models/joint/`。CPU 核验比较了参考网络输出、增强预测和分水岭结果。换新样本时，可先在有标注的区域复核原网格标签，再解释全体积的实例数。

如果要从原始训练归档重新生成这份权重，可指定来源文件的 SHA-256 进行转换。原始归档需单独提供。

```bash
connectio-mito convert \
  --source-checkpoint /path/to/selected_checkpoint.pth.tar \
  --output-checkpoint /path/to/new/spider_fibsem_mito_v1.pt --bundle mito-joint \
  --expected-sha256 34420077f8b2ce133ef3b477c7f77bf32c2b5071e4c74e321aa99912baf1b7d3
```

## 设计选择 · 如何选择复核用的网格
{: #design-choice}

发现线粒体漏分时，先在模型网格上看前景与轮廓两个通道，再和分水岭结果比较，就能判断问题出现在哪一步。要对照原始切片里的具体结构，再打开还原到原网格的实例标签。最近邻还原可以保留实例 ID；即使还原后的 Z 间距更细，预测本身的细节仍由模型网格决定。
