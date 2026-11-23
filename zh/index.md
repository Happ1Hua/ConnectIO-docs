---
layout: default
title: 使用手册
lang: zh
permalink: /zh/
---

# ConnectIO 文档

用 ConnectIO 可以把电镜切片整理成体数据，在 Neuroglancer 或 WEBKNOSSOS 中查看。对齐后的原图可以交给三个独立模块，分别生成神经元实例标签、线粒体实例标签或突触前后端配对。

## 第一次使用

在 Linux 工作站上，可以[用 Python 做首次转换]({{ "/zh/getting-started/" | relative_url }})。在 Slurm 集群上，可以[在图形工作台提交示例作业]({{ "/zh/gui/" | relative_url }})。两个示例都用软件自带的四张 PNG，输出尺寸均为 32 × 32 × 4。

## 模块

| 模块 | 从哪里开始 | 设计选择 |
| --- | --- | --- |
| 体数据准备 | 先[检查和对齐 TIFF 切片]({{ "/zh/modules/" | relative_url }})，再[转换格式或裁剪区域]({{ "/zh/formats/" | relative_url }})。 | [是否需要 CLAHE]({{ "/zh/modules/" | relative_url }}#design-choice) |
| 神经元分割 · LSD / ACRLSD | [根据已有数据选择起始阶段]({{ "/zh/pipeline/" | relative_url }})。已有亲和图时，可直接[提取片段并比较合并阈值]({{ "/zh/lsd-guide/" | relative_url }})。 | [比较阈值需保留哪些产物]({{ "/zh/pipeline/" | relative_url }}#design-choice) |
| 线粒体分割 · Mito | [使用内置权重预测前景与轮廓]({{ "/zh/mito/" | relative_url }})。与原图叠加时选还原到采集网格的实例标签。 | [在哪个网格复核]({{ "/zh/mito/" | relative_url }}#design-choice) |
| 突触检测 · Synful | [预测突触后位点和配对位移]({{ "/zh/synful/" | relative_url }})。先复核一个区域，再导出配对端点。 | [何时按神经元标签过滤]({{ "/zh/synful/" | relative_url }}#design-choice) |

[digspider 实验记录]({{ "/zh/case-study/" | relative_url }})记录了两次具体的排查：第 461 层附近的切片为何对不齐，以及亲和图训练中的错误怎样影响了后续分割。
