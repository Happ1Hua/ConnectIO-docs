---
layout: default
title: 安装与首次转换
lang: zh
permalink: /zh/getting-started/
---

# 安装与首次转换

下面用 GUI 软件包自带的四张 PNG 试做一次转换。只需 CPU。习惯浏览器操作的读者可用同一组切片完成[图形工作台试跑]({{ "/zh/gui/" | relative_url }})。

## 安装

在 Linux 的 Python 环境中获取源码并安装。如果已有对应分支，从安装命令开始。含 GUI 和示例切片的版本见 [ConnectIO GUI 分支](https://github.com/Happ1Hua/ConnectIO/tree/codex/connectio-gui-v1)。

```bash
git clone --branch codex/connectio-gui-v1 https://github.com/Happ1Hua/ConnectIO.git
cd ConnectIO
python -m pip install -e .
connectio-gui --help
```

在集群上，计算节点需要能读到安装目录和输入，并能写入输出位置。下面的 Python 示例在工作站或已申请的 CPU 节点上运行。

## 读回刚转换的数组

```python
from pathlib import Path
from tempfile import mkdtemp

import connectio.gui
from connectio import zarr_io
from connectio.conversion import png_stack_to_zarr

slices = Path(connectio.gui.__file__).parent / "examples" / "png-stack"
output = Path(mkdtemp()) / "example.zarr"
png_stack_to_zarr(str(slices), str(output), zarr_format=3, backend="local")
raw = zarr_io.open_group(str(output), mode="r")["volumes/raw"]
print(output, raw.shape, raw.dtype, list(raw.attrs["axes"]))
```

预期输出包含 `(32, 32, 4)`、`uint8` 和 `['x', 'y', 'z']`。最后一维的四层分别对应四张 PNG。脚本每次都在新建的临时目录输出，并打印实际路径。换成自己的切片时，请改为长期保存的位置，并给出实测体素大小 `resolution` 和原点 `offset`。

## 按实验安装依赖

| 要做的工作 | 在运行作业的环境中安装 |
| --- | --- |
| 转换、TIFF 预处理、对齐 | 上述基础安装 |
| LSD / ACRLSD 神经元分割 | `python -m pip install -e '.[segmentation]'` |
| Mito 线粒体分割 | `python -m pip install -e '.[mito-pytorch]'` |
| Synful 突触检测 | `python -m pip install -e '.[synful-pytorch]'` |

GPU 推理需要与计算节点匹配的 PyTorch。神经元片段提取与图合并还需要 `requirements-segmentation.txt` 中列出的旧版 Daisy/Funke 组件和 MongoDB。环境名、作业资源和 worker 的设置见[本机与 Slurm 执行]({{ "/zh/slurm/" | relative_url }})。

后续仍在工作站计算时，可逐次传入 `backend="local"`，也可在 shell 中设置 `CONNECTIO_EXECUTION_BACKEND=local`。若沿用默认 Slurm 后端，从登录节点提交后会得到作业号，稍后可据此查看执行日志。
