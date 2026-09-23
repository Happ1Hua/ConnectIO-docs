---
layout: default
title: 安装与开始
lang: zh
permalink: /zh/getting-started/
---

# 安装与开始

## 环境

| 工作 | Conda 环境 | 默认分区 |
|---|---|---|
| 转换、预处理、对齐 | `data_format_convert` | `C64M512G` |
| 训练、推理、分割 | `lsd_pytorch` | GPU 工作使用 `GPUA800`；CPU 后处理使用 `C64M512G` |

在需要使用 ConnectIO 的环境安装源码：

```bash
conda activate data_format_convert
pip install -e .

conda activate lsd_pytorch
pip install -r requirements-segmentation.txt
pip install -e . --no-deps
```

也可使用 `pip install -e ".[segmentation]"`。Funke 后处理还需要旧版 `lsds 0.1`、`waterz 0.9.6`、`daisy 0.2`、`funlib.segment 0.1` 和 `funlib.persistence 0.1.0`。当前集群可用 `connectio/segmentation/scripts/activate_env.sh` 加载已验证的旧版依赖。

## 首次提交

从 `connectio/segmentation/configs/stages/` 复制 JSON，修改数据路径并先检查提交计划：

```bash
connectio-segmentation-stage affinity my_run/02_affinity.json --dry-run
connectio-segmentation-stage affinity my_run/02_affinity.json
```

命令打印作业号和日志目录，然后立即返回。提交下一阶段之前，检查 `status.json`、Slurm 日志、Zarr 数据和 Neuroglancer 结果。

## Python 接口

```python
from connectio.segmentation import submit_stage

job = submit_stage(
    "affinity",
    "my_run/02_affinity.json",
    slurm_options={"time": "48:00:00", "gpus": 1},
)
print(job.job_id, job.stdout, job.stderr)
```

程序可使用 `job.status()`、`job.result(timeout=...)` 和 `job.cancel()`。`slurm=False` 只允许在已有 Slurm allocation 的计算节点使用。
