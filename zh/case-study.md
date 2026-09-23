---
layout: default
title: digspider 实测案例
lang: zh
permalink: /zh/case-study/
---

# digspider：raw 到 segmentation 实测

仓库在 `test_from_raw_to_seg/` 保留本次可复现记录。全流程采用 **XYZ 8×8×8 nm**，转换、预处理和对齐使用 `data_format_convert`，分割使用 `lsd_pytorch`。每个阶段分别保存 scripts、configs、data、reports、logs 和审查记录；根目录 `raw/` 保存共享 raw，避免各阶段重复复制 Zarr。

## 转换、预处理和对齐

源数据是 1,006 张 3072×2048 的 uint8 TIFF。转换得到 XYZ shape 为 3072×2048×1006 的 `volumes/raw`，6,329,204,736 个体素全部与源 TIFF 相等。TIFF 元数据记录 XY=7.8125 nm，本次按用户确认将 XYZ 均记为 8 nm，没有重采样。

预处理完成全栈 QC、归一化和 CLAHE 1.5/16。局部亮斑和竖向条纹被确认是拍摄伪影。各项输出经人工检查后才进入下一步。

对齐以 phase 为主，在异常处使用受约束 ORB/RANSAC 回退；逐层变换累计到第 0 层，每张原图只插值一次。纯平移方案在第 461 层附近失败，最终自适应方案识别出尺度变化并完成 1,006 层。报告包含逐层变换、有效区域、共同有效 mask、相邻 NCC、正交截面和逐体素验证。

## 微调与 affinity 修复

在 digspider GT 上从 Spider baseline 微调：LSD 20,000 步、ACRLSD 5,000 步。随后审计发现复现代码错误地用非零 label 作为 affinity valid mask，使 GrowBoundary 生成的零边界没有作为负边参与监督，模型可通过预测大范围连通降低 loss，XY 通道尤其明显。

修复后，target 与监督有效性独立；valid 同时检查两端 mask，补回邻居 halo，并恢复跨通道带裁剪的平衡。真实 GT 上的 target、mask 和 weight 与 Gunpowder 对照一致。旧微调 checkpoint 和无效推理结果已删除，两个模型均从 baseline 重新训练。

## 最终分割

新 checkpoint 对 ground-truth source raw 重新推理，裁剪后的 affinity 在 Neuroglancer 中与 raw 贴合。之后分别运行并检查 watershed fragments、agglomeration、threshold LUT 和最终 relabel。调查说明早期 fragments 错位源于异常 affinity/watershed 路径；`local_min_candidate` 仅用于诊断，没有作为替代监督修复的生产方案。

案例目录保留实际执行证据；本网站作为可复用说明，reports 和 JSON review 继续保存确切 job ID、hash、参数与审查结论。
