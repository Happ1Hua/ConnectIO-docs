---
layout: default
title: 格式与体数据操作
lang: zh
permalink: /zh/formats/
---

# 格式与体数据操作

Zarr 是主要体数据格式。TIFF、PNG 和 TXM 导入默认写为 XYZ；部分训练流程使用 ZYX，必须明确记录转换。数据集应保存三元素 `resolution` 和 `offset`。

| 格式 | 方向 | 主要入口 |
|---|---|---|
| TIFF | 切片栈/3-D/hyperstack → Zarr；切片栈 → 3-D TIFF | `tiff_stack_to_zarr`、`tiff_3d_to_zarr`、`hyperstack_tiff_to_zarr`、`tiff_stack_to_3d_tiff` |
| PNG | 切片栈 → Zarr | `png_stack_to_zarr` |
| ZEISS TXM | TXM → Zarr | `txm_to_zarr` |
| HDF5 | HDF5 ↔ Zarr | `hdf5_to_zarr`、`zarr_raw_to_hdf5_xyz` |
| WebKnossos | WKW/ZIP ↔ Zarr | `wkw_to_zarr`、`zarr_to_wkw` |
| Neuroglancer | precomputed ↔ Zarr | `precomputed_to_zarr`、`zarr_to_precomputed` |

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    input_folder="path/to/tiffs",
    output_zarr_path="output.zarr",
    output_dataset_path="volumes/raw",
    resolution=(8, 8, 8),
)
```

PNG/TIFF 文件夹按自然顺序读取。多通道 PNG 或 hyperstack 写为独立 layer。TXM 支持多进程解码；WKW 可用于导出 WebKnossos segmentation；HDF5 导出可把 ZYX Zarr 转成其它流程需要的 XYZ。

## Precomputed 内存模式

| preset | 读取大小 | worker/read-ahead | 适用情况 |
|---|---|---|---|
| `small` | 完整 XY slab | 最多 8 / 4 | 可舒适放入内存的体积 |
| `large` | 每个空间读取最多 128 MiB | 1 / 1 | TB 级或 XY 很宽的体积 |

`large` 在 slab 超出字节预算时自动对 XY 分块。自定义时使用 `mode=None` 并设置 `max_batch_bytes`、`max_workers`、`read_ahead` 和可选 `xy_tile`。

## 体数据处理

`crop_zarr`、`rotate_zarr` 和重采样函数处理 3-D XYZ 或支持的 channel-first 数据，并更新空间元数据。旋转使用整数个 90°；重采样可指定目标物理分辨率或缩放比例；`merge_nml_files` 合并 skeleton 并解决节点 ID 冲突。完整 Slurm 用法见 `tutorials/`。
