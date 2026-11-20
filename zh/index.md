---
layout: default
title: 使用手册
lang: zh
permalink: /zh/
---

# ConnectIO 使用手册

第一次在集群上用 ConnectIO，可以先把随软件提供的四张 PNG 切片转成 Zarr。这个例子无需模型和实验数据，能一次检查浏览器连接、作业提交和结果读取。按[图形工作台]({{ "/zh/gui/" | relative_url }})中的“用四张切片试跑”操作。使用 Linux 工作站或 Python 的读者可从[安装与首次转换]({{ "/zh/getting-started/" | relative_url }})开始。

## 手上有什么数据？

| 起点 | 接下来做什么 |
| --- | --- |
| 一叠刚采集的 TIFF | 先检查文件顺序和逐层亮度。需要校正时，再做归一化、CLAHE 或对齐。见[从 TIFF 切片准备原图]({{ "/zh/modules/" | relative_url }})。 |
| 已对齐的切片、HDF5 或 Precomputed | 选择转换器，写出 Zarr，对照原图核实体素大小和原点。见[转换、裁剪与重采样]({{ "/zh/formats/" | relative_url }})。 |
| 已有 Zarr 原图和模型权重 | 生成推理配置，检查权重和输入网格是否匹配。见[权重与推理配置]({{ "/zh/models/" | relative_url }})。 |
| 已有神经元亲和图或 fragments | 直接从已有产物进入相应阶段，保留后续步骤要用的图数据库。见[神经元分割流程]({{ "/zh/pipeline/" | relative_url }})。 |

## 要从原图中得到什么？

- **神经元实例标签**：LSD 和 ACRLSD 先预测形状描述子和亲和图。再做分水岭、按阈值合并片段。见[从亲和图生成标签]({{ "/zh/lsd-guide/" | relative_url }})。
- **线粒体实例标签**：Mito 在模型网格上预测前景与轮廓，再将分割结果还原到原图网格。见[线粒体分割]({{ "/zh/mito/" | relative_url }})。
- **突触前后端配对**：Synful 从原图预测突触后位点和配对位移，导出 CSV 或 WEBKNOSSOS 骨架以供复核。见[突触检测]({{ "/zh/synful/" | relative_url }})。

想了解如何判断一次分割能否接受，可看 [digspider 实验记录]({{ "/zh/case-study/" | relative_url }})。其中记录了第 461 张切片附近的配准问题，以及一次训练损失下降却预测出错误亲和图的排查过程。
