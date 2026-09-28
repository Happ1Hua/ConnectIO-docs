---
layout: default
title: digspider 实测案例
lang: zh
permalink: /zh/case-study/
---

# digspider：raw 到 segmentation 实测

本地运行使用 `tests/workspaces/raw_to_seg/`，全流程采用 **XYZ 8×8×8 nm**，转换、预处理和对齐使用 `data_format_convert`，分割使用 `lsd_pytorch`。每个阶段分别保存 scripts、configs、data、reports、logs 和审查记录；工作区内 `raw/` 保存共享 raw，避免各阶段重复复制 Zarr。`tests/workspaces/` 被 Git 忽略，因此**公开仓库不保证包含这些运行产物**。本页记录经过核验的结论，并非数据下载页。

## 转换、预处理和对齐

源数据是 1,006 张 3072×2048 的 uint8 TIFF。转换得到 XYZ shape 为 3072×2048×1006 的 `volumes/raw`，6,329,204,736 个体素全部与源 TIFF 相等。TIFF 元数据记录 XY=7.8125 nm，本次按用户确认将 XYZ 均记为 8 nm，没有重采样。

预处理完成全栈 QC、归一化和 CLAHE 1.5/16。局部亮斑和竖向条纹被确认是拍摄伪影。各项输出经人工检查后才进入下一步。

对齐以 phase 为主，在异常处使用受约束 ORB/RANSAC 回退；逐层变换累计到第 0 层，每张原图只插值一次。纯平移方案在第 461 层附近失败，最终自适应方案识别出尺度变化并完成 1,006 层。报告包含逐层变换、有效区域、共同有效 mask、相邻 NCC、正交截面和逐体素验证。

## 微调与 affinity 修复

在 digspider GT 上从 Spider baseline 微调：LSD 20,000 步、ACRLSD 5,000 步。随后审计发现复现代码错误地用非零 label 作为 affinity valid mask，使 GrowBoundary 生成的零边界没有作为负边参与监督，模型可通过预测大范围连通降低 loss，XY 通道尤其明显。

修复后，target 与监督有效性独立；valid 同时检查两端 mask，补回邻居 halo，并恢复跨通道带裁剪的平衡。真实 GT 上的 target、mask 和 weight 与 Gunpowder 对照一致。旧微调 checkpoint 和无效推理结果已删除，两个模型均从 baseline 重新训练。

## 最终分割

新 checkpoint 对 ground-truth source raw 重新推理，裁剪后的 affinity 在 Neuroglancer 中与 raw 贴合。之后分别运行并检查 watershed fragments、agglomeration、threshold LUT 和最终 relabel。调查说明早期 fragments 错位源于异常 affinity/watershed 路径；`local_min_candidate` 仅用于诊断，没有作为替代监督修复的生产方案。

## 如何借鉴本案例

本案例展示的是逐阶段验收方法，不是所有样本都通用的一组参数。保留原始 TIFF，另建转换后的 Zarr，强度处理前先逐体素核对转换结果。将归一化和 CLAHE 的输出分开保存，才能独立检查每步影响。对齐先产生 TIFF 和报告；确认后再将对齐 TIFF 转为推理所需 Zarr。下游始终保留 `resolution`、`offset`，每个科学阶段都在 XY、XZ、YZ 中审查。

训练时不仅看 loss，还应核对 affinity 正边、负边和忽略边的目标与权重。修改监督后，需重新推理并运行所有依赖它的后处理阶段。最终标签应在有代表性的区域比较多个阈值，并同时报告错误合并与错误拆分。[LSD 操作指南]({{ "/zh/lsd-guide/" | relative_url }})提供新运行所需命令与状态约束。

## 证据与复现边界

如果本地工作区仍在，reports 和 JSON 审查记录保存确切 job ID、hash、参数与结论。但这些大型数据和本地记录不在公开仓库中，因为 `tests/workspaces/` 被忽略。读者可以依据公开配置与文档复现*方法*；若缺少原始图像、GT、权重和本地运行记录，则不能直接复现本次的具体定量结果。以上数值只描述这一例，不应推广到其他体数据。
