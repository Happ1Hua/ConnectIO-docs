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

The defaults are kept in `connectio/site_config.py`. Set
`CONNECTIO_CPU_PARTITION`, `CONNECTIO_GPU_PARTITION`, or `CONNECTIO_CONDA_SH`
to adapt submissions to another cluster. `CONNECTIO_CONVERSION_ENV` and
`CONNECTIO_SEGMENTATION_ENV` select the environments used by conversion and
segmentation stages; the existing `CONNECTIO_CPU_ENV` and `CONNECTIO_GPU_ENV`
remain fallback aliases. `CONNECTIO_MONGOD` selects the segmentation service
binary. Explicit `slurm_options` and `_connectio.mongod` stage settings take
precedence. Site-specific standalone Slurm scripts have their own defaults.

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

## Submission, execution, and results

A decorated Python call normally returns a `SlurmJob` immediately. It serializes an importable function and its arguments, submits one `sbatch` job, and runs the function on the compute node. While inside a Slurm allocation, the same decorated call executes directly to avoid nested submission. Console commands print the submitted job ID and log directory instead of returning a Python handle.

```python
job = tiff_stack_to_zarr(
    "tiffs", "raw.zarr", dataset_name="volumes/raw",
    resolution=(8, 8, 8),
)
print(job.job_id, job.directory)
print(job.status())
result = job.result(timeout=3600)
```

`status()` consults the worker's status file and Slurm accounting. `result(timeout=...)` waits and returns the serialized Python result, raises on a failed job, or times out while the job continues to run. `cancel()` calls `scancel` on that job. Calling `result()` on a void-returning function returns `None` after success; the generated data remains at the path passed to the function.

By default the job directory is `<cwd>/.connectio_slurm/<function>-<id>/`. It contains `payload.pkl`, `job.sh`, `submission.json`, `job.json`, `status.json`, `stdout.log`, `stderr.log`, and, on success, `result.pkl`. A failed submission also writes `submission_error.json`; a worker failure records an error and traceback in `status.json`. The pickle files are only for trusted local code. Check the logs and stage-specific status before deciding whether to retry.

## Resource and environment options

Set `slurm_options` on a Python API call or pass JSON through the CLI:

```bash
connectio-tiff-check --input tiffs --output qc \
  --slurm-options '{"partition":"C64M512G","time":"04:00:00","mem":"80G","job_dir":"jobs"}'
```

`partition`, `time`, `cpus_per_task`, `mem`, `gpus`, `job_name`, `dependency`, and other supported `sbatch` flags are forwarded. `job_dir` chooses where ConnectIO writes the payload, logs, and status. `cwd` sets the compute job's working directory; `conda_env` and `conda_sh` select activation, or `python_executable` chooses an interpreter without Conda activation. `env` is a mapping of environment variable names to values. These special fields are removed before generating `sbatch` flags.

Resource alternatives such as `mem_per_cpu` remove the default `mem` flag unless you explicitly provide `mem`. Likewise, `gres`, `gpus_per_node`, or `gpus_per_task` remove the default `gpus` flag; `cpus_per_gpu` can replace `cpus_per_task`. Use the site's actual partition and allocation limits. Importable functions and shared filesystem paths are required on the compute node.

## Dependencies and local execution

Slurm dependencies can be passed as an option, for example `"dependency":"afterok:JOB_ID"` after replacing `JOB_ID` with a real submitted job number. Use dependencies for mechanical prerequisites. The segmentation workflow deliberately stops at review gates, so a dependency should not silently authorize a downstream scientific stage.

`--no-slurm` and Python `slurm=False` run the work in the current process. Use them only after acquiring the intended compute allocation. `--help` stays local; `connectio-segmentation-stage --dry-run` prints its plan without submitting. A Neuroglancer viewer has a separate interactive launcher and ends its own Slurm job when the launcher exits; see [modules and tutorials]({{ "/en/modules/" | relative_url }}).
