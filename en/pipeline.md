---
layout: default
title: Raw-to-segmentation pipeline
lang: en
permalink: /en/pipeline/
---

# Raw-to-segmentation pipeline

The reusable workflow is a sequence of independently submitted stages:

| Order | Stage | Input → output | Resource |
|---:|---|---|---|
| 00 | `precomputed` | Neuroglancer precomputed → Zarr raw | CPU |
| 01 | `alignment` | TIFF stack → aligned TIFF stack | CPU |
| 02 | `affinity` | raw + LSD/ACRLSD checkpoints → LSDs + affinities | GPU |
| 03 | `over-segmentation` | affinities → watershed fragments | CPU |
| 04 | `agglomeration` | affinities + fragments → scored RAG | CPU |
| 05 | `lut` | scored RAG → threshold lookup tables | CPU |
| 06 | `segmentation` | fragments + selected LUT → labels | CPU |

Submit any stage directly:

```bash
connectio-segmentation-stage precomputed configs/00_precomputed.json
connectio-segmentation-stage alignment configs/01_alignment.json
connectio-segmentation-stage affinity configs/02_affinity.json
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json
connectio-segmentation-stage agglomeration configs/04_agglomeration.json
connectio-segmentation-stage lut configs/05_lut.json
connectio-segmentation-stage segmentation configs/06_segmentation.json
```

No command runs a predecessor or successor. Existing outputs and persistent state determine whether the selected stage has the inputs it needs. The aliases `watershed`, `align`, and `relabel` remain convenient spellings.

## Review gates

After each stage, review shape, dtype, axis order, resolution, offset, intensity or label range, and spatial agreement with raw. Keep `neuroglancer_view_zarr.py` under the stage's `data/` directory and edit only its Zarr path and dataset. Record approval before submitting the next command.

Recommended checks are lossless voxel comparison after conversion; intensity trends and artifacts after preprocessing; XY, XZ, and YZ continuity after alignment; membrane agreement for affinities; raw overlap and block seams for fragments; and merge/split behavior for final labels.

## Portable layout

```text
project/
├── raw/source.zarr
├── configs/00_precomputed.json ... 06_segmentation.json
├── data/neuroglancer_view_zarr.py
├── logs/
├── reports/
└── reviews/
```

Use one shared raw Zarr and refer to it from all configs. Relative data paths are resolved from the JSON location. `_connectio.run_dir` controls stage status and runtime configs. The `over-segmentation`, `agglomeration`, and `lut` configs must use the same `db_name` and `_connectio.mongodb_dir` so their graph data persists across independent jobs.
