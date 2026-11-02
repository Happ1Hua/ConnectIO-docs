---
layout: default
title: Mito PyTorch 线粒体实例分割
lang: zh
permalink: /zh/mito/
---

# Mito PyTorch

本模块 CLI 使用统一的执行策略：`--backend local` 在工作站运行，`--backend slurm` 提交作业，也可设置 `export CONNECTIO_EXECUTION_BACKEND=local` 让下文命令默认本地运行。不设置时默认 Slurm；帮助不提交。详见[本地与 Slurm 执行]({{ "/zh/slurm/" | relative_url }})。

ConnectIO 26.10.22 将 MitoEM 前景/轮廓（BC）模型重构为独立 PyTorch 实现：residual-SE U-Net+、non-local bottleneck、五层通道 `[32,64,96,128,160]`，输出前景和轮廓两个 logits。训练和推理不再导入 PyTorch Connectomics、MONAI、torchvision、yacs，也不依赖原项目路径。保留来源说明和 MIT 许可证；3D AP 使用独立封装的原始 MitoEM 评价器，局部修复 NumPy 兼容问题。

## 安装与资源

```bash
python -m pip install -r requirements-mito.txt
python -m pip install -e . --no-deps
connectio-mito --help
# 等价入口：python -m connectio.mito_segmentation.mito_pytorch
```

按 GPU 选择合适的 CUDA PyTorch。与 Synful 一样，这些原生命令在当前会话执行，计算前先申请资源。例如生成下文配置后：

```bash
sbatch --partition=GPUA800 --gres=gpu:1 --cpus-per-task=4 --mem=64G \
  --wrap='OMP_NUM_THREADS=4 python -m connectio.mito_segmentation.mito_pytorch predict --config runs/mito/mito.json --device cuda'
```

作业继承已激活环境及提交目录。全局分水岭另用足够内存的 CPU 作业运行；`--memory-gib` 只是程序的内存保护阈值，不会自动向 Slurm 申请内存。

## 已迁移的双 GT 联合权重

迁移的是 **digspider + E1Sp5D3 联合微调第 2000 步** checkpoint。训练共 5000 步，选模按两个验证集各占 50% 的平均 AP75；并列时依次比较平均 AP50、平均 AP，再选较早步数。两个 400³、8 nm 标注体分别转换为 107×400×400、30×8×8 nm 模型网格；各自使用 Z `[0,70)` 训练、`[86,107)` 验证，中间隔离带为 480 nm。两体积的实例 ID 空间相互独立，不拼接为同一个标签体。

| 验证集 | AP | AP50 | AP75 |
| --- | ---: | ---: | ---: |
| digspider | 0.349222 | 0.445545 | 0.445545 |
| E1Sp5D3 | 0.534018 | 0.745403 | 0.571465 |
| 等权平均 | 0.441620 | 0.595474 | 0.508505 |

这些是原选模流程的记录，不是对集成后整套流程重新测出的基准。验证属于同一标注块内的空间留出，digspider 留出区此前已用于选模；完整 E1Sp5D3 推理包含训练区域，不能视为独立测试。

- 原权重：`checkpoints/retained/mito/joint/selected_checkpoint.pth.tar`，约 28 MB。
- 转换权重：`connectio/mito_segmentation/models/joint/spider_fibsem_mito_v1.pt`，14,693,296 字节。
- 原始 SHA256：`34420077f8b2ce133ef3b477c7f77bf32c2b5071e4c74e321aa99912baf1b7d3`。
- 转换 SHA256：`b153d123e82fbe26346724c1a8cf82046445163c19ea0f5ae39676e042d8ef79`。
- 版本管理内的来源与验证记录：`connectio/mito_segmentation/models/joint/manifest.json`、`parity.json`。

转换文件保留全部网络参数、BatchNorm 缓冲区、结构配置、体素尺寸、步数和来源信息，使用 `weights_only=True` 受限加载。原优化器状态保留在原始文件中，不迁入新训练器；转换权重用于推理或 `--init-checkpoint`，不用于精确恢复旧框架训练。转换后的 14.7 MB `spider_fibsem_mito_v1.pt` 直接随 GitHub 源码和 Python wheel 分发，路径为 `connectio/mito_segmentation/models/joint/`；原训练归档保留在本地。

## 配置与推理

```bash
connectio-models configure --bundle mito-joint \
  --checkpoint-dir connectio/mito_segmentation/models --raw /path/to/raw.zarr \
  --output mito-results --config-dir runs/mito
connectio-models inspect runs/mito/mito.json
connectio-mito inspect --config runs/mito/mito.json
```

配置生成器写出绝对路径的 `mito.json`，拒绝覆盖现有配置。手工 JSON 中的相对路径以配置文件目录解析。模板为 `connectio/mito_segmentation/configs/inference/joint.json`。`family` 为 `mito`，`model_bundle` 为 `mito-joint`；不填写 `model` 时从 checkpoint 自动读取参数，显式冲突会报错。预检严格加载全部权重、检查输入几何，不执行前向计算、不写预测结果。

