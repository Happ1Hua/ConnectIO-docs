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

这些默认值集中在 `connectio/site_config.py`。可设置
`CONNECTIO_CPU_PARTITION`、`CONNECTIO_GPU_PARTITION` 和 `CONNECTIO_CONDA_SH`
以适配其他集群；`CONNECTIO_CONVERSION_ENV` 与 `CONNECTIO_SEGMENTATION_ENV`
分别指定转换和分割环境，原有的 `CONNECTIO_CPU_ENV`、`CONNECTIO_GPU_ENV`
仍作为后备变量。`CONNECTIO_MONGOD` 指定分割阶段的服务程序。
显式传入的 `slurm_options` 和阶段配置中的 `_connectio.mongod` 优先。
独立的站点专用 Slurm 脚本仍使用各自的默认值。

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

## 提交、执行和取回结果

被装饰的 Python 计算函数通常立即返回 `SlurmJob`：它序列化可导入函数及参数，提交一个 `sbatch` 作业，在计算节点执行。已有 Slurm allocation 内则直接调用，避免嵌套提交。命令行入口打印作业号和日志目录，不返回 Python job 对象。

```python
job = tiff_stack_to_zarr(
    "tiffs", "raw.zarr", dataset_name="volumes/raw",
    resolution=(8, 8, 8),
)
print(job.job_id, job.directory)
print(job.status())
result = job.result(timeout=3600)
```

`status()` 查询 worker 状态文件和 Slurm accounting；`result(timeout=...)` 等待并返回序列化的 Python 结果。作业失败会抛出异常；超时只停止等待，作业仍继续。`cancel()` 对该作业调用 `scancel`。函数没有返回值时，成功的 `result()` 为 `None`，产生的数据仍写在传入的输出路径。

作业目录默认为 `<cwd>/.connectio_slurm/<function>-<id>/`，保存 `payload.pkl`、`job.sh`、`submission.json`、`job.json`、`status.json`、`stdout.log`、`stderr.log`，成功时另有 `result.pkl`。提交失败会记录 `submission_error.json`；worker 失败在 `status.json` 保存错误和 traceback。pickle 文件只能由可信本地代码读取。决定重试前，先看日志和阶段自身的状态。

## 资源与环境选项

Python API 设置 `slurm_options`；命令行将 JSON 传给同一机制：

```bash
connectio-tiff-check --input tiffs --output qc \
  --slurm-options '{"partition":"C64M512G","time":"04:00:00","mem":"80G","job_dir":"jobs"}'
```

`partition`、`time`、`cpus_per_task`、`mem`、`gpus`、`job_name`、`dependency` 等受支持的 `sbatch` 参数会继续传递。`job_dir` 指定 ConnectIO 参数、日志和状态的保存目录；`cwd` 指定计算作业的工作目录；`conda_env`、`conda_sh` 控制环境激活，也可用 `python_executable` 指定解释器而不激活 Conda。`env` 是环境变量名到值的映射。这些特殊字段不会作为 `sbatch` flag 传入。

`mem_per_cpu` 等替代设置会移除默认 `mem`，除非你显式传入 `mem`；`gres`、`gpus_per_node`、`gpus_per_task` 会移除默认 `gpus`；`cpus_per_gpu` 可替代 `cpus_per_task`。资源值必须符合站点分区限制。计算节点需能导入对应函数并访问共享文件路径。

## 依赖与本地执行

Slurm 依赖可通过选项传入，例如将 `"dependency":"afterok:JOB_ID"` 中的 `JOB_ID` 换成真实作业号。依赖只保证机械前置条件；分割流程需要逐步审查，不能把依赖当成人工批准。

`--no-slurm` 或 Python `slurm=False` 在当前进程运行计算，应先取得相应 allocation。`--help` 留在本地；`connectio-segmentation-stage --dry-run` 只打印计划。Neuroglancer 使用独立交互式启动器，退出启动器时会取消它申请的 Slurm 作业；详见[模块与教程]({{ "/zh/modules/" | relative_url }})。
