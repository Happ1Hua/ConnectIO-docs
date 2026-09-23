---
layout: default
title: Install and start
lang: en
permalink: /en/getting-started/
---

# Install and start

## Environments

The cluster workflow uses two Conda environments:

| Work | Environment | Default partition |
|---|---|---|
| Conversion, preprocessing, alignment | `data_format_convert` | `C64M512G` |
| Training, inference, segmentation | `lsd_pytorch` | `GPUA800` for GPU work; `C64M512G` for CPU post-processing |

Install the source package in each environment that needs it:

```bash
conda activate data_format_convert
pip install -e .

conda activate lsd_pytorch
pip install -r requirements-segmentation.txt
pip install -e . --no-deps
```

The segmentation extra is also available as `pip install -e ".[segmentation]"`. The legacy Funke post-processing stack (`lsds 0.1`, `waterz 0.9.6`, `daisy 0.2`, `funlib.segment 0.1`, `funlib.persistence 0.1.0`) must be installed in the segmentation environment. On the current cluster, `connectio/segmentation/scripts/activate_env.sh` exposes the verified legacy packages.

## First stage submission

Copy a JSON from `connectio/segmentation/configs/stages/`, edit its data paths, then validate the plan:

```bash
connectio-segmentation-stage affinity my_run/02_affinity.json --dry-run
connectio-segmentation-stage affinity my_run/02_affinity.json
```

The command prints a job ID and log directory. It submits one stage and returns immediately. Inspect `status.json`, Slurm logs, the generated Zarr dataset, and the Neuroglancer view before starting the next stage.

## Python API

```python
from connectio.segmentation import submit_stage

job = submit_stage(
    "affinity",
    "my_run/02_affinity.json",
    slurm_options={"time": "48:00:00", "gpus": 1},
)
print(job.job_id, job.stdout, job.stderr)
```

Use `job.status()`, `job.result(timeout=...)`, or `job.cancel()` when programmatic control is needed. `slurm=False` is only accepted for work already running inside a Slurm allocation.
