---
layout: default
title: Neuron segmentation stages
lang: en
permalink: /en/pipeline/
---

# Where to start a neuron segmentation run

With an aligned raw Zarr, begin at `affinity`. With accepted affinities, begin at `over-segmentation`. A later stage can start as soon as its inputs exist. Keep the graph database as well as the Zarr arrays when you move a run.

## Choose an input route

- **Precomputed volume.** Run `precomputed` to write the raw Zarr. Compare the resolution and a sample of voxels against the source.
- **Unregistered slices.** Run `alignment`, review the aligned TIFFs, then [convert them to Zarr]({{ "/en/formats/" | relative_url }}).
- **Existing labels.** Open them alongside raw for review. You only need to rerun prediction or merging if you want to generate new labels.

## What to keep between stages

| Stage | Minimum state before submission | Output to inspect |
|---|---|---|
| `precomputed` | Precomputed root and chosen `resolution`, output Zarr path | Shape, dtype, voxel equality on sample blocks, and `resolution`/`offset`. |
| `alignment` | Ordered source images and selected registration method | Aligned TIFF stack, cumulative transforms, orthogonal continuity, and invalid borders. |
| `affinity` | Raw Zarr, LSD and ACRLSD configs, matching checkpoints | Ten LSD channels then three affinity channels; confirm raw alignment, channel order, values, and block seams. |
| `over-segmentation` | Affinities plus `db_name` and MongoDB state directory | Fragment IDs and spatial correspondence with raw and affinities. |
| `agglomeration` | Same affinities/fragments and persistent graph state | Edge collection and merge-score behavior across sample regions. |
| `lut` | The graph from agglomeration; `edges_collection` must match its merge function | Threshold lookup tables; compare a few thresholds before selecting one. |
| `segmentation` | Fragments and the selected LUT | Final labels; examine merges, splits, missing foreground, and seams. |

The CLI `affinity` stage runs both networks in one GPU allocation by default. The fragment, graph, LUT and export stages use CPU workers. When using the GUI, choose **Neuron segmentation → predict** for GPU prediction. The separate advanced stage menu uses CPU.

## Submit one stage

Copy the matching `*.example.json` files from `connectio/segmentation/configs/stages/` to your run directory. The command below assumes you saved the fragment config as `configs/03_over_segmentation.json` and updated its input paths. Relative paths start from the config directory.

```bash
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json --dry-run
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json
```

The first command prints the plan. The second submits the job. Check `<run_dir>/<stage>/status.json` and the job's `stderr.log`, then overlay the fragments on raw before you start agglomeration. Record the config, dataset path, checkpoint, job ID and a region you inspected. If you compare thresholds later, this identifies the graph and raw region behind each result.

For worker setup, threshold selection and quantitative evaluation, continue with [from affinities to labels]({{ "/en/lsd-guide/" | relative_url }}). For a WEBKNOSSOS dataset or switchable agglomerate mappings, see [LSD training and label export]({{ "/en/segmentation/" | relative_url }}).
