---
layout: default
title: LSD and ACRLSD operator guide
lang: en
permalink: /en/lsd-guide/
---

# LSD and ACRLSD: an operator guide

This guide expands the [segmentation overview]({{ "/en/segmentation/" | relative_url }}) into a run checklist. The [pipeline map]({{ "/en/pipeline/" | relative_url }}) covers every stage, while this page focuses on model inference, graph state, review decisions, and recovery. Synful is a separate synapse-partner workflow.

## Prepare inputs and a run directory

Start with a 3D raw Zarr dataset whose spatial axes are XYZ. Record its shape, dtype, `resolution`, and `offset`; these are physical-coordinate metadata, not just viewer settings. Prepare compatible LSD and ACRLSD checkpoints. The default Spider pair was trained for 8 nm isotropic FIB-SEM; do not treat it as a universal model for another resolution or modality. The manifest lists the model identity and iteration, but weights must be available locally; a manifest entry does not download a checkpoint.

Copy the JSON examples in `connectio/segmentation/configs/stages/` into a new `configs/` directory. Edit data paths, datasets, checkpoints, block sizes, worker resources, and `_connectio.run_dir`. Paths in the stage config resolve relative to that JSON file. Keep distinct output locations for separate experiments. The source Zarr should not be overwritten by conversion or preprocessing while a segmentation job reads it.

| File | Purpose | Consistency check |
|---|---|---|
| `02_affinity.json` | LSD followed by ACRLSD inference in one GPU allocation | Both underlying inference configs target the same raw geometry and compatible checkpoints. |
| `03_over_segmentation.json` | Watershed fragments | `affs_file`/`affs_dataset` name the accepted affinity output. |
| `04_agglomeration.json` | Score region-adjacency graph edges | Reuse fragments, `db_name`, and `_connectio.mongodb_dir`. |
| `05_lut.json` | Threshold lookup tables | `edges_collection` matches the agglomeration merge function. |
| `06_segmentation.json` | Materialized labels at one threshold | Use the accepted LUT and a separate `out_dataset`. |

The `block_size` and `context` values in native Funke configs follow that library's expected physical-unit conventions. They are not interchangeable with the inference JSON's `input_shape` and `output_block_shape`, which are voxel counts. Check both before changing tiling.

## Run and inspect affinity prediction

```bash
connectio-segmentation-stage affinity configs/02_affinity.json --dry-run
connectio-segmentation-stage affinity configs/02_affinity.json
```

The dry run prints the submission plan; it does not prove that the checkpoint exists or that the Zarr dataset is valid. The real stage submits to Slurm, runs LSD first, then ACRLSD, and records resolved runtime configs under its run directory. Prediction writes channel-first `uint8`: ten LSD descriptors or three affinity channels, followed by XYZ spatial dimensions. The outputs copy the raw dataset's `resolution` and `offset`. The local JSON block tracker supports restart when inference uses `mongo_required=false`. For a small controlled check, the inference entry point accepts `--max-blocks` and repeated `--block-index` arguments; use a dedicated test output so a partial prediction is never mistaken for a complete volume.

Do not advance merely because the job exited successfully. Compare all three affinity directions with the raw volume in XY, XZ, and YZ. Look for membrane contrast, axial drift, wrong polarity, missing blocks, and seams. Record the checkpoint and accepted output paths. The corrected supervision regards equal nonzero labels as positive edges; zero-valued boundaries can still be valid negative examples if their endpoint masks permit supervision.

## Post-process one stage at a time

```bash
connectio-segmentation-stage over-segmentation configs/03_over_segmentation.json
connectio-segmentation-stage agglomeration configs/04_agglomeration.json
connectio-segmentation-stage lut configs/05_lut.json
connectio-segmentation-stage segmentation configs/06_segmentation.json
```

Wait for, inspect, and approve each stage before issuing the next command. Over-segmentation creates fragments from the accepted affinities. Compare fragment boundaries to raw and inspect block borders. Agglomeration scores edges in a persistent region-adjacency graph. LUT generation uses that graph to map fragments to merged components at threshold candidates. The standard final stage materializes a label volume for a selected `threshold`. Its output is a new data product, not a replacement for fragments.

