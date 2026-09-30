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
| WebKnossos | WKW/ZIP ↔ Zarr；Zarr2 → 可直接读取的 Zarr3 dataset；官方 CLI 下采样 | `wkw_to_zarr`、`zarr_to_wkw`、`zarr2_to_zarr3`、`downsample_webknossos_layer` |
| Neuroglancer | precomputed ↔ Zarr | `precomputed_to_zarr`、`zarr_to_precomputed` |

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    input_folder="path/to/tiffs",
    output_zarr_path="output.zarr",
    dataset_name="volumes/raw",
    resolution=(8, 8, 8),
)
```

PNG/TIFF 文件夹当前按文件名排序。请给数字层号补零（例如 `slice_0002.tif`、`slice_0010.tif`）或核对排序结果；`slice_10` 会排在 `slice_2` 前。多通道 PNG 或 hyperstack 写为独立 layer。TXM 支持多进程解码；WKW 可用于导出 WebKnossos segmentation。`zarr_raw_to_hdf5_xyz` 专门将 ZYX Zarr 输入转置为另一流程使用的 XYZ HDF5。

`zarr2_to_zarr3` 每次从指定的 `source_dataset` 转换一个 3D 图层；`category="color"` 对应 raw，`category="segmentation"` 对应标签。重复调用并指定相同 `output_dataset_path` 可逐层添加图层；每次完成后自动写入或更新根目录的 `datasource-properties.json`。`axes` 可显式指定源数据轴顺序；源数组应有 `resolution` 和 `offset` 属性，也可传入 `voxel_size` 和 `offset`。默认通过 Slurm 提交，参考 `tutorials/zarr2_to_zarr3.py`。

需要多倍率时，在转换调用中设置 `downsample_coarsest_mag=32`，或对已有 dataset 单独调用 `downsample_webknossos_layer(dataset_path, layer_name="segmentation", coarsest_mag=32)`。后者通过 WEBKNOSSOS 官方 CLI 仅处理指定图层，仍可由 Connectio 提交 Slurm。旧版 CLI 更新 metadata 后丢失的 agglomerate 附件引用会被自动保留；新增倍率的读取权限继承原倍率，不额外扩大数据集的访问范围。

## Precomputed 内存模式

| preset | 读取大小 | worker/read-ahead | 适用情况 |
|---|---|---|---|
| `small` | 完整 XY slab | 最多 8 / 4 | 可舒适放入内存的体积 |
| `large` | 每个空间读取最多 128 MiB | 1 / 1 | TB 级或 XY 很宽的体积 |

`large` 在 slab 超出字节预算时自动对 XY 分块。自定义时使用 `mode=None` 并设置 `max_batch_bytes`、`max_workers`、`read_ahead` 和可选 `xy_tile`。

## 体数据处理

`crop_zarr`、`rotate_zarr` 和重采样函数处理 3-D XYZ 或支持的 channel-first 数据，并更新空间元数据。旋转使用整数个 90°；重采样可指定目标物理分辨率或缩放比例；`merge_nml_files` 合并 skeleton 并解决节点 ID 冲突。完整 Slurm 用法见 `tutorials/`。

## 轴、元数据与覆盖检查

Zarr 路径指存储根目录；`volumes/raw` 等 dataset path 指其中的数组。必须将**实际数组轴顺序**与三元素 `resolution`、`offset` 一起记录。TIFF/PNG 栈转换输出 `(X, Y, Z)`，每张原始 `(Y, X)` 图像都转置到 XY 平面。LSD 或 Synful 的训练路径可能需要 ZYX；只修改属性名称不会转置像素。跨流程使用时，应核对 shape、已知地标与正交截面。

TIFF/PNG 栈转换会以写入模式打开 Zarr 根目录，替换该路径已有内容；`hdf5_to_zarr` 也以写入模式打开目标。要保留旧结果，应使用新的 store。`precomputed_to_zarr` 默认拒绝替换已有目标 dataset，只有启用 `overwrite` 才覆盖。大体积转换前检查目标路径，不要让两个作业同时写同一 store。

元数据需要在**目标 dataset** 上检查，不只查看 group 根。HDF5 转换会复制源 group/dataset 属性，也可另外在根目录写入传入的 `resolution`、`offset`；下游读取器可能要求特定数组上有这些属性。将转换结果用于后续处理前，用 Zarr 或查看器实际核对。

## 选择转换路线

| 来源 | 入口 | 特别检查 |
|---|---|---|
| 编号二维 TIFF/PNG 文件 | `tiff_stack_to_zarr` / `png_stack_to_zarr` | 文件名顺序、转置后的 XY、dtype、多通道 layer 名。 |
| 三维或 ImageJ hyperstack TIFF | `tiff_3d_to_zarr` / `hyperstack_tiff_to_zarr` | 栈/通道解释与目标 dataset 名。 |
| HDF5 层级 | `hdf5_to_zarr` | 数据集树、属性、chunk 和 shape。 |
| 本地 Neuroglancer precomputed | `precomputed_to_zarr` | 分辨率、Zarr v2 输出、内存模式及抽样体素一致性。 |
| 要导出到 Neuroglancer/WKW 的 Zarr | `zarr_to_precomputed` / `zarr_to_wkw` | XYZ 输入布局、体素大小、layer type 和已知坐标。 |

precomputed 源数据可独立提交 CPU 转换：

```python
from connectio.conversion import precomputed_to_zarr

job = precomputed_to_zarr(
    "source_precomputed", "raw.zarr", "volumes/raw",
    resolution=(8, 8, 8), mode="large",
)
print(job.job_id, job.stdout)
```

路径为占位示例。`mode="small"` 用完整 XY slab 和并行预读；`mode="large"` 将单次空间读取限制在 128 MiB，使用单读取者，必要时对 XY 分块。若要自行设置 `max_batch_bytes`、`max_workers`、`read_ahead` 或 `xy_tile`，请保持 `mode=None`，因为 preset 会覆盖这些值。

## 安全地裁剪、旋转和重采样

`crop_zarr` 接收 `crop_bbox_xyz`（X/Y/Z 三组起止位置）、`dataset_path` 和可选的不同 `output_dataset_path`。它的 `offset` 参数在索引前平移请求的坐标范围，`resolution` 用于更新输出属性。完成后核对形状和物理原点。若目标 dataset 已存在，函数会拒绝写入。

`rotate_zarr` 按绕实验室 X/Y/Z 轴旋转的 90° 次数工作，执行顺序由 `apply_order` 指定（默认 `xyz`）；支持三维 XYZ 和 channel-first CXYZ。旋转会更新 `resolution` 的顺序；如果输入有 `offset`，当前实现会将其重置为 `[0, 0, 0]`。与其他体积叠加前应重新确认世界坐标原点。

`resample_zarr` 可用 `target_resolution` 或 `scale_factors` 指定缩放，并采用线性插值。需保留源数据时指定 `output_dataset_name`；未指定时旋转/重采样会操作输入 dataset。线性插值会破坏离散标签 ID，因此该重采样器适用于连续强度场，不适用于类别型 segmentation 标签。完成后检查物理范围、shape、resolution 和数值范围。

## 结果验证与故障定位

删除或替换源数据前，先比较若干精确体素坐标和至少一张完整切片，同时核对 shape、dtype、通道数、`resolution` 与 `offset`。XY 看起来正确仍可能有 Z 顺序反转或轴交换。转换中断后，检查输出 store 是否不完整；除非该转换器明确支持恢复，否则使用新目标目录重新转换。
