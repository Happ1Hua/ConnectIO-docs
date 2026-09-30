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

Synful 突触配对检测使用独立的 `synful-pytorch` extra 和 `connectio-synful` 命令。所需分支、输入格式、配置、命令与坐标检查见[详细的 Synful PyTorch 指南]({{ "/zh/synful/" | relative_url }})。Synful 计算命令在当前进程运行；正式训练或全体积推理前请先申请计算资源。

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

## 首次运行前

请使用 [ConnectIO 主分支](https://github.com/Happ1Hua/ConnectIO/tree/main)，并检查当前环境能导入 ConnectIO，且命令行参数符合预期：

```bash
python -m pip show connectio
connectio-segmentation-stage --help
connectio-align --help
connectio-tiff-check --help
```

这些命令来自同一份源码，但依赖不同。转换和对齐使用预处理依赖；LSD 推理需要 PyTorch 和模型 checkpoint；Funke 后处理还需要旧版包及可用的 `mongod`。独立的训练和检测方式见 [Synful 指南]({{ "/zh/synful/" | relative_url }})。

新建 LSD 运行目录时，将 `connectio/segmentation/configs/stages/` 中的 JSON 示例复制到自己的 `configs/`，逐项修改真实输入输出路径、数据集键、checkpoint、体素元数据和 Slurm 资源。`/shared/data/...` 是占位路径。stage JSON 中的相对路径以该 JSON 所在目录解析。`--dry-run` 检查阶段名称与配置文件路径并打印提交计划，**不会**验证所有数据集或模型权重；计算作业启动后才会进行相关检查。

## 第一个可审查阶段

例如，raw 和 checkpoint 就绪后只提交 affinity：

```bash
connectio-segmentation-stage affinity configs/02_affinity.json --dry-run
connectio-segmentation-stage affinity configs/02_affinity.json \
  --slurm-options '{"time":"12:00:00","gpus":1}'
```

第二条命令提交后立即返回，输出作业号和日志目录。阶段状态保存在 `<run_dir>/affinity/status.json`；`<run_dir>` 取自 `_connectio.run_dir`，未设置时在配置文件旁生成默认目录。等待 `COMPLETED`，用查看器检查 Zarr 输出并记录审查结论，再提交下一阶段。完整顺序见[分阶段流程]({{ "/zh/pipeline/" | relative_url }})，资源和日志说明见 [Slurm 指南]({{ "/zh/slurm/" | relative_url }})。

## 选择起点与处理失败

已有合适 raw Zarr 时不必重做转换与对齐；有 raw 和匹配 checkpoint 可从 affinity 开始；再往后则需要对应的 affinity、fragments、LUT 和持久化图数据库。新建 `run_dir` 只会保存新的状态文件，不会生成缺失的科学输入。作业仍运行时，不要让两个独立实验写入同一输出 dataset 或 MongoDB 数据库目录。

某阶段失败后先检查 `status.json` 和 Slurm `stderr.log`，再修改配置。重新运行前确认部分输出是否可续跑；科学设置变更时使用新输出路径。流程不会自动提交下一阶段。
