---
layout: default
title: 权重与推理配置
lang: zh
permalink: /zh/models/
---

# 让权重与输入体积匹配

使用已有模型推理，需要原图数组和与模型配套的权重。监督训练才需要真值标注。`mito-joint` 的权重随软件放在 `connectio/mito_segmentation/models/joint/`。LSD 和 Synful 可用已有的本地权重，或按下表选择对应版本。

| `--bundle` | 本地目录及配套权重 | 计数 |
| --- | --- | --- |
| `spider` | `spider/lsd_450000.pt` + `spider/acrlsd_230000.pt` | 450,000 / 230,000 |
| `digspider` | `digspider/lsd_20000.pt` + `digspider/acrlsd_5000.pt` | 20,000 / 5,000 |
| `multidataset` | `multidataset/lsd_400000.pt` + `multidataset/acrlsd_200000.pt` | 400,000 / 200,000 |
| `synful-e1sp5d3` | `e1sp5d3/paired_600000.pt` | 600,000 |

## 获取 LSD 或 Synful 权重

下载需要相应模型仓库的访问权限。选所需模型执行下载和校验命令。已经有本地文件时，可直接生成配置。

```bash
export HF_ENDPOINT=https://huggingface.co
hf auth login
hf download happyhua1/ConnectIO-LSD --revision 198285c3fa854981ffda10d314cafc347eb0a295 --local-dir checkpoints/lsd
hf download happyhua1/ConnectIO-Synful --revision 14f3f7eff804d1d63c53e988e5f08e585cc199b1 --local-dir checkpoints/synful
(cd checkpoints/lsd && sha256sum -c SHA256SUMS)
(cd checkpoints/synful && sha256sum -c SHA256SUMS)
```

清单里的 `upload_sha256` 对应下载文件，原始转换来源的哈希可能不同。导出的权重可做推理，也可用 `--init-checkpoint` 初始化新训练。用 `--resume` 接续原训练时，需要包含优化器和采样进度的训练保存点。

## 生成并检查推理配置

在已分配的 CPU 节点上运行下面的示例，或在工作站先设 `export CONNECTIO_EXECUTION_BACKEND=local`。沿用默认 Slurm 后端时，先等上一份作业完成，再运行依赖它的命令。结果和配置都选新目录。Spider 示例要求 XYZ 原图、8 nm 体素和物理原点。

```bash
connectio-models configure --bundle spider \
  --checkpoint-dir checkpoints/lsd --raw /path/to/raw.zarr \
  --output results/spider --config-dir runs/spider
connectio-models inspect runs/spider/lsd.json
connectio-models inspect runs/spider/acrlsd.json --allow-pending-lsd
```

在 `runs/spider/` 会生成两份模型配置和 `affinity.json`。LSD 尚未运行时，`--allow-pending-lsd` 可检查计划中的上下游关系。描述子生成后，去掉该选项再查一次 ACRLSD 的实际输入。后续步骤见[亲和图预测与片段合并]({{ "/zh/lsd-guide/" | relative_url }})。

Synful 配对权重使用 ZYX 原图，物理坐标以 nm 计：

```bash
connectio-models configure --bundle synful-e1sp5d3 \
  --checkpoint-dir checkpoints/synful --raw /path/to/raw.zarr \
  --output results/synful --config-dir runs/synful
connectio-synful inspect --config runs/synful/synful.json --inference-only
```

预检读取权重，核对网络结构和分块几何，并在原图开头最多取 32³ 个体素检查数值。记录报告中的权重 SHA-256。显存和预测效果需在有代表性的区域试跑。报告里的 `output_resume_checked=false` 表示本次预检未核对旧预测的恢复状态。

含结构信息的权重可自动提供 LSD 的 `model_kwargs` 或 Synful 的 `model`。旧权重需显式给出匹配参数。Synful 配对权重要使用相应的向量缩放值 `d_scale`。继续运行见[突触预测与导出]({{ "/zh/synful/" | relative_url }})或[内置 Mito 模型]({{ "/zh/mito/" | relative_url }})。
