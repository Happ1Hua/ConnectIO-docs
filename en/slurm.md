---
layout: default
title: Local and Slurm execution
lang: en
permalink: /en/slurm/
---

# Local and Slurm execution

Compute entry points accept `backend="local"` or `backend="slurm"`; `slurm=False/True` remains supported. With neither specified, calls inherit the enclosing execution context or `CONNECTIO_EXECUTION_BACKEND`, falling back to Slurm. Slurm mode executes directly inside an allocation to avoid nested submissions. Submission failures never fall back to local computation.

## Deployment without a cluster

Install the dependencies for your workflows in a Linux workstation environment and select local execution once:

```bash
pip install -e .
# Select the extras needed for your workflows, for example:
pip install -e '.[segmentation,mito-pytorch,synful-pytorch]'
export CONNECTIO_EXECUTION_BACKEND=local

connectio-lsd-predict /data/inference.json --device cuda
connectio-mito predict --config /data/mito.json --device cuda
connectio-synful predict --config /data/synful.json --device cuda
```

Local execution needs neither `sbatch`, an allocation, nor cluster-specific Conda paths. It uses the current interpreter, waits for completion, and propagates exceptions. CUDA execution still needs a working PyTorch/CUDA environment; choose `--device cpu` for CPU execution. `slurm_options` has no effect locally and imposes no resource limits. Configure worker counts, threads, batches, and memory budgets through the workflow's own settings.

Use `--backend local` (alias `--no-slurm`) or `--backend slurm` (alias `--slurm`) to override the environment for one call. Python has the same selection:

```python
from connectio.processing import crop_zarr
crop_zarr('raw.zarr', 'crop.zarr', dataset_path='volumes/raw',
          crop_bbox_xyz=((0, 64), (0, 64), (0, 64)), backend='local')
```

Local calls return the result directly, without a `SlurmJob` or a `.result()` step. `slurm=None` means inherit the selection. Conflicting `backend` and `slurm` arguments raise an error.

## Workflow coverage and internal workers

Conversion, preprocessing, alignment, LSD training/prediction/evaluation, Mito, Synful, model configuration/preflight, segmentation stages, and viewer launchers support backend selection. Mito and Synful CLIs now use the common default too; add `--no-slurm` or select global local execution for previously synchronous scripts.

```bash
connectio-segmentation-stage over-segmentation configs/03.json --backend local
connectio-segmentation-stage agglomeration configs/04.json --backend local
connectio-segmentation-stage lut configs/05.json --backend local
connectio-segmentation-stage segmentation configs/06.json --backend local
```

Finish and review each stage before starting the next. Local stages also write `<run_dir>/<stage>/status.json`, including `backend`, nullable `job_id`, and completion/failure state. An affinity stage config can select `"device":"cpu"`; its default remains `cuda`.

Funke post-processing requires the legacy Daisy, lsds, waterz, and funlib stack described in `requirements-segmentation.txt`, plus MongoDB. Installing an extra does not install those legacy dependencies or the MongoDB executable. Set `CONNECTIO_MONGOD=/path/to/mongod` or put `mongod` on PATH; `_connectio.mongod` takes precedence. Reuse `db_name` and `_connectio.mongodb_dir` across consecutive stages.

Fragment and agglomeration workers inherit the stage backend. Local workers use the current Python interpreter and inherit the Daisy context; `num_workers` controls concurrency and `queue` is ignored locally. Slurm workers use the common submitter: `queue` chooses their partition and `_connectio.worker_slurm_options` overrides resources, interpreter, or Conda environment. Set `_connectio.worker_backend="local"` to keep workers within one allocation; Daisy and MongoDB then use local addresses. Worker logs remain in `.extract_fragments_blockwise/` and `.agglomerate_blockwise/`.

`connectio-view --backend local --viewer-type zarr --zarr-path /data/raw.zarr --datasets volumes/raw` starts a viewer from the installed package. In Slurm mode, `--login-host` and `--local-port` enable SSH tunnel instructions. Interactive `launch_neuroglancer` follows logs and cancels its job on exit; `wait=False` returns a `SlurmJob` for caller management. Low-level `view_*` functions still create local viewer objects directly.

Undecorated Python functions can use `connectio.execution.run_function(module, function, args=(), kwargs=None, backend=..., resource="cpu")`. Its generic CLI is `connectio-run module:function --args '[]' --kwargs '{}' --backend local`, also available as `python -m connectio.execution`. Historical repository scripts named `submit_*.sh` or ending in `.slurm` remain Slurm-specific; use the Python/CLI entry points above for local deployment.

## Slurm default resources

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

CLI programs expose `--slurm-options '{...}'`. `--no-slurm` works on a standalone workstation or within an allocation. Help and dry-run operations stay local.

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

`--no-slurm` and Python `slurm=False` run the work in the current process. Workstations need no allocation; on a cluster, follow the site's compute-node policy. `--help` stays local; `connectio-segmentation-stage --dry-run` prints the selected backend and plan without submitting. See [modules and tutorials]({{ "/en/modules/" | relative_url }}).


## Zarr2 / Zarr3 (26.10.28)

Volume I/O supports both formats. New outputs remain Zarr2 by default; select `zarr_format=3`, `--zarr-format 3`, or a model config with `"zarr_format": 3` for new Zarr3 stores. See [format coverage, coordinates and validation]({{ "/en/zarr/" | relative_url }}).

From 26.11.02, distributed Funke workers require an authenticated external MongoDB through `_connectio.mongodb_uri`, `CONNECTIO_MONGODB_URI`, or credential-bearing `db_host`. Automatic MongoDB is loopback-only for local workers. See [migration notes]({{ "/en/audit/" | relative_url }}).
