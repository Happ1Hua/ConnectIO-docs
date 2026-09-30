---
layout: default
title: Raw-to-segmentation pipeline
lang: en
permalink: /en/pipeline/
---

# Raw-to-segmentation pipeline

The reusable workflow has optional input-preparation routes followed by independently submitted segmentation stages. `precomputed` and `alignment` are different ways to prepare input data; they are not mandatory consecutive steps.

| Order | Stage | Input → output | Resource |
|---:|---|---|---|
| 00 | `precomputed` | Neuroglancer precomputed → Zarr raw; optional input route | CPU |
| 01 | `alignment` | TIFF stack → aligned TIFF stack; optional input route | CPU |
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

## Choose the raw input route

Use `precomputed` when the source is a local Neuroglancer precomputed directory. It writes a Zarr dataset such as `volumes/raw`; choose `mode: "large"` for a very wide or large volume and check `resolution` before conversion. Use `alignment` when the source is an image stack that needs pairwise registration. It writes aligned TIFF files and an alignment report, **not** a raw Zarr. Convert the accepted aligned TIFF stack to Zarr with `tiff_stack_to_zarr` before LSD inference. If you already have an aligned Zarr raw volume with correct physical metadata, begin at affinity.

The stage templates are [in ConnectIO main](https://github.com/Happ1Hua/ConnectIO/tree/main/connectio/segmentation/configs/stages). Copy them into a run directory and replace every example path. Stage JSON path fields are resolved from the JSON file's directory. Native Funke values, such as `block_size` and `context`, retain the units expected by Funke; they are not automatically converted from voxel counts.

## Inputs, outputs, and review decisions

| Stage | Minimum state before submission | Output to inspect |
|---|---|---|
| `precomputed` | Precomputed root and chosen `resolution`, output Zarr path | Shape, dtype, voxel equality on sample blocks, and `resolution`/`offset`. |
| `alignment` | Ordered source images and selected registration method | Aligned TIFF stack, cumulative transforms, orthogonal continuity, and invalid borders. |
| `affinity` | Raw Zarr, LSD and ACRLSD configs, matching checkpoints | Ten LSD channels then three affinity channels; confirm raw alignment, channel order, values, and block seams. |
| `over-segmentation` | Affinities plus `db_name` and MongoDB state directory | Fragment IDs and spatial correspondence with raw and affinities. |
| `agglomeration` | Same affinities/fragments and persistent graph state | Edge collection and merge-score behavior across sample regions. |
| `lut` | The graph from agglomeration; `edges_collection` must match its merge function | Threshold lookup tables; compare a few thresholds before selecting one. |
| `segmentation` | Fragments and the selected LUT | Final labels; examine merges, splits, missing foreground, and seams. |

The affinity stage sequentially runs LSD prediction and ACRLSD prediction in one GPU allocation. It saves resolved runtime copies of both inference configs. Post-processing starts a stage-local MongoDB service for over-segmentation, agglomeration, and LUT generation; the database files persist between jobs. Keep `db_name`, `_connectio.mongodb_dir`, fragment paths, and the agglomeration edge collection consistent across these stages. The standard final label extraction uses a chosen `threshold` and writes `out_file/out_dataset`.

## Submit and follow one stage

```bash
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json --dry-run
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json \
  --slurm-options '{"time":"24:00:00","cpus_per_task":8}'
```

`--dry-run` prints the resource plan and checks the config file exists; it does not execute the stage or check every scientific input. A submitted job writes `<run_dir>/<stage>/status.json` with `RUNNING`, `COMPLETED`, or `FAILED`. The generic Slurm job directory separately contains `stdout.log`, `stderr.log`, and execution metadata. Review both records when diagnosing a failure. The stage never automatically submits its successor.

When reusing an existing data product, check its geometry and provenance before starting downstream. A new run directory does not regenerate the input. Do not run two post-processing stages simultaneously against the same MongoDB directory; the stage runner locks it. If a model, input, merge function, or threshold policy changes, record that choice and use distinct output paths so old and new results can be compared.

## Practical review record

For each accepted stage, retain the config, output path and dataset, model/checkpoint identity where relevant, job ID, status JSON, and a short image review note. A useful note states which XY/XZ/YZ views were inspected, where the crop lies in physical coordinates, and whether seams or obvious merges/splits were seen. The [digspider case study]({{ "/en/case-study/" | relative_url }}) shows why numerical completion alone is insufficient for accepting a segmentation.
