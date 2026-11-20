---
layout: default
title: Memory and recovery
lang: en
permalink: /en/optimization/
---

# When a job runs out of memory or stops halfway

First identify which step stopped. A smaller inference tile, fewer prefetched blocks and a larger evaluation scratch disk solve different problems. Keep the job log and config so you can compare the next run on the same region.

## Resume training from a checkpoint

LSD/ACRLSD and Synful training saves include optimizer state, RNG state, the next sample index and the training input/config identity. Synful also saves its mixed-precision scaler. Use `--resume` to continue that run. For exported weights or a historical checkpoint lacking this state, initialize in a fresh output directory:

```bash
connectio-lsd-train lsd --config train.json --iterations 100 --init-checkpoint legacy.pt
connectio-synful train --config synful.json --steps 100 --init-checkpoint legacy.pt
```

Keep the raw, labels, masks and split geometry fixed during training. `deterministic: true` requests deterministic Torch operations. A change in hardware or software can still affect reproducibility.

## Keep resampling within host memory

```python
from connectio.processing import resample_zarr

job = resample_zarr(
    "volume.zarr", "volumes/raw", scale_factors=(0.5, 0.5, 1.0),
    output_dataset_name="volumes/raw_half", output_block_shape=(64, 64, 32),
    num_workers=2, max_pending=2, memory_mb=256,
)
```

`memory_mb` controls the estimated working buffers (default 256 MiB). `output_block_shape`, `num_workers` and `max_pending` control the size and number of blocks in flight. Leave headroom for codec caches and the interpreter. For labels, use `interpolation="nearest"` to preserve integer IDs, including uint64. The new dataset is written before publication. An interrupted replacement can be recovered from the journal on the next invocation.

## Evaluate large label volumes

```bash
connectio-lsd-evaluate GT.zarr labels RESULT.zarr segmentation \
  --gt-axes xyz --seg-axes xyz --memory-mb 128 \
  --temporary-dir /tmp --output evaluation.json
```

Evaluation accumulates label-pair counts on a temporary filesystem. Point `--temporary-dir` to a volume with room for the SQLite counts. The output reports the effective block shape and memory budget. VOI and Rand use nonzero GT voxels. Labels must be nonnegative integers, with axes, spacing and origins on a common grid.

## Tune blockwise inference

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

Set these keys at the top level of LSD/ACRLSD inference JSON, or inside Synful's `inference` section. Under host memory pressure reduce prefetch and write queues: their limits count blocks or batches. Under GPU memory pressure start with `batch_size: 1` and a valid tile for the network. For several GPUs in one process use distinct visible devices such as `["cuda:0", "cuda:1"]`. The coordinator owns a single writer.

To measure a change, compare processed blocks and elapsed time on the same ROI. `inference_performance` includes overlapping read/compute/write times. LSD accepts `--profile timing.json` and Synful accepts `inference.profile_file`. For CUDA mixed precision set `amp: true` and `amp_dtype` to `float16` or `bfloat16`. Compare predictions and instance merges against full precision in a separate output.

## Recover a partial prediction

Synful records the raw dataset revision, checkpoint, config, geometry and the completed probability/vector chunks. Directory-backed Zarr revisions use file metadata. HDF5 also uses the file size and timestamps. Copying or editing the input can change its identity. Repeat the command against the original input to resume. If a completed chunk is missing or incompatible, keep the old result for inspection and start in a fresh output directory. See [migration notes]({{ "/en/audit/" | relative_url }}) for older completion records.
