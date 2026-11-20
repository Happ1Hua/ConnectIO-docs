---
layout: default
title: 图形工作台
lang: zh
permalink: /zh/gui/
---

# 在浏览器里提交第一份作业

工作台读取集群上的文件。准备一个自己有写权限、计算节点也能访问的工作目录。只试用界面时可检查计划、保存草稿；要执行作业，需要能在服务节点调用 Slurm。

## 连接工作台

在启动服务的节点上运行下面的命令，把 `/path/to/project` 换成自己的工作目录。若找不到 `connectio-gui`，先按[安装说明]({{ "/zh/getting-started/" | relative_url }})安装含 GUI 的版本，也可用 `python -m connectio.gui` 作为入口。

```bash
connectio-gui --workspace /path/to/project --port 8765
```

在自己的电脑上另开终端，将 `USER@GUI_HOST` 换成账号和**实际运行 GUI 的主机**。保持这个 SSH 窗口开启。

```bash
ssh -N -L 8765:127.0.0.1:8765 USER@GUI_HOST
```

在浏览器打开服务打印的完整 `Open:` 地址，保留末尾的 `#token=…`。持有该链接的人能以你的账户提交和取消作业，请自己保管。服务重启后用新链接。右上角可切换中文和 English，已填的表单会保留。

## 用四张切片试跑

1. 打开 **新建运行 → 载入 PNG 示例**。输入、输出和 CPU 资源会自动填好。每次载入都会生成独立的输出路径。
2. 点击 **检查提交计划**，核对分区、Conda 环境和账号，再点 **提交作业**。提交后在 **任务记录** 可以看到作业号。若本站分区名不同，在启动 GUI 前设置 `CONNECTIO_CPU_PARTITION`。
3. 状态变为 **已完成** 后，打开 **结果与查看**，找到输出 Zarr。`volumes/raw` 应是 32 × 32 × 4 的 XYZ 灰度数组。换自己的切片时，改输入目录、输出路径、体素大小和原点。

## 选择工作流

| 类型 | 支持步骤 |
| --- | --- |
| TIFF 预处理 | 质量检查、亮度归一化、CLAHE 参数试验与全栈处理、切片对齐 |
| 体数据处理 | 裁剪、旋转、重采样/降采样/上采样、合并 NML、WEBKNOSSOS 倍率 |
| 格式转换 | TIFF 切片/三维/多通道、PNG、TXM、HDF5、WKW、Precomputed、WEBKNOSSOS Zarr3 |
| Mito | inspect、prepare、predict、segment、restore、run |
| 神经元分割（LSD / ACRLSD） | inspect、predict |
| Synful | inspect、predict、extract、run |
| 结果查看 | Zarr Neuroglancer，通过 connectio-view 运行 |
| 高级工作流 → 分阶段流程 | precomputed、alignment、affinity、over-segmentation、agglomeration、lut、segmentation、webknossos-downsample |

三类模型的 `predict` 和 Mito、Synful 的 `run` 默认申请 GPU，也可选 CPU。`inspect`、数据准备、单独执行的后处理、查看器和高级入口的阶段使用 CPU。GUI 的默认转换环境是 `data_format_convert`，模型环境是 `lsd_env_py10`。可在表单中更改，或在启动前设置 `CONNECTIO_CONVERSION_ENV` 和 `CONNECTIO_SEGMENTATION_ENV`。

从 TIFF 开始时，归一化和 CLAHE 的切片输出在 `output_folder/tiffs`，对齐后的切片直接在对齐输出目录。预处理结束后，可在 **结果与查看** 打开 PNG、CSV 和 JSON 报告（单个文件最多预览 16 MiB）。具体选参示例见[从 TIFF 切片准备原图]({{ "/zh/modules/" | relative_url }})。

已有亲和图时，进入 **高级工作流 → 分阶段流程**，选提取片段，再用合并图和阈值表生成实例标签。每次只提交当前选中的阶段。各阶段所需输入见[神经元分割流程]({{ "/zh/pipeline/" | relative_url }})。

## 换用自己的数据

- **路径**。用模板或导入已有 JSON。LSD、Mito 和分阶段任务的相对路径以原配置所在目录为基准，Synful 默认以工作目录为基准。`volumes/raw` 是数组名。普通 Zarr 给 Synful 使用时，像素、体素大小和原点都要按 ZYX 排列，物理单位为 nm。
- **输出**。新建转换或裁剪结果默认 Zarr3，可在表单选 2 或 3。另取输出路径；旋转和重采样在原容器中写入新数组。裁剪框按 XYZ 体素填写，右端不含；标签重采样选 `nearest`。
- **检查**。计划检查核对路径、基本字段和资源。有权重时，先提交 `inspect` 检查数据网格和模型，再在小区域试推理。Mito 的 `run` 同时需要 GPU 推理资源和足够完成分水岭的主机内存。
- **查看**。单独启动查看器作业，在自己的电脑上运行结果页给出的查看器 SSH 命令，再打开 `LOCAL_URL`。GUI 与查看器各用一条隧道。看完在 **任务记录** 取消查看器，提交后关闭网页不会结束作业。

## 接收完成邮件

在 **检查与提交 → 设置自己的发件邮箱（SMTP）** 填发件地址、SMTP 主机、端口、加密方式和服务商提供的授权码，点 **验证并保存**。登录名默认是发件地址。凭据以明文保存在工作台状态目录的 `smtp.conf`，文件权限为 `0600`。请在自己的 SSH 转发页面填写。

在 **完成通知邮箱（可选）** 填收件地址，点 **发送测试邮件**，到收件箱核对。新作业有 SMTP 配置时由 GUI 发信，未配置时由 Slurm 处理。留空会关闭本次通知。已有草稿要改用 SMTP，可复制后重新检查计划。浏览器可关闭，GUI 服务应保持运行，或在相同工作空间重启以处理待发邮件。任务记录显示邮件服务器的接收结果；投递中断时先核对收件箱，再决定是否重发。

## 查找记录或恢复作业

工作目录下的 `.connectio_gui/` 保存草稿、配置快照、作业关联和审查记录。`--state-dir` 可另选位置。原图和模型仍由原路径读取，请保留相应版本。任务记录显示日志末尾 64 KiB，也可下载配置、复制运行或记录需要调整的地方。

若看到 `SUBMISSION_UNKNOWN`，先刷新，再按 `connectio-gui-<运行编号前八位>` 在 `squeue` 或 `sacct` 查询，确认是否已入队后再新建运行。LSD 和 Synful 训练在命令行提交，训练进度、损失和 checkpoint 请查训练目录；GUI 任务记录只跟踪通过该工作空间提交的作业。
