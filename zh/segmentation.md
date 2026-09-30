---
layout: default
title: 分割
lang: zh
permalink: /zh/segmentation/
---

# 分割

## 独立阶段

推荐使用 `connectio-segmentation-stage`。affinity 阶段在一次 GPU allocation 中依次运行配套的 LSD 和 ACRLSD 配置；之后的阶段完全分开，便于在 affinity、fragments、合并阈值和最终标签之间逐步人工审查。

示例配置位于 `connectio/segmentation/configs/stages/`。Funke 原生字段保持不变，可选的 `_connectio` 对象保存运行器设置：

```json
{
  "db_name": "sample_segmentation",
  "_connectio": {
    "run_dir": "../logs/stages",
    "mongodb_dir": "../logs/stages/mongodb",
    "mongod": "/path/to/mongod"
  }
}
```

运行 over-segmentation、agglomeration 或 LUT 时，作业内启动阶段专用 MongoDB，结束时关闭，数据库文件保留在 `mongodb_dir`。这三步必须复用同一目录和 `db_name`。文件锁会阻止两个阶段同时访问同一数据库；Daisy worker 会收到所在计算节点的 MongoDB 地址。

每步写入 `<run_dir>/<stage>/status.json`，状态为 `RUNNING`、`COMPLETED` 或 `FAILED`。affinity 还保存解析为绝对路径的运行时配置。外层作业的时间、资源、account 和队列由 `--slurm-options` 控制；Funke 配置中的 `queue` 控制其分块 worker。

## 模型与训练

默认 Spider 模型适用于 8×8×8 nm FIB-SEM：

| 阶段 | checkpoint | 迭代 |
|---|---|---:|
| LSD | `lsd_spider_8x8x8nm_fibsem_v1_450000.pt` | 450000 |
| ACRLSD | `acrlsd_spider_8x8x8nm_fibsem_v1_230000.pt` | 230000 |

权重来自内部 TensorFlow/MALA checkpoint 转换，并通过 Git LFS 管理。配置设置 `activate_upsampling=true`，保留原网络反卷积后的 ReLU。manifest 记录物种、分辨率、成像方式、版本和迭代数。

训练样本需要 `volumes/raw`、`volumes/labels/neuron_ids`、`volumes/labels/labels_mask`。GPU 训练使用 `connectio-lsd-train` 或 `connectio/segmentation/scripts/submit_training.sh`；配置中的网络结构必须与 checkpoint 一致。

修正后的 affinity 监督将 target 和 valid 分开：两端属于同一非零对象时 target 才为正；valid 由两端 mask 和邻居是否存在决定。GrowBoundary 产生的零边界仍是有效负样本。生产训练同时补齐邻居 halo，并按跨通道、带裁剪的规则平衡权重。

## 推理和后处理

推理输出 channel-first `uint8`，继承 raw 的 `resolution` 与 `offset`。当 `mongo_required=false` 时，本地 JSON block tracker 可用于断点继续。独立 affinity 阶段关闭推理 MongoDB，并先运行 LSD、再运行 ACRLSD。

watershed 根据已修复模型的 affinity 约定提取 fragments；agglomeration 写入区域邻接图和 merge score；LUT 阶段扫描阈值。最终 `segmentation` 阶段现在通过 `output_type` 提供两种由用户选择的输出：

- `segmentation`（向后兼容的默认值）按一个 `threshold` 生成实体标签体积，并同时生成带 `datasource-properties.json` 的 WEBKNOSSOS Zarr3 dataset。
- `agglomerate` 为每个指定阈值生成 WEBKNOSSOS Zarr v3 attachment，并生成一层 ID 连续、与 attachment 匹配的 base-fragments segmentation。阈值可用 `thresholds`，或 `thresholds_minmax` 加 `thresholds_step` 指定；同时设置 `agglomerate_file`、`out_file` 和 `out_dataset`。该阶段复用 LUT 文件及前序阶段持久化的同一个 MongoDB RAG。

`agglomerate_file` 下的每个目录都是一个 `AgglomerateViewArtifact`。阶段同时生成 `webknossos_dataset_path`（默认与 `agglomerate_file` 同级的 `webknossos_dataset`）：其中 `segmentation/1` 是与映射匹配的 dense base-fragments Zarr3，`segmentation/agglomerates/` 是各阈值附件，根目录含 `datasource-properties.json`。将整个 dataset 目录放到 WEBKNOSSOS 对应位置即可。`out_file/out_dataset` 仍保存中间 Zarr2 标签体；原始稀疏 fragment ID 不能直接索引附件。