Over-segmentation, agglomeration, and LUT generation each start a stage-local MongoDB process and stop it after that stage. Persist the files by using the **same** `db_name` and `_connectio.mongodb_dir`; do not run two stages simultaneously against that directory. `edges_collection` must agree with the merge function, for example `hist_quant_75` and `edges_hist_quant_75` in the supplied examples. Losing the database files cannot be fixed by retaining only the final JSON status files.

Threshold choice is a scientific decision. Review representative crops at several LUT thresholds, checking both false merges and false splits. Save the chosen threshold, merge function, region reviewed, and reviewer note with the run. If an affinity or model changes, regenerate downstream fragments and graph products under new paths instead of reusing an old LUT.

## Status, failure, and validation

Every stage writes `<run_dir>/<stage>/status.json` with `RUNNING`, `COMPLETED`, or `FAILED`. The Slurm job directory separately contains stdout and stderr logs. A failure may leave partial datasets or graph state; inspect the error and existing output before retrying. `--no-slurm` is for a process already inside a Slurm allocation, not for heavy work on a login node. If the legacy Funke stack or `mongod` is unavailable, install or expose it in the segmentation environment before post-processing.

For quantitative comparison, use ground truth and result datasets whose world-coordinate extents overlap:

```bash
connectio-lsd-evaluate GT.zarr volumes/labels/neuron_ids \
  RESULT.zarr volumes/segmentation --output evaluation.json
```

Evaluation intersects using Zarr `offset` and `resolution` and reports VOI and Rand measures. Metrics do not replace visual review: inspect missing labels, unusually large components, seams, and anatomical plausibility. The [digspider case study]({{ "/en/case-study/" | relative_url }}) documents why a plausible completion status can still hide a supervision error.

## Input identity and coordinate validation

Raw training and inference share dtype-aware normalization: `uint8` uses 255, `uint16` uses 65535, and floating raw must be finite and in `[0, 1]`; all become `[-1, 1]`. Inputs must remain unchanged while inference runs. Output arrays record their channel/spatial axes as well as physical metadata. Raw without axis metadata retains the historical XYZ convention; set `axes` in the inference JSON to declare another stored order. This declares axes and does not transpose pixels.

Resume is bound to a SHA-256 checkpoint hash, scientific configuration, raw dataset, geometry, and (for ACRLSD) the upstream LSD dataset. Local input revisions are detected from metadata and chunk-file sizes, modification times, and change times; this is not a content hash of the whole volume. It requires local directory-backed Zarr and scans file metadata at startup. A copied or edited input can require a new output even when its pixels are equal. Completion records are scoped per output dataset, MongoDB records are mirrored locally, and a lock allows only one writer to that dataset. A changed signature, unsigned legacy output/state, or missing output with completed records is rejected: choose a **new output path**. Do not delete state files to force reuse. Existing legacy results remain available for review/export but cannot be automatically resumed with this version.

Evaluation keeps floating-point `resolution` and `offset`, so values such as `7.8125` nm and `0.5` nm are not truncated. Both label arrays must be 3-D, have the same spatial axis order and units, equal positive finite voxel sizes, and offsets on a shared voxel grid. It compares integer voxel indices with a grid-alignment tolerance of `1e-6` voxels. It does not resample or transpose inputs. The report includes the axes and units of the shared physical ROI. Legacy metadata without units is interpreted as nm.

Declare axes using `axes` or `_ARRAY_DIMENSIONS`. If a legacy input has neither, explicitly supply its actual stored order:

```bash
connectio-lsd-evaluate GT.zarr volumes/labels/neuron_ids \
  RESULT.zarr volumes/segmentation \
  --gt-axes xyz --seg-axes xyz --output evaluation.json
```

Use `zyx` instead when that is the actual order. Contradictory declarations are rejected; convert mismatched inputs before evaluation. Missing `resolution`, invalid geometry, differing units, or fractional-voxel shifts cause an error rather than a silently rounded score.
