---
layout: default
title: 中文文档
lang: zh
permalink: /zh/
---

# ConnectIO

ConnectIO 提供可迁移的连接组学格式转换、预处理、对齐、分割和可视化流程。**26.09.23** 版本将计算入口统一为 Slurm 优先执行，并将分割流程拆成可单独提交、单独审查的阶段。

## 文档

- [安装与开始]({{ "/zh/getting-started/" | relative_url }})：环境、安装和首次提交。
- [raw 到 segmentation 流程]({{ "/zh/pipeline/" | relative_url }})：阶段边界、人工审查和断点启动。
- [分割]({{ "/zh/segmentation/" | relative_url }})：LSD/ACRLSD、Funke 后处理、配置、MongoDB 状态和模型。
- [Slurm 执行]({{ "/zh/slurm/" | relative_url }})：默认资源、覆盖参数、作业对象和集群规则。
- [模块与教程]({{ "/zh/modules/" | relative_url }})：格式、预处理、对齐、可视化和示例。
- [格式与体数据操作]({{ "/zh/formats/" | relative_url }})：支持的互转格式、内存模式和处理操作。
- [更新记录]({{ "/zh/changelog/" | relative_url }})：当前及历史版本。
- [digspider 实测案例]({{ "/zh/case-study/" | relative_url }})：8 nm 全流程及 affinity 监督修复记录。

## 设计规则

1. 计算入口默认提交 Slurm，提交失败时不会退回登录节点计算。
2. 每个科学处理阶段只生成可审查的结果并停止；人工确认后再提交下一阶段。
3. 数据路径写入 JSON，相对路径以配置文件所在位置解析，整套流程可整体迁移。
4. 各阶段引用根目录下同一份 raw Zarr，不重复复制大体积数据。
5. Neuroglancer 保持原有手动 Slurm 查看方式。
