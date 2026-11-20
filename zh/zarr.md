---
layout: default
title: Zarr 格式与坐标
lang: zh
permalink: /zh/zarr/
---

# 选择 Zarr 格式，确定数据的位置

读取时 ConnectIO 可识别本地目录中的 Zarr2 和 Zarr3，分别使用 `zarr<3` 和 TensorStore。新建输出的默认格式取决于从哪里调用。

| 操作 | 新输出采用的格式 |
| --- | --- |
| Python 转换或裁剪函数 | 默认 Zarr2，可传 `zarr_format=3` |
| 转换、裁剪教程或 GUI 模板 | 默认 Zarr3，可在教程加 `--zarr-format 2` 或在表单选 2 |
| 同一容器内的旋转、重采样 | 沿用容器格式 |
| WEBKNOSSOS 图层导出 | Zarr3，同时生成 WEBKNOSSOS 所需的数据集描述 |

```python
from connectio.conversion import tiff_stack_to_zarr

tiff_stack_to_zarr("aligned", "new.zarr", zarr_format=3, backend="local")
```

模型或 Funke 阶段可在 JSON 中设置 `"zarr_format": 3`。`CONNECTIO_ZARR_FORMAT` 可设进程默认值。向已有容器写入时，显式格式必须与其一致。要更换格式，请写到新目录。v3 写入支持定长数值、布尔数组和 Blosc、zstd、gzip 压缩。变长或对象数据要先选合适的数值表示。

## 找到图层和原点

普通数组如 `volumes/raw`，从数组属性读取轴序和物理坐标。在 WEBKNOSSOS 数据集中，用 `color/1`、`segmentation/4` 等路径选图层和倍率；只写层名时，使用该层最细的可用倍率。读取器按包围盒去除全局填充，将比例尺换算为 nm，并按 `dimension_names` 或 `axisOrder` 排列轴。较粗倍率的包围盒会向外对齐到体素网格。

逻辑数组的索引零是该区域的起点。物理 `offset` 表示这个体素在样本中的位置。裁剪范围按相对于该区域的 **XYZ 体素索引**填写，另给裁剪偏移时除外。旋转或重采样已注册的图层，请另填输出数组名。模型要求其他体素间距时，要显式重采样。

## 对接模型和标注

- LSD 训练可把 `datasets.raw`、`datasets.labels`、`datasets.mask` 分别指向 `color/1`、`segmentation/1` 和监督掩膜。先确认三者覆盖相同的物理区域。
- Mito 读取已声明的 XYZ 或 ZYX，并把最终实例标签还原到原轴序。普通 Synful 数组和训练标注采用 ZYX 纳米坐标。WEBKNOSSOS 数据可按区域作为 ZYX 视图供 Synful 读取。
- 导入 CSV 要看坐标列名。Synful 的 pre/post 列分别标记物理轴，WEBKNOSSOS NML 节点使用倍率 1 的 XYZ 体素坐标。原点和映射见[突触导出]({{ "/zh/synful/" | relative_url }})。

双格式回归检查比较像素、标签、物理原点和恢复行为。教程另测了显式格式选择及已有容器的写入。[Zarr 测试记录]({{ "/validation/zarr3-26.10.28.json" | relative_url }}) · [教程格式验证]({{ "/validation/tutorial-formats-26.11.05.json" | relative_url }})
