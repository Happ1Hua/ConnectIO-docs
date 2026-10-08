---
layout: default
title: 模型下载
lang: zh
permalink: /zh/models/
---

# 模型下载与 checkpoint 配置

训练权重独立于 ConnectIO 源码包发布：

- [ConnectIO-LSD](https://huggingface.co/happyhua1/ConnectIO-LSD)：配套的 LSD/ACRLSD 分割模型。
- [ConnectIO-Synful](https://huggingface.co/happyhua1/ConnectIO-Synful)：完整的 Synful indicator/partner-vector 配对模型。

## 可用模型

每个数据集或联合训练集合保留一套最终权重。LSD 每套需要两个阶段；Synful 将两个独立网络保存在一个文件中。下表计数为 **iteration/step，不是 epoch**。按最大迭代保留不代表验证集表现最优。

| 数据集／训练集合 | LSD 仓库文件 | 迭代／步数 |
| --- | --- | --- |
| DigSpider | `digspider/lsd_20000.pt` + `digspider/acrlsd_5000.pt` | 20,000 / 5,000 |
| 联合多数据集 | `multidataset/lsd_400000.pt` + `multidataset/acrlsd_200000.pt` | 400,000 / 200,000 |
| Spider 基线 | `spider/lsd_450000.pt` + `spider/acrlsd_230000.pt` | 450,000 / 230,000 |
| 配置用于 E1Sp5D3 的 Synful | Synful 仓库：`e1sp5d3/paired_600000.pt` | 600,000 |

联合模型由 E1Sp2D1_SOG、E1Sp3D1、E1Sp5D3、E5Sp7D1、E8W1CB、E8W6_SOG 共同训练，只保存一套共享模型。Synful 目录名称表示本项目配置的使用数据集，不能据此确认原预训练权重的完整训练数据来源，也不能视为独立测试集。

## 下载与校验

安装 [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli) 后，在项目目录执行。两个公开仓库无需登录即可下载。认证和上传应使用官方端点；已有 `HF_ENDPOINT` 若指向镜像，可能干扰 token 校验。

```bash
export HF_ENDPOINT=https://huggingface.co
hf download happyhua1/ConnectIO-LSD --revision 198285c3fa854981ffda10d314cafc347eb0a295 --local-dir checkpoints/lsd
hf download happyhua1/ConnectIO-Synful --revision 14f3f7eff804d1d63c53e988e5f08e585cc199b1 --local-dir checkpoints/synful
```

命令固定到 **2026-10-08 已核对的仓库版本**。需要更新版本时，先查看模型卡和 manifest，再选择并记录新的 revision。7 个 checkpoint 合计约 **2.39 GB**。仓库同时提供每份权重对应的 `.config.json`、模型卡、`manifest.json` 和 `SHA256SUMS`。在各仓库下载目录内校验：

```bash
(cd checkpoints/lsd && sha256sum -c SHA256SUMS)
(cd checkpoints/synful && sha256sum -c SHA256SUMS)
```

manifest 中的 `upload_sha256`、`upload_bytes` 对应实际下载文件；`source_sha256` 是转换或导出前源 checkpoint 的身份，不能用来校验导出文件。实验记录应保存 revision 和 manifest。

## 配置已下载模型

### LSD 与 ACRLSD

将两份推理 JSON 的 `checkpoint` 分别设置为下载文件的绝对路径，或相对于该 JSON 的正确路径，同时设置相应的 `checkpoint_iteration`。下载不会自动改写默认配置：原配置的长 Spider 文件名与 Hub 上的 `spider/lsd_450000.pt`、`spider/acrlsd_230000.pt` 不同。

把各自 `.config.json` 中的 `model_kwargs` 复制到推理配置。**Spider、DigSpider 使用 `activate_upsampling=true`，联合多数据集模型使用 `{}`；不能将 Spider 的设置沿用到联合模型。** LSD 模型面向 8 nm 各向同性 FIB-SEM，当前推理空间轴采用 XYZ。

先运行 LSD，再把 ACRLSD 的 `lsd_file`、`lsd_dataset` 指向本次 LSD 输出。使用同一行的配套权重：ACRLSD 5,000 配 LSD 20,000，ACRLSD 200,000 配 LSD 400,000，ACRLSD 230,000 配 LSD 450,000。按[分割说明]({{ "/zh/segmentation/" | relative_url }})和[LSD 操作指南]({{ "/zh/lsd-guide/" | relative_url }})填写 raw、ROI、输出路径与计算资源。

### Synful

把 `e1sp5d3/paired_600000.config.json` 的 `model` 对象复制到实际 Synful 配置。参数为 `fmap_num=4`、`fmap_inc_factor=5`、`num_heads=1`、`allow_floor_pooling=true`，下采样因子为 `[[1,3,3],[3,3,3],[3,3,3]]`；通用示例的网络结构可能不同。保留完整 paired checkpoint，不合并两个独立训练的 encoder，也不使用单任务 checkpoint 替代。

配置好 raw、几何、ROI 和新的输出目录后，在已分配资源的计算会话执行：

```bash
connectio-synful predict --config my-synful.json \
  --checkpoint checkpoints/synful/e1sp5d3/paired_600000.pt --device cuda
```

Synful 相对路径以命令执行目录解析，物理坐标采用 ZYX 纳米。完整流程见[Synful 指南]({{ "/zh/synful/" | relative_url }})。

## 训练与推理恢复

公开权重不含优化器、RNG 和采样位置恢复状态。可用于推理，或通过 **`--init-checkpoint`** 在新目录初始化训练，不能用于精确训练 `--resume`。导出时逐张量确认与源模型一致，但文件序列化哈希发生了变化；根据 ConnectIO 的签名校验，更换旧 checkpoint 后应使用**新的推理输出目录**。原本地 Spider manifest 描述的是其他序列化文件，下载权重以 Hub 的 manifest 为准。

全体积运行前，先在目标数据的代表性 ROI 上验证。已有小 ROI 功能测试和迭代次数不等于独立精度估计，也不能代替生物学审查。权重来源及使用限制见各仓库模型卡。
