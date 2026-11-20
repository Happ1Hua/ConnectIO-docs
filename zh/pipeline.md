---
layout: default
title: 神经元分割流程
lang: zh
permalink: /zh/pipeline/
---

# 神经元分割从哪一步开始

手上已有对齐好的 Zarr 原图，就从 `affinity` 开始。已有审查过的亲和图，可直接运行 `over-segmentation`。再往后则需要对应阶段的输入。迁移实验时，除了 Zarr 数组，还要保留生成合并关系的图数据库。

## 根据输入选择起点

- **Precomputed 体数据**：用 `precomputed` 生成原图 Zarr，比较体素大小，并与源数据抽样核对像素。
- **尚未配准的切片**：先做 `alignment`，查看对齐后的 TIFF，然后[将切片转成 Zarr]({{ "/zh/formats/" | relative_url }})。
- **已有实例标签**：可直接与原图叠加查看。需要重新预测或比较其他合并策略时，再回到相应阶段。

## 各阶段要留下哪些产物

| 阶段 | 提交前必须具备 | 应检查的输出 |
|---|---|---|
| `precomputed` | precomputed 根目录、选定 `resolution` 和输出 Zarr 路径 | 数组形状、类型、抽样块与原图的体素是否一致、`resolution`/`offset`。 |
| `alignment` | 已排序的源图像及配准方法 | 对齐 TIFF、累计变换、正交截面连续性与无效边缘。 |
| `affinity` | 原图 Zarr、LSD/ACRLSD 配置与配套权重 | 十通道形状描述子和三通道亲和图。与原图叠加检查通道顺序和分块接缝。 |
| `over-segmentation` | 亲和图、`db_name` 与 MongoDB 状态目录 | 片段 ID，以及片段与原图、亲和图是否对齐。 |
| `agglomeration` | 同一亲和图、片段和已保存的图 | 数据库里的边集合及样例区域的合并分数。 |
| `lut` | 合并阶段留下的图，`edges_collection` 对应所用合并函数 | 阈值 LUT；选择阈值前比较几个结果。 |
| `segmentation` | 片段和选定的阈值表 | 最终标签的误合并、误切分、缺失前景和块接缝。 |

命令行的 `affinity` 阶段默认在一次 GPU 作业中先后运行两个网络。提取片段、构图、生成阈值表和导出标签使用 CPU。在 GUI 里要用 GPU 预测，选 **神经元分割 → predict**；高级入口中的分阶段任务使用 CPU。

## 提交一个阶段

从 `connectio/segmentation/configs/stages/` 复制所需的 `*.example.json`。假设已经把片段提取的配置另存为 `configs/03_over_segmentation.json`，并将输入改成自己的数据。相对路径从该 JSON 所在目录解析。

```bash
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json --dry-run
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json
```

第一条命令打印计划，第二条提交作业。检查 `<run_dir>/<stage>/status.json` 和作业的 `stderr.log`，将 fragments 叠到原图上，再决定是否开始合并。保留配置、数组路径、权重、作业号以及检查过的区域，方便之后比较不同阈值下的结果。

worker 设置、阈值选择和量化评估见[从亲和图生成标签]({{ "/zh/lsd-guide/" | relative_url }})。向 WEBKNOSSOS 导出标签或多阈值合并映射见[LSD 训练与标签导出]({{ "/zh/segmentation/" | relative_url }})。
