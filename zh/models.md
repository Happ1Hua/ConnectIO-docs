---
layout: default
title: 模型配置与预检
lang: zh
permalink: /zh/models/
---

# 模型配置与无需 GT 的推理预检

ConnectIO 26.10.13 支持从本地 checkpoint 自动生成推理配置，并在推理前检查网络参数、输入尺寸和坐标，无需 ground truth（GT）。更新安装后可使用 `connectio-models`；也可用 `python -m connectio.models` 替代该命令。

在源码目录更新安装（PyTorch 构建需与计算环境相容）：

```bash
python -m pip install -e '.[lsd-pytorch,synful-pytorch]'
```

模型仓库目前为 **private，尚未公开**：[ConnectIO-LSD](https://huggingface.co/happyhua1/ConnectIO-LSD)、[ConnectIO-Synful](https://huggingface.co/happyhua1/ConnectIO-Synful)。只有获得访问授权的账号可以下载。本地配置和预检不访问网络，不改变仓库可见性；已有本地权重可直接使用。后续公开时再更新访问说明。

## 每套模型的推理配置

| `--bundle` | 本地目录及配套权重 | 计数 |
| --- | --- | --- |
| `spider` | `spider/lsd_450000.pt` + `spider/acrlsd_230000.pt` | 450,000 / 230,000 |
| `digspider` | `digspider/lsd_20000.pt` + `digspider/acrlsd_5000.pt` | 20,000 / 5,000 |
| `multidataset` | `multidataset/lsd_400000.pt` + `multidataset/acrlsd_200000.pt` | 400,000 / 200,000 |
| `synful-e1sp5d3` | `e1sp5d3/paired_600000.pt` | 600,000 |

计数是 iteration/step，不是 epoch，也不代表验证集最优。联合模型由 E1Sp2D1_SOG、E1Sp3D1、E1Sp5D3、E5Sp7D1、E8W1CB、E8W6_SOG 共同训练，保存一套共享模型。Synful 的 E1Sp5D3 表示本项目的使用数据集，不能据此确认原预训练数据来源。

### LSD / ACRLSD

`--checkpoint-dir` 指向包含 `spider/`、`digspider/`、`multidataset/` 的本地目录。已整理的本地权重也可使用 `checkpoints/upload/lsd`。下面仅需填写真实的 raw 路径和新的输出目录；其他两套 LSD 模型替换 `--bundle`、运行目录和输出目录即可。

```bash
connectio-models configure --bundle spider \
  --checkpoint-dir checkpoints/lsd --raw /path/to/raw.zarr \
  --output results/spider --config-dir runs/spider
connectio-models inspect runs/spider/lsd.json
connectio-models inspect runs/spider/acrlsd.json --allow-pending-lsd
connectio-segmentation-stage affinity runs/spider/affinity.json
```

生成器创建 `lsd.json`、`acrlsd.json` 和 `affinity.json`，填入绝对路径、网络参数、迭代数与 LSD 上下游关系，并拒绝覆盖已有配置。`affinity` 阶段通过 Slurm 在一个 GPU allocation 中先运行 LSD，再运行 ACRLSD。raw 必须是带 `resolution`、`offset` 元数据的 8 nm XYZ 三维 Zarr；输出与 raw 分开。

ACRLSD 的预检默认要求 LSD 输出已经存在。首次运行前可显式使用 `--allow-pending-lsd` 检查计划依赖；报告会标为 `pending`，不表示上游像素或输出几何已经检查通过。LSD 完成后，不带此选项再次检查即可验证输出形状、坐标和 checkpoint 签名。

也提供可编辑模板：`connectio/segmentation/configs/inference/{spider,digspider,multidataset}.{lsd,acrlsd}.json`。模板中的 `/path/to/...` 是需要替换的路径；模型参数可省略，由 checkpoint 自动读取。

### Synful

`--checkpoint-dir` 指向包含 `e1sp5d3/` 的目录，已整理权重也可使用 `checkpoints/upload/synful`。raw 使用 ZYX 顺序、纳米坐标。

```bash
connectio-models configure --bundle synful-e1sp5d3 \
  --checkpoint-dir checkpoints/synful --raw /path/to/raw.zarr \
  --output results/synful --config-dir runs/synful
connectio-synful inspect --config runs/synful/synful.json --inference-only
# Run predict inside an allocated GPU session.
connectio-synful predict --config runs/synful/synful.json --device cuda
```

生成的 `synful.json` 不含 `gt_file`、标签或 `splits`。checkpoint 路径已写入配置，不必再手动传 `--checkpoint`。输入 tile 为 `[110,268,268]`，这套配对模型结构下输出为 `[34,56,56]`；原训练示例的 `[66,646,646]` 不能用于这套模型。Synful 推理命令在当前会话执行，应先申请计算资源。`run` 可以在预测完成后继续提取和导出；NML 导出前需填写 `export.dataset`。

可编辑的纯推理模板为 `connectio/synapse_detection/configs/synful.e1sp5d3.inference.json`。同样可运行 `connectio-models inspect runs/synful/synful.json`；已有训练检查仍可使用带 GT 的 `connectio-synful inspect`。

## 自动参数读取与冲突校验

推理从 checkpoint 读取模型参数。配置中省略 `model_kwargs`（LSD）或 `model`（Synful）时自动填入；显式提供但与 checkpoint 不一致时，在推理输出写入前报错。LSD 同时校验模型阶段、迭代数、bundle 和声明的体素大小。Spider/DigSpider 的 `activate_upsampling=true` 与联合模型的默认设置不会再被静默混用。旧 checkpoint 缺少结构信息时仍须提供正确配置。

Synful 保留 indicator/vector 两个独立网络，并从训练 checkpoint 保留向量 `d_scale`；本项目已导出的纳米向量配对权重使用 1。纯推理不再依赖 checkpoint 中的训练配置。若覆盖缩放值与已记录值冲突，会被拒绝。

## 预检检查什么

预检只读 checkpoint 和 raw，不提交 Slurm、不执行网络前向、不写预测文件。检查包括权重键与形状、模型 tile 几何、三维 raw、轴顺序、坐标单位与 ROI 网格；读取首块至多 `32×32×32` 的样本检查 dtype 和归一化条件，并报告 checkpoint SHA-256。`--device cuda` 可检查当前会话能否识别 CUDA。

这不是全量像素检查，也不测量 GPU 峰值显存、实际推理吞吐或生物学精度；报告中的 `output_resume_checked=false` 表示未核对已有输出是否可恢复。首次正式运行应使用新的输出目录，并先检查代表性小 ROI。新版本将有效模型参数和向量缩放纳入推理身份，旧输出签名可能不匹配，不应删除恢复记录来强制续写。

## 私有仓库下载与校验（需要授权）

已有本地权重可跳过此步骤。获得仓库访问权限后，使用 [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli) 登录。没有访问授权的账号即使登录也不能下载；401/404 不表示 token 一定无效。

```bash
export HF_ENDPOINT=https://huggingface.co
hf auth login
hf download happyhua1/ConnectIO-LSD --revision 198285c3fa854981ffda10d314cafc347eb0a295 --local-dir checkpoints/lsd
hf download happyhua1/ConnectIO-Synful --revision 14f3f7eff804d1d63c53e988e5f08e585cc199b1 --local-dir checkpoints/synful
(cd checkpoints/lsd && sha256sum -c SHA256SUMS)
(cd checkpoints/synful && sha256sum -c SHA256SUMS)
```

示例固定到此前核对过的模型 revision；授权用户更新权重时应保存新 revision 与 manifest。7 个文件合计约 2.39 GB。`upload_sha256`、`upload_bytes` 对应下载文件，`source_sha256` 是导出前文件的身份，不能用来校验导出文件。Hub 权重与历史本地 Spider manifest 的文件名、哈希不同。

导出权重用于推理或新目录下的 `--init-checkpoint` 初始化，不含精确训练 `--resume` 所需的优化器、RNG 和采样进度。权重来源及科学使用限制见模型卡；当前源码可访问不意味着私有权重已经公开。
