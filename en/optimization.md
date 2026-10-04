---
layout: default
title: Code optimization and resource controls
lang: en
permalink: /en/optimization/
---

# Code optimization and resource controls

The 2026-10-04 update adds six engineering improvements: supervised geometry checks, Synful input/output revision checks, bounded resampling, disk-backed evaluation, reproducible training recovery, and pipelined inference. These changes preserve the default full-precision inference mode. They do not establish a GPU speedup or replace a biological validation study.

## Training geometry and reproducible recovery

LSD/ACRLSD checks raw, labels and label masks before sampling: all arrays must be 3-D, with matching spatial axes, units, finite positive resolution and grid-aligned offsets. Label and mask geometry must agree; the supervised label ROI must fit inside raw and contain the output patch. Missing axis metadata retains historical XYZ order. Resolution metadata is required on all three arrays. `voxel_size`, when configured, must match stored raw resolution. Labels must be nonnegative integers; mask values must be finite in `[0, 1]`.

`seed` defaults to 13 for LSD/ACRLSD. `max_sampling_attempts` defaults to 1000; a mask that cannot supply a valid patch causes a clear failure instead of an unbounded sampling loop. Global sample indices determine random patches and augmentation independently of worker scheduling. `num_workers` can change across a resume without changing that sample sequence.

Checkpoints are written to a sibling temporary file, flushed and replaced. They retain optimizer state, Python/NumPy/Torch/CUDA random states, the next global sample index, and training input/configuration identity. Synful additionally retains its mixed-precision scaler. CPU regression checks compare both LSD stages and Synful against uninterrupted training. Identical results across different GPUs, library versions, or nondeterministic GPU kernels are not promised. `deterministic: true` enables Torch deterministic algorithms; an unsupported operation then raises an error rather than silently using a nondeterministic kernel.

Old checkpoints lacking the new recovery metadata can initialize a new training run, but cannot provide exact resume. Use a fresh checkpoint/output directory:

```bash
connectio-lsd-train lsd --config train.json --iterations 100 --init-checkpoint legacy.pt
connectio-synful train --config synful.json --steps 100 --init-checkpoint legacy.pt
```

`--resume` and `--init-checkpoint` are mutually exclusive. Initialization restores weights only; optimizer and sample progress start afresh. Training inputs must stay immutable throughout the run.

## Synful prediction identity

Synful now records the local raw dataset revision as well as checkpoint/configuration/geometry. Directory-backed Zarr revisions scan file metadata; HDF5 revisions use file size, modification/change times and dataset metadata. These revisions are not full-volume pixel hashes. A copied, edited or relocated input can require a fresh prediction output.

Before resuming, Synful verifies both output arrays, their geometry and dtype, and the file revisions of completed probability/vector chunks. Missing or modified chunks, arrays, stores, or incompatible legacy manifests cause an error before predictions are rewritten. Use a new `output_dir`; retain old outputs for review. Synful raw is ZYX with spatial coordinates in nm; explicit contradictory axis/unit metadata is rejected.

## Bounded volume resampling

`resample_zarr`, `downsample_zarr` and `upsample_zarr` read only the current input block and interpolation context. Interpolation uses global voxel-center coordinates, so block boundaries do not change the coordinate mapping. This differs from the old local-slab zoom alignment. Offset remains unchanged and resolution follows the requested scale; rounded output shape determines final extent.

```python
from connectio.processing import resample_zarr

job = resample_zarr(
    "volume.zarr", "volumes/raw", scale_factors=(0.5, 0.5, 1.0),
    output_dataset_name="volumes/raw_half", output_block_shape=(64, 64, 32),
    num_workers=2, max_pending=2, memory_mb=256,
)
```

`memory_mb` defaults to 256 MiB and conservatively reduces the effective block shape to fit estimated input/output working buffers and pending tasks. It is a working-buffer budget, not a hard limit on process RSS or codec caches. `out_block_slices_z` remains available. All output writes are serialized because neighboring blocks can share a compressed chunk. For categorical labels use `interpolation="nearest"`; direct integer indexing preserves uint64 IDs above `2**63`. Linear interpolation is for intensity fields.

A temporary dataset is completed before publication. Failed computation leaves the original and any existing destination intact. Replacing a nonempty directory uses a recovery journal rather than claiming a single atomic rename. The next invocation restores the original if interrupted between renames, or cleans up a successfully published replacement. Startup under the output lock removes abandoned temporary datasets. The operator should avoid readers opening an in-place destination during the brief publication interval.

## Evaluation within a memory budget

Evaluation rejects floating or negative labels and preserves unsigned 64-bit IDs. `--memory-mb` defaults to 256 MiB. The requested block shape is reduced when needed; label-pair counts flush to a temporary SQLite database and marginal counts/metrics are streamed from disk. Metrics remain VOI and Rand on nonzero GT voxels. Empty GT is rejected. The report records effective block shape, budget and counting backend.

```bash
connectio-lsd-evaluate GT.zarr labels RESULT.zarr segmentation \
  --gt-axes xyz --seg-axes xyz --memory-mb 128 \
  --temporary-dir /tmp --output evaluation.json
```

Choose a temporary filesystem with enough disk space for label-pair counts. The budget controls estimated working buffers and SQLite cache, not total process RSS. Temporary count databases are cleaned up on completion or an ordinary exception.

## Read/compute/write inference pipeline

LSD/ACRLSD JSON accepts the following optional settings; Synful uses the same keys inside `inference`:

```json
{
  "batch_size": 1,
  "read_workers": 2,
  "prefetch_blocks": 2,
  "write_queue": 2,
  "amp": false,
  "amp_dtype": "float16"
}
```

Reads and compression writes overlap model computation through bounded queues. Queue limits count blocks or batches, not bytes: large ACRLSD input tiles need substantial host RAM. Reduce prefetch/read workers/write queue or batch size when memory is limited. Changing batch size can change floating-point rounding; compare predictions and downstream segmentation metrics on representative ROIs.

To coordinate multiple GPUs in one process, set `devices` to distinct visible CUDA devices, for example `["cuda:0", "cuda:1"]`. The coordinator creates one model per GPU, dispatches batches through a bounded compute pool, and uses one writer. Independent processes targeting the same output remain rejected by its ownership lock. Duplicate aliases such as `cuda` and `cuda:0` are rejected when they resolve to the same GPU.

Mixed precision is opt-in and requires CUDA: `amp: true` with `amp_dtype: "float16"` or `"bfloat16"`. It can change numerical outputs and must be assessed against full precision on the target GPU. Changes to inference configuration require a new signed output path.

Both engines store `inference_performance` with processed blocks, batches, elapsed time and aggregate read/compute/write seconds. LSD can also save a JSON report with `--profile timing.json`; Synful accepts `inference.profile_file`. Stage times overlap and can exceed wall time when added. Compare blocks/second, host peak memory, GPU memory, prediction differences and downstream accuracy before selecting production settings. CPU tests verify queue bounds, overlap, failure behavior, concurrent compute dispatch and batched predictions; actual CUDA/multi-GPU throughput has not been benchmarked in this update.
