---
layout: default
title: Zarr2 与 Zarr3 兼容
lang: zh
permalink: /zh/zarr/
---

# 26.10.28 的 Zarr2 / Zarr3 支持

Connectio 自动识别本地目录中的 Zarr2 与 Zarr3。Zarr2 保留现有 `zarr<3`
实现；Zarr3 由 TensorStore 读取，支持 WEBKNOSSOS 的 `sharding_indexed`、
transpose、bytes、zstd 和校验码。不升级或全局修改第三方 Zarr。

## 功能范围

| 流程 | Zarr3 适配 | Zarr2 兼容 |
| --- | --- | --- |
| PNG、TIFF stack、3D TIFF、hyperstack、TXM、HDF5、WKW annotation、precomputed → Zarr | 显式选择 v3 输出 | Python API 默认 v2；教程默认 v3 |
| Zarr → HDF5、WKW、precomputed、WEBKNOSSOS | 读取数组/层并保留声明的坐标 | 保留原有输入支持 |
| 裁剪、旋转、上/下采样 | v3 读写；已注册 WK 数组须使用不同输出 | 保留原有处理及恢复机制 |
| LSD/ACRLSD 训练、推理、评估、模型预检 | 统一读取、v3 预测输出、可配置训练数组路径 | 保留默认路径与 v2 输出 |
| Funke watershed、agglomeration、LUT、segmentation | Daisy 适配 v3 和物理 ROI | 保留旧版 Daisy 原生 v2 路径 |
| Mito 准备、训练数据、预测、watershed、原网格导出、评估 | 统一读写，保留 XYZ/ZYX 元数据 | 保留轴校验及模型网格要求 |
| Synful 训练、预测/续跑、提取、评估、CSV/NML 导出 | WK XYZ 输入按需转为 ZYX；v3 输出块完整性检查 | 保留 ZYX/HDF5 和 v2 预测 |
| Neuroglancer、突触叠加、LSD 查看器、precomputed 导出 | 按元数据懒加载并选择倍率 | 使用相同入口 |
| TIFF 预处理/对齐、NML 合并、checkpoint 转换 | 不读写 Zarr，无需格式转换 | 保持原生格式与接口 |

## 选择输出格式

```python
from connectio.conversion import tiff_stack_to_zarr

tiff_stack_to_zarr("input-tiffs", "new-output.zarr", zarr_format=3, backend="local")
```

带执行装饰器的 API 接受 `zarr_format=2/3`；CLI 接受 `--zarr-format 3`，
通过 Slurm 提交时也会传递。模型 JSON 顶层可设置 `"zarr_format": 3`；
原生 Funke 阶段配置接受同名字段。环境变量 `CONNECTIO_ZARR_FORMAT=3`
设置进程默认值；Python 内可用 `connectio.zarr_io.output_format(3)` 上下文。

已有存储保留格式：上下文或环境默认值不会静默迁移已有 v2 根目录。
需要切换格式时使用新的输出目录；显式指定与已有存储冲突的格式会报错。
新 v3 输出是普通数值型 Zarr3 数组，**不会自动注册为 WEBKNOSSOS dataset**。
需要 `datasource-properties.json`、倍率与 attachments 时，继续使用 WEBKNOSSOS
导出阶段。已有 `zarr2_to_zarr3` API 名称保留，也可以重新导出 v3 源数组。

## 教程输出格式（26.11.05）

`tiff_to_zarr.py`、`png_stack_to_zarr.py`、`txm_to_zarr.py`、`hdf5_to_zarr.py`、
`wkw_to_zarr.py`、`precomputed_to_zarr.py` 和 `crop_zarr.py` 支持
`--zarr-format {2,3}`，新输出默认 **Zarr3**。先修改脚本中的示例输入与输出路径。
脚本顶部的 `ZARR_FORMAT = 3` 控制默认值，命令行指定值优先。