从 **26.10.23** 起，输入支持 **uint8、XYZ 或 ZYX 顺序的三维 Zarr**，默认数组 `volumes/raw`。`resolution`、`offset` 以 nm 为单位，顺序必须与数组存储轴一致。默认 `"axes": "auto"` 读取 `axis_order`、`axes` 或 `_ARRAY_DIMENSIONS`；多个声明必须一致，支持轴名称列表和轴字典列表。没有轴声明时，必须显式设置 `"axes": "xyz"` 或 `"axes": "zyx"`，不再猜测。显式配置与已有元数据冲突时会报错。数据级 `data.axes` 优先于顶层默认值。

XYZ 输入通过只读 ZYX 视图访问：只转置当前读取的数据块，物理 resolution/offset 随轴同步重排，不需要整卷转置或额外复制一份转置原图。准备阶段仍按原流程保存重采样后的模型网格数据。XY 必须为 8 nm；Z 分辨率按物理 Z 轴读取，高斯抗混叠和中心对齐采样始终沿物理 Z 进行。原始输入不修改，输出目录与输入路径分离。

已有 XYZ 数据若缺少轴元数据，可在 `mito.json` 中设置以下字段（保留其他生成的配置）：

```json
{"axes": "xyz", "data": {"raw_file": "/path/to/raw.xyz.zarr", "raw_dataset": "volumes/raw"}}
```

tile、stride、padding、block 大小及 `voxel_size_zyx_nm` 始终采用 **ZYX 模型网格顺序**。例如输入 XYZ 的 resolution `[8,8,12]`、offset `[40,24,120]` 会转为内部 ZYX 的 `[12,8,8]`、`[120,24,40]`；最终 `native.zarr` 恢复 XYZ 的形状、resolution 和 offset。中间 prepared/prediction/instances 仍用 ZYX，概率数组为 CZYX。预检同时报告原存储几何、内部几何及 `output_axes`。

轴解释现已纳入数据身份校验。对于 26.10.22 已准备的结果，请使用新的输出目录；旧版准备记录会被拒绝复用，避免静默沿用错误方向。

```bash
connectio-mito prepare --config runs/mito/mito.json
# 在 GPU allocation 内：
connectio-mito predict --config runs/mito/mito.json --device cuda
# 在内存足够的 CPU allocation 内：
connectio-mito segment --config runs/mito/mito.json --memory-gib 192
connectio-mito restore --config runs/mito/mito.json
```

`run` 可以在同一 allocation 顺序执行 prepare/predict/segment/restore；分阶段命令便于分别申请 GPU 和大内存 CPU。`--checkpoint` 可覆盖配置路径。`predict --max-blocks N` 用于有限分块试跑，再去掉此选项继续。推理记录输入几何、checkpoint SHA256 和推理参数，拒绝不匹配的续推；完成的块会跳过。CLI 对同一输出目录加写锁。源像素在运行期间应保持不变：身份记录包含元数据，未计算全体积像素哈希。准备或后处理被中断时会保留 `.partial.zarr`，需检查后再重试；已完成的实例/原网格输出不会覆盖。

| 配置 | 默认值与含义 |
| --- | --- |
| `inference.input_shape` | `[17,257,257]`，ZYX，网络同尺寸输出 |
| `inference.stride` | `[8,128,128]`，不允许大于 tile 留空洞 |
| `inference.block_shape` | `[64,512,512]`，控制拼接内存 |
| `inference.padding` | `[4,64,64]`，体积边界反射填充 |
| `inference.batch_size` | `1` |
| `inference.tta` | `4` 表示 XY 翻转，`1` 表示不增强 |
| 标准化 | `(uint8 / 255 - 0.5) / 0.5` |
| 拼接 | sigma=0.2、floor=1e-4 的高斯加权，量化为 uint8 概率 |
| 分水岭 | `thres1=.85`、`thres2=.6`、`thres3=.8`、`thres_small=1024`、`seed_thres=32` |

`output_dir` 中的结果：

- `prepared.zarr/volumes/raw`：30×8×8 nm 原图。
- `prediction.zarr/volumes/probabilities`：uint8 `[2,Z,Y,X]`，前景、轮廓，概率比例因子 255。
- `instances.zarr/volumes/mitochondria`：模型网格上的全局唯一 uint32 实例。
- `native.zarr/volumes/mitochondria`：最近邻恢复到输入的 **XYZ/ZYX 轴顺序**、形状、offset 和 resolution，同时一致写出三种轴元数据，不增加 Z 方向细节。

分水岭在完整模型网格上运行，不能以各块独立分水岭代替全局实例。内存保护按每体素 64 字节估算，还应给库和工作数组留余量。分块布局和上下文会影响边界预测，因此不声称新流程与历史完整体积输出逐位相同；模型、TTA、训练目标及分水岭等价验证与小体积端到端测试分别记录。

## 双 GT 训练

