---
layout: default
title: Slurm execution
lang: en
permalink: /en/slurm/
---

# Slurm execution

Public compute functions accept keyword-only `slurm=True` and `slurm_options=None`. The default call submits asynchronously; inside an existing allocation it executes directly, preventing nested submissions.

| Setting | CPU default | GPU default |
|---|---|---|
| Partition | `C64M512G` | `GPUA800` |
| CPUs | 8 | 7 |
| Memory | 60G | partition allocation |
| GPUs | none | 1 |
| Conda | `data_format_convert` | `lsd_pytorch` |
| Time | 24 hours | 24 hours |

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    "/data/tiffs", "/data/raw.zarr",
    output_dataset_path="volumes/raw",
    slurm_options={
        "partition": "C64M512G",
        "cpus_per_task": 8,
        "mem": "60G",
        "time": "04:00:00",
        "job_name": "convert-sample",
    },
)
```

Options use Python underscores or Slurm hyphens. `account`, `qos`, `constraint`, `nodelist`, `exclude`, `reservation`, dependencies, and mail options pass through. `conda_env`, `conda_sh`, `python_executable`, `cwd`, `job_dir`, and `env` control the runtime. Alternative resource forms such as `mem_per_cpu`, `mem_per_gpu`, `gres`, `gpus_per_node`, `gpus_per_task`, and `cpus_per_gpu` suppress conflicting defaults.

Every job directory stores the payload, generated script, submission record, state, logs, and serialized result. Arguments and results use private pickle files and must come from trusted local code. Large arrays should remain in shared storage and be passed by path.

CLI programs expose `--slurm-options '{...}'`. `--no-slurm` is for an allocated compute node only. Help and dry-run operations stay local. Neuroglancer launchers and existing site-specific Slurm scripts keep their own submission behavior.
