---
layout: default
title: Slurm 执行
lang: zh
permalink: /zh/slurm/
---

# Slurm 执行

公开计算函数都接受仅限关键字的 `slurm=True` 与 `slurm_options=None`。普通调用默认异步提交；如果已经处于 allocation 内则直接执行，避免嵌套提交。

| 参数 | CPU 默认 | GPU 默认 |
|---|---|---|
| partition | `C64M512G` | `GPUA800` |
| CPU | 8 | 7 |
| 内存 | 60G | 随分区分配 |
| GPU | 无 | 1 |
| Conda | `data_format_convert` | `lsd_pytorch` |
| 时限 | 24 小时 | 24 小时 |

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    "/data/tiffs", "/data/raw.zarr",
    output_dataset_path="volumes/raw",
    slurm_options={
        "partition": "C64M512G",
        "cpus_per_task": 8,
        "mem": "60G",
        "time": "04:00:00",
        "job_name": "convert-sample",
    },
)
```

参数可用 Python 下划线或 Slurm 连字符。`account`、`qos`、`constraint`、`nodelist`、`exclude`、`reservation`、依赖与邮件参数会继续传递。`conda_env`、`conda_sh`、`python_executable`、`cwd`、`job_dir` 和 `env` 控制运行环境。使用 `mem_per_cpu`、`mem_per_gpu`、`gres`、`gpus_per_node`、`gpus_per_task` 或 `cpus_per_gpu` 时，会移除冲突的默认资源参数。

每个作业目录保存参数、生成的脚本、提交记录、状态、日志和序列化返回值。参数与返回值使用本地私有 pickle，只能加载可信代码生成的文件；大型数组应留在共享存储，仅传路径。

CLI 通过 `--slurm-options '{...}'` 修改资源。`--no-slurm` 只供已有 allocation 的计算节点调试。帮助和 dry-run 不提交。Neuroglancer 与已有站点专用脚本保持自身的提交逻辑。
