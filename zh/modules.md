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
    kwargs={
        "input_zarr_path": "in.zarr",
        "output_zarr_path": "out.zarr",
        "dataset_path": "volumes/raw",
        "crop_bbox_xyz": ((0, 256), (0, 256), (0, 64)),
    },
    resource="cpu",
)
```

## 可逐步审查的 TIFF 流程

TIFF 预处理 CLI 默认提交 CPU 作业。每次执行一条命令，等待作业完成并检查结果，再将其输出作为下一步输入：

```bash
connectio-tiff-check --input source_tiffs --output qc
connectio-tiff-normalize --input source_tiffs --output normalized \
  --method robust-z-no-clip --z-window 21
connectio-tiff-clahe pilot --input normalized/tiffs --output clahe_pilot \
  --candidates 1.5:16,2.0:16,2.0:30
connectio-tiff-clahe apply --input normalized/tiffs --output clahe \
  --clip-limit 1.5 --grid-size 16
```

第一步生成 `summary.json`、`per_slice_qc.csv`、Z 方向亮度趋势和代表层拼图。归一化输出在 `normalized/tiffs/`，另有逐层 gain/offset 与处理前后 QC。`robust-z-no-clip` 力求避免越界像素；`mean-std-clip` 允许裁剪并统计数量。CLAHE `pilot` 只生成参数比较图，不处理全栈；`apply` 才把选定参数应用于全栈，在 `clahe/tiffs/` 写入图片和 QC。上面的路径和数值只是示例，应根据 pilot 图与原图审查决定参数。

接受预处理结果后再对齐：

```bash
connectio-align --input clahe/tiffs --output aligned --method phase
```

`phase` 估计平移；`ecc` 和 `orb` 能估计更一般的变换，结果不被接受时可回退到 phase；`--no-fallback` 可关闭回退。`aligned/alignment_report.json` 记录逐对、累计矩阵和配准指标。每张原图仅插值一次。转换成 Zarr 前检查漂移、无效边缘和 XZ/YZ 连续性。[digspider 案例]({{ "/zh/case-study/" | relative_url }})包含一次真实审查记录。

## 体数据与标注工具

`connectio.conversion` 包含 TIFF、PNG、TXM、HDF5、WKW、hyperstack 和 precomputed 转换。`connectio.processing` 提供 `crop_zarr`、`rotate_zarr`、`resample_zarr`、`downsample_zarr`、`upsample_zarr` 和 `merge_nml_files`。这些函数的轴顺序和覆盖行为需按[格式与体数据操作]({{ "/zh/formats/" | relative_url }})核对。Python 工作流还可使用 `connectio.alignment.emalignkit` 的 `register_pair`、`align_folder_pairwise`。

两个已提交作业写入同一 Zarr 时，应显式设置依赖或等待前一作业完成。提交函数会立即返回，输出此时尚未就绪。建议同一运行的路径、配置、报告和审查记录放在一起；对比处理方案时使用独立输出路径。

## 查看器使用

`tutorials/neuroglancer_view_zarr.py`、`neuroglancer_view_hdf5.py`、`neuroglancer_view_synapse.py` 和 `neuroglancer_view_precomputed_http.py` 配置交互式 Slurm 服务。先修改数据路径、dataset、站点登录地址、本机/远程端口及资源，再在交互终端启动脚本。启动器打印作业号并持续跟随日志，同时提供 SSH tunnel 命令；在自己的电脑建立隧道后打开本地 URL。终端中按 Ctrl+C 会取消其申请的查看器作业。

大型 Zarr 默认使用惰性读取，只有数据能放进申请的内存时才考虑整体载入。channel-first affinity 需要能选择通道的图层或 shader；raw 灰度图层不会自动正确显示所有通道。接受坐标映射前，应检查已知地标及三个正交截面。

## 按任务查找示例

| 任务 | 教程文件 |
|---|---|
| TIFF/PNG/TXM 与 hyperstack 导入 | `tiff_to_zarr.py`、`png_stack_to_zarr.py`、`txm_to_zarr.py` |
| HDF5/WKW 互转 | `hdf5_to_zarr.py`、`zarr_to_hdf5.py`、`wkw_to_zarr.py`、`zarr_to_wkw.py` |
| Neuroglancer precomputed | `precomputed_to_zarr.py`、`neuroglancer_generate_precompute_format.py` |
| 裁剪、旋转、重采样 | `crop_zarr.py`、`rotate_zarr.py`、`resample_zarr.py` |
| TIFF QC 与对齐 | `tiff_preprocessing.py`、`align_tiffs.py` |
| LSD 推理与查看 | `lsd_inference.py`、`neuroglancer_view_zarr.py` |
| Skeleton 标注 | `merge_nmls.py` |

部分示例含站点专用数据路径和资源值，应先改成自己的工作区，再检查提交记录和输出。[Slurm 执行]({{ "/zh/slurm/" | relative_url }})解释通用提交选项。
