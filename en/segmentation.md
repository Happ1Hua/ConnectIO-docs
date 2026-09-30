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

Watershed extracts fragments from the affinity convention produced by the corrected model. Agglomeration writes region-adjacency graph edges and merge scores. LUT generation scans thresholds. The final `segmentation` stage now supports two user-selected outputs through `output_type`:

- `segmentation` (the backward-compatible default) materializes labels for one `threshold` and creates a WEBKNOSSOS Zarr3 dataset with `datasource-properties.json`.
- `agglomerate` creates a WEBKNOSSOS Zarr v3 attachment for every requested threshold and a matching dense-ID base-fragments dataset. Use `thresholds`, or `thresholds_minmax` with `thresholds_step`, and set `agglomerate_file`, `out_file`, and `out_dataset`. The stage reuses the LUT files and the same persistent MongoDB RAG as the preceding stages.

Each directory below `agglomerate_file` is one `AgglomerateViewArtifact`. The stage also creates `webknossos_dataset_path` (by default a sibling `webknossos_dataset` directory) with a dense-ID Zarr3 `segmentation/1` layer, its `segmentation/agglomerates/` attachments, and a root `datasource-properties.json`. Copy this complete dataset directory to WEBKNOSSOS. The Zarr2 volume at `out_file/out_dataset` remains an intermediate output; sparse original fragment IDs cannot index the mappings.

WEBKNOSSOS can use WKW raw and Zarr3 segmentation layers in the same dataset. To add a Zarr2 raw layer instead, call `zarr2_to_zarr3` with `category="color"`; it supports selected source arrays, segmentation layers, and Slurm submission, and updates `datasource-properties.json` on completion.

To add the output to an existing WKW raw dataset, copy its `segmentation/` subdirectory and append the generated segmentation entry to the existing `dataLayers`. Keep the existing raw entry, `scale`, and other metadata rather than replacing the whole datasource file. Both layers must share the same voxel size and coordinate frame.

A dataset with only `segmentation/1` can ask you to zoom in when an agglomerate ID mapping is active. After publishing, run the separate `webknossos-downsample` stage to add segmentation magnifications 2, 4, 8, 16, and 32, matching the raw layer. See `07_webknossos_downsample.example.json`:

```bash
connectio-segmentation-stage webknossos-downsample \
  connectio/segmentation/configs/stages/07_webknossos_downsample.example.json
```

The stage invokes the official WEBKNOSSOS `downsample` CLI for only the selected layer. Segmentation labels use its default mode filter. Connectio restores agglomerate attachment references after older CLI versions rewrite the metadata. `zarr2_to_zarr3` also accepts `downsample_coarsest_mag=32` to generate coarser mags after conversion. Run large datasets through Slurm and ensure the datastore runtime user can read the new magnification directories.

Slurm outputs may be owner-only (directories `700`, files `600`). After placing a dataset in a self-hosted WEBKNOSSOS `binaryData/<organization>/<dataset>`, ensure the datastore's actual runtime user can traverse every directory and read `datasource-properties.json`, Zarr metadata, and chunks; a shared group on the host does not guarantee that the container user belongs to it. Otherwise the web UI may show “Not imported yet”. Use “Scan disk for new datasets” in the dataset dashboard, or allow up to about 10 minutes for automatic discovery.

If “Not imported yet” persists after a scan, check from inside the datastore container that `datasource-properties.json` exists and is readable at the mounted dataset path, then inspect datastore import logs. This status alone does not establish a Zarr volume or agglomerate format error: in WEBKNOSSOS 26.05.0, the scanner emits it when it cannot see the datasource file, while JSON validation failures have a different error status.

```text
webknossos_dataset/
├── datasource-properties.json
├── zarr.json
└── segmentation/
    ├── zarr.json
    ├── 1/                         # dense fragments at global voxel coordinates, Zarr3
    └── agglomerates/
        ├── agglomerate_view_000/
        ├── agglomerate_view_002/
        └── ...
```

`affinities`, `fragments`, and raw must be spatially compared before proceeding—changing affinity polarity inside watershed is a diagnostic workaround, not a replacement for correct supervision.

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
