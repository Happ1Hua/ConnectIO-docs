---
layout: default
title: 本机与 Slurm 执行
lang: zh
permalink: /zh/slurm/
---

# 在工作站运行或提交 Slurm

在工作站执行 `export CONNECTIO_EXECUTION_BACKEND=local`，计算函数就会在当前解释器同步运行并返回结果。集群默认使用 Slurm。从登录节点调用会提交 `sbatch` 作业，已在分配的计算资源中则直接运行。提交失败会显示调度器错误。

单次可在命令行指定 `--backend local` 或 `--backend slurm`，Python 对应 `backend="local"` 或 `backend="slurm"`。旧接口 `--no-slurm` 和 `slurm=False` 也选本机执行。浏览器工作台通过 Slurm 提交计算。

## 申请资源

下表是软件附带的命令行默认值，使用前请换成所在集群的分区和环境。

| 参数 | CPU 默认 | GPU 默认 |
|---|---|---|
| partition | `C64M512G` | `GPUA800` |
| CPU | 8 | 7 |
| 内存 | 60G | 随分区分配 |
| GPU | 无 | 1 |
| Conda | `data_format_convert` | `lsd_pytorch` |
| 时限 | 24 小时 | 24 小时 |

`CONNECTIO_CPU_PARTITION`、`CONNECTIO_GPU_PARTITION` 设置分区，`CONNECTIO_CONDA_SH` 指定环境激活脚本。转换和模型环境分别用 `CONNECTIO_CONVERSION_ENV`、`CONNECTIO_SEGMENTATION_ENV`，也支持后备变量 `CONNECTIO_CPU_ENV` 和 `CONNECTIO_GPU_ENV`。单次作业可在 Python 中传 `slurm_options`，或在命令行用 `--slurm-options` 传 JSON 对象。

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    "aligned", "raw.zarr", dataset_name="volumes/raw", resolution=(8, 8, 8),
    backend="slurm", slurm_options={"time": "04:00:00", "mem": "60G"},
)
print(job.job_id, job.directory)
```

`partition`、`account`、`qos`、`time`、`mem` 和 `gpus` 会传给调度器。`mem_per_cpu`、`gpus_per_node`、`cpus_per_gpu` 等替代申请会取代与其冲突的默认值。可用 `job_dir` 指定日志目录，`cwd` 指定工作目录，`conda_env` 或 `python_executable` 指定运行环境。计算节点要能访问这些路径。

## 找到结果与失败日志

`job.status()` 查状态，`job.result(timeout=3600)` 等待结果或抛出 worker 错误。等待超时后作业仍可继续。`job.cancel()` 通过 `scancel` 取消作业。没有 Python 返回值的转换函数会把数据写在调用时给出的路径。

进入打印出的作业目录，查看 `stderr.log`、`stdout.log` 和 `status.json`。提交环节失败看 `submission_error.json`。神经元分割阶段另有 `<run_dir>/<stage>/status.json`。传参和返回值会以 pickle 保存，只用于可信代码。大型数组留在共享存储中，按路径传入。

## 配置 Funke worker

片段提取和合并依赖 `requirements-segmentation.txt` 中列出的旧版组件。在同一份作业资源内处理时，设 `_connectio.worker_backend="local"`，用 `num_workers` 控制并发。自动启动本地 MongoDB 时可将 `mongod` 加入 PATH，或设 `CONNECTIO_MONGOD`。配置里的 `_connectio.mongod` 优先。

跨节点 worker 需要可达、启用认证的外部数据库，可用 `_connectio.mongodb_uri` 或 `CONNECTIO_MONGODB_URI` 指定。通过 `queue` 和 `_connectio.worker_slurm_options` 配置 worker 资源。前后阶段沿用 `db_name` 和持久化状态。worker 日志在 `.extract_fragments_blockwise/`、`.agglomerate_blockwise/` 中。

## 连接查看器

连接记录包含 `LOCAL_URL` 和 SSH 转发命令。部分安装版本只在查看器作业的标准输出里打印一条 `LOCAL_TUNNEL`。在自己电脑上执行这条命令，结束时按作业号检查查看器状态。提供交互式启动器的版本用法如下。

`connectio-view --backend local --viewer-type zarr --zarr-path /data/raw.zarr --datasets volumes/raw` 可直接启动查看器，不需要源码仓库中的 shell 启动器。Slurm 模式提交后直接在终端跟随日志、显示链接；可用 `--login-host` 和 `--local-port` 打印 SSH 隧道说明。Windows 复制 `LOCAL_TUNNEL`（`ssh -F NUL -N ...`），Linux/macOS 复制 `LOCAL_TUNNEL_POSIX`（`ssh -F /dev/null -N ...`），均忽略 SSH 配置中的额外转发。查看结束后，在本机 SSH 终端按 Ctrl+C 关闭隧道。`connectio-view` 和 `launch_neuroglancer` 的交互模式退出时取消自己提交的作业；`launch_neuroglancer(..., wait=False)` 返回可自行管理的 `SlurmJob`。底层 `view_*` 函数继续直接创建本地 viewer 对象。

HDF5、Precomputed 与突触叠加脚本见[教程脚本索引]({{ "/zh/modules/" | relative_url }})。