```bash
export CONNECTIO_EXECUTION_BACKEND=local
python tutorials/tiff_to_zarr.py                  # 默认 Zarr3
python tutorials/tiff_to_zarr.py --zarr-format 2  # Zarr2
```

Python API 新建存储的默认值仍为 Zarr2；上述默认 Zarr3 仅适用于这七个教程。
追加到已有容器时格式必须匹配，切换格式需使用新输出目录。旋转和重采样教程继承
现有容器的格式。专用 WEBKNOSSOS 导出固定为 Zarr3，倍率脚本处理现有 dataset；
HDF5/WKW/precomputed 导出及可视化脚本使用其各自格式。

测试结果见[教程格式验证记录]({{ "/validation/tutorial-formats-26.11.05.json" | relative_url }})。

## WEBKNOSSOS 输入与坐标

输入 dataset 根目录与 `color/1`、`segmentation/4` 等数组路径；直接使用层名
时选择该层最精细的可用倍率。读取器按 boundingBox 去掉全局填充区域，保留
物理原点，将尺度转换为 nm，遵循 `dimension_names` / `axisOrder` 并去掉单通道轴。
非空间数组及 attachments 不作为图像体数据。

逻辑索引零对应裁剪 ROI 的起点，`offset` 记录该点的全局纳米坐标。粗倍率
包围盒向外对齐体素网格。普通数组保留声明的轴与 `resolution/offset`。
模型的尺度、轴及监督数据对齐检查仍然生效；格式适配不会自动将数据重采样到
checkpoint 所需尺度。

裁剪范围为逻辑 ROI 内的 XYZ 体素范围，可显式传入体素 `offset` 改变范围原点。
裁剪/旋转将声明的轴归一化为 (C)XYZ，重采样使用 XYZ。已注册 WEBKNOSSOS
数组旋转/重采样必须使用不同输出名称，避免改变数组形状后根级元数据失效。
读取源数据不会为了坐标归一化而改写源文件。

LSD 训练保留原有默认路径；自定义或 WK 布局可显式映射，仍需真实监督 mask：

```json
{
  "samples": ["/path/to/dataset"],
  "datasets": {"raw": "color/1", "labels": "segmentation/1", "mask": "mask/1"},
  "zarr_format": 3
}
```

突触 CSV 保持全局 XYZ nm。突触查看器与 precomputed 导出的 `voxel_size`
是元数据缺失时的回退值，不覆盖 WEBKNOSSOS scale。原生 Synful 训练/标注仍使用 ZYX nm。

## 边界与验证

v3 写入支持定长数值/布尔数组，以及现有 Blosc、zstd、gzip 压缩选项。
变长字符串、object、结构化 dtype 与任意 Zarr2 filters 会明确报错，不静默改写。
这些类型原有的 v2 支持不受影响。本次不新增远程对象存储 URL；旋转和原生 WKW
导出保留原有整卷内存需求；precomputed 导出仍为单通道。

安装科学计算、转换与旧版 Funke 依赖后运行 `python -m pytest tests -q`。
模型测试通过 `dual_zarr` 在两种格式执行，检查实际像素/标签、物理坐标、续跑
校验与输出隔离。`CONNECTIO_RUN_FUNKE_SMOKE=1` 额外执行两种格式的真实
MongoDB/Daisy/Funke 后处理。`pytest.ini` 排除本地生产工作区脚本。
命令与范围见仓库 `tests/README.md` 及[验证记录]({{ "/validation/zarr3-26.10.28.json" | relative_url }})。
CPU 回归不代表整卷 GPU 性能测试，也不代表完整重新训练的结果等价性。

旧 Conda 环境若出现 MKL/OpenMP 冲突，可设置 `MKL_THREADING_LAYER=GNU` 后运行使用 spawn 的数据加载工作进程。旧 zlib 压缩请求在 Zarr3 中映射为同等级的 gzip 编码。
