---
layout: default
title: 本地与 Slurm 执行
lang: zh
permalink: /zh/slurm/
---

# 本地与 Slurm 执行

计算入口支持 `backend="local"` 或 `backend="slurm"`，原有 `slurm=False/True` 仍兼容。未指定参数时继承外层执行上下文或 `CONNECTIO_EXECUTION_BACKEND`；两者均未设置时保留 Slurm 默认行为。Slurm 模式在已有 allocation 内直接执行，避免重复提交；提交失败不会自动转为本地计算。

## 无集群的本地部署

在 Linux 工作站的 Python 环境安装对应依赖并设置一次：

```bash
pip install -e .
# 按所需模块选择 extra，例如：
pip install -e '.[segmentation,mito-pytorch,synful-pytorch]'
export CONNECTIO_EXECUTION_BACKEND=local

connectio-lsd-predict /data/inference.json --device cuda
connectio-mito predict --config /data/mito.json --device cuda
connectio-synful predict --config /data/synful.json --device cuda
```

这些调用无需 `sbatch`、Slurm allocation 或集群专用 Conda 路径。本地直接使用当前 Python 环境，阻塞至结束，异常正常向调用方传播。GPU 仍需可用的 CUDA/PyTorch；可用 `--device cpu` 选择 CPU。`slurm_options` 在本地不生效，也不会限制 CPU、内存或 GPU；通过模块的 worker、线程、batch 和内存参数控制资源。

单次命令可使用 `--backend local`（等价于 `--no-slurm`）或 `--backend slurm`（等价于 `--slurm`）覆盖环境设置。Python 同理：

```python
from connectio.processing import crop_zarr
crop_zarr('raw.zarr', 'crop.zarr', dataset_path='volumes/raw',
          crop_bbox_xyz=((0, 64), (0, 64), (0, 64)), backend='local')
```

本地返回计算结果，不返回 `SlurmJob`，无需调用 `.result()`。API 中 `slurm=None` 表示继承设置；同时指定互相矛盾的 `backend` 和 `slurm` 会报错。

## 工作流覆盖与内部 worker

转换、预处理、对齐、LSD 训练/推理/评估、Mito、Synful、模型配置/预检、统一分割 stage 和可视化启动器均支持执行选择。Mito 和 Synful 的 CLI 现在默认也使用统一策略；原来直接在当前进程运行的脚本可加 `--no-slurm` 或设置全局 local。

```bash
connectio-segmentation-stage over-segmentation configs/03.json --backend local
connectio-segmentation-stage agglomeration configs/04.json --backend local
connectio-segmentation-stage lut configs/05.json --backend local
connectio-segmentation-stage segmentation configs/06.json --backend local
```

每阶段完成并检查结果后再运行下一阶段。本地 stage 同样写入 `<run_dir>/<stage>/status.json`，记录 `backend`、可空的 `job_id` 和成功/失败状态。affinity stage 配置可设置 `"device":"cpu"`；默认仍为 `cuda`。

Funke 后处理需要 `requirements-segmentation.txt` 中注明的旧版 Daisy、lsds、waterz、funlib 依赖，以及 MongoDB 服务程序。安装 extra 不会自动安装这些旧版依赖或 MongoDB。设置 `CONNECTIO_MONGOD=/path/to/mongod`，或将 `mongod` 放入 PATH；阶段配置的 `_connectio.mongod` 优先。连续阶段复用相同 `db_name` 和 `_connectio.mongodb_dir`。

过分割和凝聚 worker 默认跟随 stage 后端。本地使用当前解释器启动子进程，继承 Daisy 上下文，`num_workers` 控制并发，`queue` 不参与本地启动。Slurm worker 使用通用提交接口；`queue` 设置其分区，`_connectio.worker_slurm_options` 可覆盖资源、解释器或 Conda 环境。需要在单个 allocation 内运行所有 worker 时，可设置 `_connectio.worker_backend="local"`；调度和 MongoDB 会使用本机地址。日志仍保存在 `.extract_fragments_blockwise/` 和 `.agglomerate_blockwise/`。

`connectio-view --backend local --viewer-type zarr --zarr-path /data/raw.zarr --datasets volumes/raw` 可直接启动查看器，不需要源码仓库中的 shell 启动器。Slurm 模式可用 `--login-host` 和 `--local-port` 打印 SSH 隧道说明。`launch_neuroglancer` 的交互模式跟随日志，退出时取消自己提交的作业；`wait=False` 返回可自行管理的 `SlurmJob`。底层 `view_*` 函数继续直接创建本地 viewer 对象。

对未装饰的 Python 函数，可统一使用 `connectio.execution.run_function(module, function, args=(), kwargs=None, backend=..., resource="cpu")`。命令行对应 `connectio-run module:function --args '[]' --kwargs '{}' --backend local`，也可用 `python -m connectio.execution`。仓库中明确以 `submit_*.sh` 或 `.slurm` 命名的旧站点脚本仍为 Slurm 专用；本地部署使用上述 Python/CLI 入口。

## Slurm 默认资源

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

CLI 通过 `--slurm-options '{...}'` 修改资源。帮助和 dry-run 不提交；`--no-slurm` 可在独立工作站或已有 allocation 内运行。

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

`--no-slurm` 或 Python `slurm=False` 在当前进程运行计算。在工作站无需 allocation；在集群上仍应遵守站点的计算节点使用规则。`--help` 留在本地；`connectio-segmentation-stage --dry-run` 打印所选后端与计划。示例详见[模块与教程]({{ "/zh/modules/" | relative_url }})。


## Zarr2 / Zarr3（26.10.28）

体数据读写支持两种格式，新输出默认仍为 Zarr2。使用 `zarr_format=3`、`--zarr-format 3`，或模型配置顶层 `"zarr_format": 3` 创建新 Zarr3 存储。功能范围、坐标和验证见 [双格式兼容说明]({{ "/zh/zarr/" | relative_url }}）。

从 26.11.02 起，分布式 Funke worker 需通过 `_connectio.mongodb_uri`、`CONNECTIO_MONGODB_URI` 或含认证信息的 `db_host` 配置外部认证 MongoDB；自动服务仅供本地 worker，监听 loopback。见[迁移说明]({{ "/zh/audit/" | relative_url }}）。
