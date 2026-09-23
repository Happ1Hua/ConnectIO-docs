---
layout: default
title: Segmentation
lang: en
permalink: /en/segmentation/
---

# Segmentation

## Independent stages

`connectio-segmentation-stage` is the preferred operator interface. The affinity stage runs the paired LSD and ACRLSD inference configs on one GPU allocation. The remaining stages are intentionally separate so affinities, fragments, agglomeration thresholds, and labels can be reviewed between submissions.

The example configs live in `connectio/segmentation/configs/stages/`. Native Funke keys remain unchanged. The optional `_connectio` object holds runner settings:

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

A stage-local MongoDB process starts for over-segmentation, agglomeration, or LUT generation and stops when that job ends. Its database files persist in `mongodb_dir`; use the same directory and `db_name` for all three stages. A lock prevents concurrent access to the same database directory. Worker jobs receive the compute-node MongoDB address.

Each stage writes `<run_dir>/<stage>/status.json` with `RUNNING`, `COMPLETED`, or `FAILED`. Affinity also saves resolved runtime configs. Use `--slurm-options` to change time, resources, account, or queue for the outer stage; the Funke `queue` config controls its block workers.

## Models and training

The default Spider pair targets 8×8×8 nm FIB-SEM:

| Stage | Checkpoint | Iteration |
|---|---|---:|
| LSD | `lsd_spider_8x8x8nm_fibsem_v1_450000.pt` | 450000 |
| ACRLSD | `acrlsd_spider_8x8x8nm_fibsem_v1_230000.pt` | 230000 |

The weights are internal TensorFlow/MALA conversions and Git LFS assets. Their configs set `activate_upsampling=true` to preserve the source transposed-convolution ReLU behavior. The model manifest records species, resolution, modality, version, and iteration.

Training data requires `volumes/raw`, `volumes/labels/neuron_ids`, and `volumes/labels/labels_mask`. GPU training uses `connectio-lsd-train` or `connectio/segmentation/scripts/submit_training.sh`. LSD and ACRLSD configs must use the same architecture as their checkpoints.

The corrected affinity supervision treats a target as positive only when both voxels belong to the same nonzero object, while validity is controlled independently by the two endpoint masks and neighbor availability. Boundary zeros remain valid negative examples. Production training also uses the required neighbor halo and cross-channel clipped balancing.

## Inference and post-processing

Inference writes channel-first `uint8` predictions and copies raw `resolution` and `offset`. The local JSON block tracker permits restart when `mongo_required=false`. The affinity stage disables MongoDB for inference and runs LSD before ACRLSD.

Watershed extracts fragments from the affinity convention produced by the corrected model. Agglomeration writes region-adjacency graph edges and merge scores. LUT generation scans thresholds; final segmentation relabels fragments using one selected threshold. `affinities`, `fragments`, and raw must be spatially compared before proceeding—changing affinity polarity inside watershed is a diagnostic workaround, not a replacement for correct supervision.

The legacy `00.submit_affinity.sh` and `01.submit_crop_postprocess.sh` remain for compatibility, but the latter chains downstream steps and is not the preferred review-gated interface.

## Evaluation and viewing

Evaluation intersects ground truth and prediction in world coordinates using Zarr `offset` and `resolution`, then reports VOI, Rand, label counts, foreground voxels, and the largest-segment fraction:

```bash
connectio-lsd-evaluate \
  GT.zarr volumes/labels/neuron_ids \
  RESULT.zarr volumes/segmentation \
  --output evaluation.json

connectio-lsd-view RESULT.zarr volumes/raw volumes/segmentation
```

A lightweight CPU smoke test may use a reduced network to validate I/O and control flow. Production Spider smoke tests should run one real LSD block followed by one ACRLSD block on `GPUA800`, writing to a dedicated test Zarr rather than the source volume.