WEBKNOSSOS 可在一个 dataset 中同时使用 WKW raw 和 Zarr3 segmentation；raw 无须为此强制转换。若希望把 Zarr2 raw 也放入该 dataset，可用 `zarr2_to_zarr3` 单独添加 `category="color"` 图层。转换器支持 `category="segmentation"`、指定源数组路径和 Slurm 提交，完成时自动更新 `datasource-properties.json`。

若要并入已有 WKW raw dataset，只需复制成品的 `segmentation/` 子目录，并把成品 JSON 的 segmentation 项追加到已有 `dataLayers`；保留已有 raw 项、`scale` 和其他元信息，不要用成品 JSON 整体覆盖已有文件。两者的体素大小与坐标系必须一致。

只含 `segmentation/1` 的数据集在缩小视图并启用 agglomerate ID Mapping 时，会提示需要放大。发布后使用独立的 `webknossos-downsample` 阶段，为 **segmentation 图层**生成与 raw 匹配的 2、4、8、16、32 倍率；示例配置为 `07_webknossos_downsample.example.json`：

```bash
connectio-segmentation-stage webknossos-downsample \
  connectio/segmentation/configs/stages/07_webknossos_downsample.example.json
```

该阶段调用 WEBKNOSSOS 官方 `downsample` CLI，仅处理指定图层，默认使用适合分割 ID 的众数滤波；Connectio 会在旧版 CLI 写回 metadata 后保留原有 agglomerate 附件引用。`zarr2_to_zarr3` 也可设置 `downsample_coarsest_mag=32`，在转换后生成粗倍率。大型数据请通过 Slurm 运行，且确认新倍率目录对 datastore 运行账户可读。

通过 Slurm 生成的文件可能采用仅所有者可读的权限（目录 `700`、文件 `600`）。将 dataset 放入自建 WEBKNOSSOS 的 `binaryData/<组织>/<数据集>` 后，应确认 datastore 实际运行账户能遍历所有目录并读取 `datasource-properties.json`、Zarr 元信息及数据块；同属 `songkun` 等共享组不等于容器账户一定有该组权限。否则网页可能显示 “Not imported yet”。WEBKNOSSOS 可从数据集列表执行 “Scan disk for new datasets”，自动发现也可能需要约 10 分钟。

若扫描后仍显示 “Not imported yet”，先在 datastore 容器内确认实际挂载路径下存在且可读取 `datasource-properties.json`，再查看 datastore 导入日志。该状态本身不能证明 Zarr 体素或 agglomerate 数组格式有误；至少在 WEBKNOSSOS 26.05.0 中，扫描器看不到 datasource 文件时会产生这一状态，而 JSON 校验失败会产生不同的错误。

```text
webknossos_dataset/
├── datasource-properties.json
├── zarr.json
└── segmentation/
    ├── zarr.json
    ├── 1/                         # 全局体素坐标下的 dense fragments，Zarr3
    └── agglomerates/
        ├── agglomerate_view_000/
        ├── agglomerate_view_002/
        └── ...
```

进入下一步前必须将 affinity、fragments 与 raw 叠加检查。改变 watershed 的 affinity 极性只适合作为诊断，不能替代正确监督。

旧的 `00.submit_affinity.sh` 和 `01.submit_crop_postprocess.sh` 仍保留兼容；后者会串行执行多个后处理步骤，不推荐用于需要逐步人工审查的新流程。

## 评估与查看

评估根据 Zarr 的 `offset` 和 `resolution` 求 ground truth 与 prediction 的物理坐标交集，并输出 VOI、Rand、标签数、前景体素数和最大 segment 占比：

```bash
connectio-lsd-evaluate \
  GT.zarr volumes/labels/neuron_ids \
  RESULT.zarr volumes/segmentation \
  --output evaluation.json

connectio-lsd-view RESULT.zarr volumes/raw volumes/segmentation
```

CPU 轻量 smoke test 可用缩小网络验证 I/O 和控制流。生产尺寸 Spider smoke test 应在 `GPUA800` 分别运行一个真实 LSD block 和一个 ACRLSD block，并写入独立测试 Zarr，不修改源体积。
