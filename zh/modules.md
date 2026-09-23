---
layout: default
title: 模块与教程
lang: zh
permalink: /zh/modules/
---

# 模块与教程

## 格式转换与体数据处理

ConnectIO 支持 TIFF、PNG、TXM、HDF5、WKW、Neuroglancer precomputed 与 Zarr 之间的转换，并提供 Zarr 裁剪、旋转和重采样。转换尽可能流式读取并保留空间元数据。无损 TIFF 转换应核对切片顺序、shape、dtype、hash 或逐体素相等，并明确写入 `resolution` 和 `offset`。

## 预处理

TIFF 工具包含 QC、归一化和 CLAHE。QC 输出逐层统计、亮度趋势和跳变候选，不修改像素。归一化与 CLAHE 分别审查；局部亮斑、竖向条纹等拍摄问题应记录，不应误判为处理错误。CLI 分别为 `connectio-tiff-check`、`connectio-tiff-normalize` 和 `connectio-tiff-clahe`。

## 对齐

`connectio-align` 和 `align_folder_pairwise` 支持 phase、ECC 和 ORB。逐对变换累计到第一层，每张源图只插值一次。应检查累计漂移、重叠区、无效边缘以及 XZ/YZ 连续性；配准分数不能替代人工检查。

## 可视化

Neuroglancer 脚本是手动 Slurm 查看入口。设置 Zarr path 和 dataset 后启动，等待连接记录，在本机执行打印出的 SSH tunnel，再打开本地 URL。raw 标量数据与 channel-first affinity 需要不同的 shader/显示范围。查看器不是计算函数，因此没有改成通用提交器。

## 教程索引

`tutorials/` 提供 TIFF/PNG/TXM 到 Zarr、HDF5/WKW 互转、precomputed 转换、裁剪、重采样、旋转、NML 合并、TIFF 预处理、TIFF 对齐、LSD 推理和 Neuroglancer 查看示例。每个计算示例设置 `SLURM_OPTIONS`，调用真实 ConnectIO 函数并打印作业信息。两个操作写入同一 Zarr 时应设置 `afterok` 依赖。

登录节点也可只按模块和函数名提交，无需导入影像依赖：

```python
from connectio.execution import submit_function

job = submit_function(
    "connectio.processing.crop", "crop_zarr",
    kwargs={"input_zarr_path": "/data/in.zarr", "output_zarr_path": "/data/out.zarr"},
    resource="cpu",
)
```
