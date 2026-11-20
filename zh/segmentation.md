---
layout: default
title: LSD 训练与标签导出
lang: zh
permalink: /zh/segmentation/
---

# LSD 训练与 WEBKNOSSOS 标签导出

使用已有权重做预测，可直接按[从亲和图生成标签]({{ "/zh/lsd-guide/" | relative_url }})操作。本页说明训练所需的标注，以及最终标签的两种交付方式。

## 用神经元标注训练

Spider 基线模型对应 8 × 8 × 8 nm FIB-SEM。转换后的权重使用 `activate_upsampling=true`，以保留原网络转置卷积后的激活。

| 阶段 | checkpoint | 迭代 |
|---|---|---:|
| LSD | `lsd_spider_8x8x8nm_fibsem_v1_450000.pt` | 450000 |
| ACRLSD | `acrlsd_spider_8x8x8nm_fibsem_v1_230000.pt` | 230000 |

准备 `volumes/raw`、整数神经元 ID 数组 `volumes/labels/neuron_ids` 和监督掩膜 `volumes/labels/labels_mask`。自定义数组名可在训练配置的 `datasets` 指定。采样前核对体素大小、轴序、单位和物理范围。训练与预测对 `uint8` 除以 255、对 `uint16` 除以 65535；浮点原图须为 [0, 1] 内的有限值，再统一映射到 [−1, 1]。

构造亲和图目标时，相邻两端属于同一非零实例才是正边。两端掩膜决定该边能否参与监督，边界上的零值也可以提供有效负样本。若预测大片连通，先看看训练样本里这些边的目标值和权重。[digspider 实验记录]({{ "/zh/case-study/" | relative_url }})给出了实际例子。训练用 `connectio-lsd-train`，初始化与续训的区别见[内存与续跑]({{ "/zh/optimization/" | relative_url }})。

## 导出单个阈值，或在查看器中切换阈值

最终阶段配置使用 `output_type="segmentation"` 时，按一个 `threshold` 写实例标签。如果要在 WEBKNOSSOS 比较多个阈值，选 `output_type="agglomerate"`，设置 `thresholds` 或 `thresholds_minmax` 与 `thresholds_step` 的组合，并填写 `agglomerate_file`、`out_file` 和 `out_dataset`。保留对应的 LUT 和图数据库。每份映射都引用随它生成的连续 ID 基础片段层。

```text
webknossos_dataset/
├── datasource-properties.json
├── zarr.json
└── segmentation/
    ├── zarr.json
    ├── 1/                         # 全局体素坐标下的 dense fragments，Zarr3
    └── agglomerates/
        ├── agglomerate_view_000/
        ├── agglomerate_view_002/
        └── ...
```

将 `webknossos_dataset_path` 指向的完整目录交给 datastore。如果已有原图数据集，则复制生成的 `segmentation/`，把标签层条目追加到 `dataLayers`，保留原图层和原比例尺。找一个明确的结构核对两层的空间位置。

## 缩小时仍能查看标签

先把示例中的数据集路径和图层名换成实际值，再运行：

```bash
connectio-segmentation-stage webknossos-downsample \
  connectio/segmentation/configs/stages/07_webknossos_downsample.example.json
```

该阶段调用 WEBKNOSSOS 的降采样工具，最粗倍率可与原图匹配。若界面显示 “Not imported yet”，先到 datastore 挂载环境检查运行账号是否能进入数据目录、读取 `datasource-properties.json`、元数据和数据块，再触发磁盘扫描并查看导入日志。
