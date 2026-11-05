---
layout: default
title: 更新记录
lang: zh
permalink: /zh/changelog/
---

# 更新记录

## 26.11.05 — 2026-11-05

- 为转换及裁剪教程加入 `--zarr-format {2,3}`，新输出默认使用 Zarr3。
- 验证默认与显式格式、参数校验及实际像素写入，补充已有容器和 WEBKNOSSOS 专用教程说明。

## 26.11.02 — 2026-11-02

- 修复文件覆盖、检查点加载、进程归属及 Zarr2/Zarr3 续跑完整性问题。
- Funke 状态绑定输入与配置身份；自动 MongoDB 仅监听本地，日志隐藏凭据。
- 修复跨块 NMS 平台、稀疏实例评估、切片校验、元数据与 NML 合并引用。
- 迁移要求、验证和限制见[审查修复记录]({{ "/zh/audit/" | relative_url }})。

## 26.10.28 — 2026-10-28

- 转换、处理、模型流程及 Neuroglancer 共用 Zarr2/Zarr3 读写层。
- 保留 WEBKNOSSOS ROI、轴、尺度和标签 ID；Zarr2 保持原生实现与默认输出。
- 增加显式输出格式、LSD 训练数组映射和双格式回归测试。
- 合并本地/Slurm 执行更新，同步 README、示例及中英文文档。

## 26.10.23 — 2026-10-23

- Mito 支持按块读取 XYZ/ZYX Zarr，原网格结果恢复输入轴顺序。
- 统一校验三种轴元数据与显式配置，像素和物理坐标同步重排；缺少轴声明时要求显式配置。
- 训练和评价支持不同存储轴顺序，模型权重保持不变。

## 26.10.22 — 2026-10-22

- 新增原生 PyTorch residual-SE U-Net+ 线粒体分割、严格权重转换与 `connectio-mito` 入口。
- 接入 `mito-joint` 模型配置和预检，支持双体积训练、Zarr 重采样、分块推理、全局 BC 分水岭与原网格导出。
- 迁移双 GT 联合训练选出的第 2000 步权重，附 SHA256、选模记录与本地 Hugging Face 上传包；同步更新中英文文档。

## 26.10.13 — 2026-10-13

- 增加 Spider、DigSpider、联合 LSD/ACRLSD 和 paired Synful 的本地推理配置生成。
- 增加 checkpoint 参数与身份冲突校验，以及无需 GT 的只读推理预检。
- 修复不含训练配置的 Synful 导出权重推理，并保留向量缩放语义。
- 模型仓库当前为 private，文档区分授权下载和直接使用本地权重。


## 文档更新 — 2026-10-08

- 增加公开模型链接和中英文下载指南，说明 LSD/Synful 的固定版本下载、校验、配套配置及初始化／恢复限制。

## 26.10.04 — 2026-10-04

- 增加训练几何校验、采样上限、全局样本编号恢复与 checkpoint 原子保存。
- 增加 Synful raw/输出 chunk 版本校验、带恢复日志的有界重采样及 uint64 标签最近邻支持。
- 增加磁盘计数评估、有界 batch/多 GPU 推理、可选 CUDA 混合精度及耗时报告。

- LSD/ACRLSD 训练与推理统一 raw 归一化，支持 uint16 与归一化浮点输入。
- 推理续跑绑定权重、输入版本、几何与配置签名，完成状态按 dataset 隔离并限制单进程写入；无签名 legacy 输出须另建路径。
- 评估保留小数空间几何，校验轴、单位及体素网格，提供 legacy 轴声明参数。
- 增加科学输入输出正确性的 CPU 回归检查。

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
