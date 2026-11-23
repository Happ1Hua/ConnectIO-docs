---
layout: default
title: 从 TIFF 切片准备原图
lang: zh
permalink: /zh/modules/
---

# 从 TIFF 切片准备原图

将采集到的切片留在 `source_tiffs/`，每道处理单独选一个输出目录。下面的命令默认提交 Slurm，等当前作业完成并检查结果后再执行下一条。在工作站上先设置 `CONNECTIO_EXECUTION_BACKEND=local`。也可以在[图形工作台]({{ "/zh/gui/" | relative_url }})中执行相同操作。

## 先检查亮度跳变在哪一层

```bash
connectio-tiff-check --input source_tiffs --output qc
```

打开 `qc/z_intensity_trends.png`。如果某层附近的均值突然变化，到 `per_slice_qc.csv` 找到对应切片，再看原图。局部条纹可能在整体亮度拉齐后依然可见。保留 `summary.json`，后面可与处理后的统计值比较。

## 归一化，再试局部对比度

```bash
connectio-tiff-normalize --input source_tiffs --output normalized \
  --method robust-z-no-clip --z-window 21
```

例中用 21 层的窗口估计亮度变化。对照 `normalized/tiffs/` 和原始切片，检查亮区是否丢失细节。若膜结构仍难辨认，可在这批输出上试做 CLAHE。

```bash
connectio-tiff-clahe pilot --input normalized/tiffs --output clahe_pilot \
  --candidates 1.5:16,2.0:16,2.0:30
```

先看参数对比图，观察膜边界和噪声。下面的全栈命令使用裁剪限值 1.5、网格大小 16；换成你在试验图上选中的组合。

```bash
connectio-tiff-clahe apply --input normalized/tiffs --output clahe \
  --clip-limit 1.5 --grid-size 16
```

## 对齐后再转成 Zarr

```bash
connectio-align --input clahe/tiffs --output aligned --method phase
```

输入选上一步实际采用的切片目录。`phase` 估计平移，更复杂的变形可试 `ecc` 或 `orb`。先看 `aligned/alignment_report.json` 中的累计位移，再看边缘缺损及 XZ、YZ 面上的连续性。对齐后的 TIFF 直接写在 `aligned/`，可将它交给[TIFF 转 Zarr]({{ "/zh/formats/" | relative_url }})。

## 查找其他教程脚本

| 任务 | 教程文件 |
|---|---|
| TIFF/PNG/TXM 与 hyperstack 导入 | `tiff_to_zarr.py`、`png_stack_to_zarr.py`、`txm_to_zarr.py` |
| HDF5/WKW 互转 | `hdf5_to_zarr.py`、`zarr_to_hdf5.py`、`wkw_to_zarr.py`、`zarr_to_wkw.py` |
| Neuroglancer precomputed | `precomputed_to_zarr.py`、`neuroglancer_generate_precompute_format.py` |
| 裁剪、旋转、重采样 | `crop_zarr.py`、`rotate_zarr.py`、`resample_zarr.py` |
| TIFF QC 与对齐 | `tiff_preprocessing.py`、`align_tiffs.py` |
| LSD 推理与查看 | `lsd_inference.py`、`neuroglancer_view_zarr.py` |
| Skeleton 标注 | `merge_nmls.py` |

[教程目录](https://github.com/Happ1Hua/ConnectIO/tree/main/tutorials)里的脚本可复制修改。运行前换成自己的路径和作业资源。查看 Zarr、HDF5、Precomputed 或叠加突触标记时，选择对应的 `neuroglancer_view_*` 脚本，在自己电脑上按提示建立隧道。亲和图带通道维度，要逐方向查看。

## 设计选择 · 是否需要 CLAHE
{: #design-choice}

先在少数归一化切片上试参数。对照同一视野里一段较暗的膜和一块灰度均匀的组织，看膜能否连续辨认，也看背景起伏是否被放大成了假边缘。如果归一化后已经看得清膜，就直接用这批切片做对齐。
