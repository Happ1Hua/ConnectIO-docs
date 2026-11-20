---
layout: default
title: From affinities to labels
lang: en
permalink: /en/lsd-guide/
---

# From affinities to neuron labels

Start with raw and matching LSD/ACRLSD checkpoints, or pick up from an affinity volume whose origin and voxel size you know. The Spider pair expects 8 nm isotropic FIB-SEM. To generate `lsd.json`, `acrlsd.json` and the stage config from your checkpoints, see [weights and inference configs]({{ "/en/models/" | relative_url }}).

## Inspect all three affinity channels

```bash
connectio-segmentation-stage affinity runs/spider/affinity.json --dry-run
connectio-segmentation-stage affinity runs/spider/affinity.json
```

The stage writes ten shape descriptor channels followed by a separate three-channel affinity array. The predictions are channel-first `uint8`. Overlay each affinity direction with raw in XY, XZ and YZ. Look at a membrane crossing a block boundary. A missing block, reversed polarity or one direction that stays bright across membranes will also affect fragments. A bounded test with `connectio-lsd-predict --max-blocks` needs its own output location.

## Carry the graph through merging

| File | Purpose | Consistency check |
|---|---|---|
| `02_affinity.json` | LSD followed by ACRLSD inference in one GPU allocation | Both underlying inference configs target the same raw geometry and compatible checkpoints. |
| `03_over_segmentation.json` | Watershed fragments | `affs_file`/`affs_dataset` name the accepted affinity output. |
| `04_agglomeration.json` | Score region-adjacency graph edges | Reuse fragments, `db_name`, and `_connectio.mongodb_dir`. |
| `05_lut.json` | Threshold lookup tables | `edges_collection` matches the agglomeration merge function. |
| `06_segmentation.json` | Materialized labels at one threshold | Use the accepted LUT and a separate `out_dataset`. |

In the examples, `hist_quant_75` writes the edge collection read as `edges_hist_quant_75`. Keep the same database and fragment sources across jobs. Local workers can use the automatic loopback MongoDB. Cross-node workers need a reachable, authenticated service set via `_connectio.mongodb_uri`, `CONNECTIO_MONGODB_URI` or `db_host`. Keep credentials out of shared configs. See [worker and job settings]({{ "/en/slurm/" | relative_url }}).

Inspect raw and fragments at a block border, then compare several LUT thresholds on the **same** crop. Count errors in both directions: one neuron split into pieces, and distinct neurons merged. Save the selected `threshold` with the edge collection name. Funke `block_size` and `context` use physical units. Inference `input_shape` and `output_block_shape` use voxels.

With the example configs saved under the filenames below, choose one command at a time. Review its output before submitting the next.

```bash
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json
connectio-segmentation-stage agglomeration configs/04_agglomeration.json
connectio-segmentation-stage lut configs/05_lut.json
connectio-segmentation-stage segmentation configs/06_segmentation.json
```

## Resume or evaluate

After an interruption, inspect the stage status and worker logs. Prediction recovery checks the checkpoint, geometry, input revision and completed blocks. If any have changed, use a fresh output. Keep source arrays and recovery records together. A new `run_dir` provides new logs but cannot recreate a lost merge graph.

To compare with ground truth, use integer labels on a shared grid. The example declares both arrays XYZ. Substitute the actual stored axis order when metadata is missing.

```bash
connectio-lsd-evaluate GT.zarr volumes/labels/neuron_ids \
  RESULT.zarr volumes/segmentation --gt-axes xyz --seg-axes xyz \
  --output evaluation.json
```

The evaluator intersects the two physical extents using `resolution` and `offset` and reports VOI and Rand on nonzero ground-truth voxels. Match axes, units and spacing before running it. Offsets must lie on the same voxel grid (tolerance `1e-6` voxels). A half-voxel shift requires correcting the geometry. For large comparisons see [memory and recovery settings]({{ "/en/optimization/" | relative_url }}).
