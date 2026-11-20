---
layout: default
title: 转换、裁剪与重采样
lang: zh
permalink: /zh/formats/
---

# 转换体数据并核对坐标

`raw.zarr` 是磁盘上的目录，`volumes/raw` 是其中的一个数组。转换前先记下原图体素大小、原点和轴序，之后将标签或突触位置叠回原图时要用到这三项。

| 格式 | 方向 | 主要入口 |
|---|---|---|
| TIFF | 切片栈/3-D/hyperstack → Zarr；切片栈 → 3-D TIFF | `tiff_stack_to_zarr`、`tiff_3d_to_zarr`、`hyperstack_tiff_to_zarr`、`tiff_stack_to_3d_tiff` |
| PNG | 切片栈 → Zarr | `png_stack_to_zarr` |
| ZEISS TXM | TXM → Zarr | `txm_to_zarr` |
| HDF5 | HDF5 ↔ Zarr | `hdf5_to_zarr`、`zarr_raw_to_hdf5_xyz` |
| WEBKNOSSOS | WKW/ZIP ↔ Zarr；Zarr2 → 可直接读取的 Zarr3 dataset；官方 CLI 下采样 | `wkw_to_zarr`、`zarr_to_wkw`、`zarr2_to_zarr3`、`downsample_webknossos_layer` |
| Neuroglancer | precomputed ↔ Zarr | `precomputed_to_zarr`、`zarr_to_precomputed` |

## 将对齐后的 TIFF 转为 Zarr

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    "aligned", "raw.zarr", dataset_name="volumes/raw",
    resolution=(8, 8, 8), offset=(0, 0, 0), zarr_format=3,
)
```

请把示例中的 8 nm 和零原点换成实际值。默认集群后端会提交 CPU 作业。TIFF 切片转换器按文件名排序读取 `.tif`，请将编号补零，避免第 10 层排在第 2 层之前。原始平面按 YX 存储，转换后按 `raw[x,y,z]` 寻址。读回一张切片，再选一处能辨认的结构核对位置。导入 HDF5 时也要看目标数组自身的属性。

## 裁一块数据试跑

```python
from connectio.processing import crop_zarr

crop_zarr(
    "raw.zarr", "roi.zarr", dataset_path="volumes/raw",
    crop_bbox_xyz=((0, 1000), (0, 1000), (0, 500)),
    backend="local",
)
```

如果原图足够大，这段代码从 XYZ 三轴的起点裁出 1000 × 1000 × 500 个体素。范围右端不含，可选的裁剪参数 `offset` 使用体素索引。裁完核对输出形状和属性里的**物理原点**，尤其是从已有子块再次裁剪时。

## 旋转、重采样和大体积导入

- `rotate_zarr` 按 90° 的整数倍旋转，随轴调整体素间距。已有原点属性时会重新计算下角坐标，使体积的物理中心保持原位。内存需能容纳整个数组。
- `resample_zarr` 的 `target_resolution` 和 `scale_factors` 二选一。灰度值可用线性插值，整数标签选 `interpolation="nearest"`。另填 `output_dataset_name` 可以保留源数组。
- 导入很宽的 Precomputed 体积时，`mode="large"` 会在 XY 面分块，每次空间读取最多 128 MiB。`small` 整面读取并提前并行取数。要手动设置 `max_batch_bytes`、`max_workers` 或 `xy_tile`，将 `mode` 设为 `None`。

向 WEBKNOSSOS 交付时用 `zarr2_to_zarr3` 逐层导出，原图使用 `category="color"`，标签使用 `"segmentation"`。各层依次写入，根目录的 `datasource-properties.json` 才能记录完整。添加低分辨率层可用 `downsample_webknossos_layer`。已有容器、轴和包围盒的处理见 [Zarr 格式与坐标]({{ "/zh/zarr/" | relative_url }})。
