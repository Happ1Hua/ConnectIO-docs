---
layout: default
title: Local and Slurm execution
lang: en
permalink: /en/slurm/
---

# Run locally or submit to Slurm

On a workstation set `export CONNECTIO_EXECUTION_BACKEND=local`. A local function runs synchronously using the current interpreter and returns its result. On a cluster, the default backend submits an `sbatch` job when called outside an allocation. Inside an allocation the work runs there. A failed submission reports the error.

Override the choice for one command with `--backend local` or `--backend slurm`, or in Python with `backend="local"` or `backend="slurm"`. Existing `--no-slurm` and `slurm=False` calls select local execution. The browser workbench submits through Slurm.

## Request resources

These are the command-line defaults shipped with ConnectIO. Set site values before submitting.

| Setting | CPU default | GPU default |
|---|---|---|
| Partition | `C64M512G` | `GPUA800` |
| CPUs | 8 | 7 |
| Memory | 60G | partition allocation |
| GPUs | none | 1 |
| Conda | `data_format_convert` | `lsd_pytorch` |
| Time | 24 hours | 24 hours |

Set `CONNECTIO_CPU_PARTITION` and `CONNECTIO_GPU_PARTITION` for queue names. `CONNECTIO_CONDA_SH` sets the activation script. `CONNECTIO_CONVERSION_ENV` and `CONNECTIO_SEGMENTATION_ENV` select software environments (`CONNECTIO_CPU_ENV` and `CONNECTIO_GPU_ENV` are fallback names). For a single job, pass `slurm_options` in Python or `--slurm-options` with a JSON object at the CLI.

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    "aligned", "raw.zarr", dataset_name="volumes/raw", resolution=(8, 8, 8),
    backend="slurm", slurm_options={"time": "04:00:00", "mem": "60G"},
)
print(job.job_id, job.directory)
```

`partition`, `account`, `qos`, `time`, `mem` and `gpus` become scheduler options. Alternative requests such as `mem_per_cpu`, `gpus_per_node` and `cpus_per_gpu` replace conflicting defaults. Use `job_dir` for logs, `cwd` for the working directory and `conda_env` or `python_executable` for a specific runtime. Paths must be accessible from the compute node.

## Find a result or diagnose a failure

`job.status()` queries the job. `job.result(timeout=3600)` waits for a return value or raises the worker's error. A timeout leaves the job running. `job.cancel()` invokes `scancel`. A converter that returns `None` writes its output to the path in your call.

Open the printed job directory and inspect `stderr.log`, `stdout.log` and `status.json`. Submission errors are recorded in `submission_error.json`. A segmentation stage also records `<run_dir>/<stage>/status.json`. Payloads and results are pickles for use with trusted code. Pass large arrays by shared path.

## Configure Funke workers

The fragment and agglomeration stages use the legacy packages listed in `requirements-segmentation.txt`. Use `_connectio.worker_backend="local"` to keep the workers within an allocation and `num_workers` to set concurrency. For automatic loopback MongoDB, place `mongod` on PATH or set `CONNECTIO_MONGOD`. The config's `_connectio.mongod` overrides both.

Distributed workers require an authenticated external database reachable from the nodes (`_connectio.mongodb_uri` or `CONNECTIO_MONGODB_URI`). Use `queue` and `_connectio.worker_slurm_options` for worker allocations. Keep the same `db_name` and persistent state across dependent stages. Worker logs are in `.extract_fragments_blockwise/` and `.agglomerate_blockwise/`.

## Connect a viewer

The connection record includes `LOCAL_URL` and an SSH tunnel command. Some installed launchers print a single `LOCAL_TUNNEL` in the viewer job's stdout. Run that command locally and check the job ID when ending the session. For versions with the interactive launcher:

`connectio-view --backend local --viewer-type zarr --zarr-path /data/raw.zarr --datasets volumes/raw` starts a viewer from the installed package. In Slurm mode it follows logs and prints connection links directly in the terminal; `--login-host` and `--local-port` enable SSH tunnel instructions. On Windows copy `LOCAL_TUNNEL` (`ssh -F NUL -N ...`); on Linux/macOS copy `LOCAL_TUNNEL_POSIX` (`ssh -F /dev/null -N ...`). Both ignore extra forwarding rules in SSH configuration. Press Ctrl+C in the local SSH terminal to close the tunnel when finished. Interactive `connectio-view` and `launch_neuroglancer` cancel their viewer job on exit; `launch_neuroglancer(..., wait=False)` returns a `SlurmJob` for caller management. Low-level `view_*` functions still create local viewer objects directly.

For HDF5, Precomputed and synapse overlays see the [viewer tutorial scripts]({{ "/en/modules/" | relative_url }}).
