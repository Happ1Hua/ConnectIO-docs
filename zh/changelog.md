---
layout: default
title: 更新记录
lang: zh
permalink: /zh/changelog/
---

# 更新记录

## 26.09.23

- 公开计算 API 改为 Slurm 优先，CPU 默认 `C64M512G`、GPU 默认 `GPUA800`；资源和环境可配置，支持查询、等待、取消，不会回退到登录节点计算。
- 新增可独立提交的 `precomputed`、`alignment`、`affinity`、`over-segmentation`、`agglomeration`、`lut` 和 `segmentation` 阶段，保存阶段状态和持久化图数据库。
- 增加易读的阶段 JSON 示例，保留逐步 Neuroglancer 人工审查边界。
- 将项目说明整合为中英文 GitHub Pages，仓库界面 README 缩减为简要入口。

## 26.07.29

Zarr、synapse、HDF5 和 precomputed 查看迁移到交互式 Slurm；分离计算节点与浏览器端口；自动生成 SSH tunnel；增加退出清理；教程路径可迁移；大型 Zarr 默认惰性读取；查看器 CPU、内存、分区和时限可配置。

## 0.1.7

修复 HDF5 到 Zarr 转换。

## 0.1.6

修复 Zarr Neuroglancer 惰性查看生命周期和 layer 名清理；HDF5 增加 keep-alive；precomputed 到 Zarr 增加有界流式读取、read-ahead、XY tiling 及 small/large preset。

## 0.1.5

增加 precomputed 并行读取、Zarr 到 precomputed、PNG 栈转换、并行转换/处理参数和进度显示。

## 0.1.4

增加 ImageJ hyperstack TIFF 与通道拆分支持。