将 `connectio/mito_segmentation/configs/training/joint.json` 复制成自己的配置，填写两组配对 raw/GT 路径及全新输出目录。GT 必须为整数实例 ID，在轴归一化后物理几何与原图一致；raw 和 GT 可使用不同的存储轴顺序。每个训练数据集可设置 `axes` 和 `labels_axes`（默认继承数据集 `axes`）；独立声明的混合轴输入使用 `auto`。`train_z`、`val_z` 使用**重采样后的模型网格**坐标。准备阶段将两个体积分别保存，GT 最近邻采样且保留 ID。

```bash
connectio-mito prepare-training --config my-training.json
connectio-mito train --config my-training.json --device cuda \
  --init-checkpoint connectio/mito_segmentation/models/joint/spider_fibsem_mito_v1.pt
connectio-mito train --config my-training.json --device cuda \
  --resume /path/to/new-mito-training/train/mito_1000.pt
```

新训练器等概率选择两个体积，并在选中体积内做前景拒绝采样；反射填充不会跨越训练区间。BC 目标、类别平衡权重以及逐通道 weighted BCE + 0.5 Dice 与原实现一致。新训练流程使用空间翻转增强及原生 warmup/cosine SGD，不声称复现原框架的完整训练轨迹。验证区间不参加训练，选模需显式评价，不会在推理时隐式读取 GT。`--steps` 可限制额外训练步数。原生保存点保留优化器、RNG、配置和数据身份以便续训；CPU 精确续训已纳入回归测试，不保证跨 GPU 硬件/软件的逐位确定性。

验证时先将独立留出区保存为带正确物理 offset 的 Zarr crop，对该 crop 配置推理，再在同一网格上评价：

```bash
connectio-mito evaluate --config runs/mito/mito.json \
  --gt-file /path/to/holdout.zarr --gt-dataset volumes/mito_segmentation \
  --prediction-file /path/to/holdout-output/native.zarr --memory-gib 16
```

评价时分别将 XYZ/ZYX 的 GT 与预测归一化，再检查形状、坐标；缺少元数据时可传 `--gt-axes xyz`、`--prediction-axes xyz`（也可为 `zyx`）。使用原 MitoEM 按实例体积排序的 3D AP；不静默裁剪不匹配的 GT。

## 转换与验证

26.10.23 轴适配验证：36 项相关测试通过。使用内置权重，同一真实 EM 裁块的 XYZ/ZYX 存储得到逐元素一致的概率，原网格标签转为同一轴顺序后完全一致。测试还覆盖各向异性分辨率、非零 offset、缺失或冲突的声明、混合轴 raw/GT，以及超过 65535 的 uint32 实例 ID。记录见 mito 模块的 `models/joint/axes_validation.json`。


已用真实联合权重验证：CPU 下 `[9,33,35]` 与 `[17,257,257]` 输入的 logits 与原实现逐元素一致，四翻转 TTA、BC 目标、类别权重和分水岭也一致。27 项相关回归测试全部通过，构建后的 wheel 已在真实 EM 小裁块上跑通 CPU 完整流程；尚未验证 GPU 或完整体积结果等价。


```bash
connectio-mito convert \
  --source-checkpoint /path/to/selected_checkpoint.pth.tar \
  --output-checkpoint /path/to/new/spider_fibsem_mito_v1.pt --bundle mito-joint \
  --expected-sha256 34420077f8b2ce133ef3b477c7f77bf32c2b5071e4c74e321aa99912baf1b7d3
```

转换保持 state-dict tensor 名称和值，严格拒绝缺失/错形状参数、非有限值、错误源哈希及覆盖。`mito-joint` 专指已验证的双 GT 选中权重。`tools/verify_mito_conversion.py` 可在原环境内与旧 checkout 对照；原工程仅是这个可选验证工具的参考，不是新模块运行依赖。

## 可选 Hugging Face 镜像上传

权重主要随 GitHub 仓库分发，同时保留可选的本地 Hugging Face 镜像包，**未执行 Hub 上传**。建议目标为 `happyhua1/ConnectIO-Mito`，沿用现有模型命名。未假设该远程仓库已存在或具有何种可见性；以下命令会在仓库不存在时创建私有仓库，不会改变已有仓库可见性。

```bash
hf auth login
(cd checkpoints/upload/mito && sha256sum -c SHA256SUMS)
hf upload happyhua1/ConnectIO-Mito checkpoints/upload/mito . \
  --repo-type model --private --commit-message "ConnectIO 26.10.22: native PyTorch mito joint-GT checkpoint"
```

上传包包含模型卡、转换权重、选模记录、推理/训练配置、manifest 和校验清单。上传完成后记录 Hub 返回的 revision，下载时固定该 revision；发布前不能给出真实 revision。


## Zarr2 / Zarr3（26.10.28）

体数据读写支持两种格式，新输出默认仍为 Zarr2。使用 `zarr_format=3`、`--zarr-format 3`，或模型配置顶层 `"zarr_format": 3` 创建新 Zarr3 存储。功能范围、坐标和验证见 [双格式兼容说明]({{ "/zh/zarr/" | relative_url }}）。
