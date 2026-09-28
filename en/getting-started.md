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

Synful partner detection uses the separate `synful-pytorch` extra and `connectio-synful` command. See the [detailed Synful PyTorch guide]({{ "/en/synful/" | relative_url }}) for the branch to install, input requirements, configuration, commands, and coordinate checks. Synful compute commands run in the current process, so allocate compute resources before training or full-volume inference.

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

## Before the first run

Start in a checkout of the [ConnectIO integration branch](https://github.com/Happ1Hua/ConnectIO/tree/codex/synful-pytorch-integration) while its additions are under review. Check that the selected environment can import ConnectIO and that the commands expose their expected arguments:

```bash
python -m pip show connectio
connectio-segmentation-stage --help
connectio-align --help
connectio-tiff-check --help
```

The commands use the same installed source tree, but their dependencies differ. Conversion and alignment need the preprocessing stack. LSD inference needs PyTorch and the model checkpoint. Funke post-processing additionally needs the legacy packages and a usable `mongod` executable. [Synful]({{ "/en/synful/" | relative_url }}) has a separate training and prediction workflow.

For a new LSD run, copy the matching JSON examples from `connectio/segmentation/configs/stages/` into your run's `configs/` directory. Edit the real input/output paths, dataset keys, checkpoint locations, voxel metadata, and Slurm resources. The sample `/shared/data/...` paths are placeholders. Paths in stage JSON are resolved relative to that JSON; `--dry-run` checks the stage name and config-file path and prints a submission plan, but does not verify every dataset or model weight. The compute job validates those when it starts.

## A first reviewable stage

For example, run only affinity prediction after raw and checkpoint inputs are ready:

```bash
connectio-segmentation-stage affinity configs/02_affinity.json --dry-run
connectio-segmentation-stage affinity configs/02_affinity.json \
  --slurm-options '{"time":"12:00:00","gpus":1}'
```

The second command submits and returns. Find the job ID and log directory in its output. The stage status is in `<run_dir>/affinity/status.json`, where `<run_dir>` comes from `_connectio.run_dir` or the generated default beside the config. Wait for `COMPLETED`, inspect the output Zarr in a viewer, and record the review before submitting the next stage. See the [stage-by-stage pipeline]({{ "/en/pipeline/" | relative_url }}) and [Slurm guide]({{ "/en/slurm/" | relative_url }}) for the rest of the sequence.

## Choosing a starting point

You do not need to rerun conversion or alignment when a suitable raw Zarr already exists. You can start at affinity with raw and compatible checkpoints, or at a later stage when its required affinities, fragments, lookup tables, and persistent graph state already exist. A new `run_dir` stores new status files; it does not recreate missing scientific inputs. Do not point independent runs at the same output dataset or MongoDB database directory while jobs are active.

If a stage fails, inspect both its `status.json` and the Slurm `stderr.log` before editing the configuration. Re-run the same stage only after confirming whether partial output can be resumed; use a new output path for a scientifically different run. The workflow does not automatically advance to the next stage.
