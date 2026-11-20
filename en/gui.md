---
layout: default
title: GUI workbench
lang: en
permalink: /en/gui/
---

# Submit a job from the browser

Choose a writable workspace on storage shared with the compute nodes. You can edit a plan and save a draft as soon as the workbench starts. Submitting a job requires the Slurm client on the host running the service.

## Connect to the workbench

Run this on the service host, substituting your workspace for `/path/to/project`. If the command is missing, follow the [installation instructions]({{ "/en/getting-started/" | relative_url }}) for the GUI checkout. The equivalent module entry point is `python -m connectio.gui`.

```bash
connectio-gui --workspace /path/to/project --port 8765
```

In another terminal **on your computer**, forward the port to the host where you started the GUI. Replace `USER@GUI_HOST` with your login and that hostname. Leave the tunnel open.

```bash
ssh -N -L 8765:127.0.0.1:8765 USER@GUI_HOST
```

Open the complete `Open:` URL printed by the service, including `#token=…`. Keep that URL private. It grants job submission and cancellation under your account. A restart prints a new link. The language switch in the upper right keeps your form entries.

## Try the four-slice example

1. Choose **New run → Load PNG example**. The form fills in the input, a fresh output path and CPU resources.
2. Select **Check plan**, check the partition, Conda environment and account, then select **Submit job**. The job ID appears in **Run history**. Set `CONNECTIO_CPU_PARTITION` before starting the GUI if your site uses a different partition.
3. Once the job is **Completed**, open **Results and viewer**. Find the output Zarr and its `volumes/raw` array. Expect 32 × 32 × 4 grayscale voxels in XYZ order. To use your own slices, change the input directory, output path, voxel size and origin.

## Choose a workflow

| Family | Operations |
| --- | --- |
| TIFF preprocessing | quality check, normalization, CLAHE pilot/apply, slice alignment |
| Volume processing | crop, rotate, resample/downsample/upsample, merge NML, WEBKNOSSOS magnifications |
| Conversion | TIFF stack/3D/hyperstack, PNG, TXM, HDF5, WKW, Precomputed, WEBKNOSSOS Zarr3 |
| Mito | inspect, prepare, predict, segment, restore, run |
| Neuron segmentation (LSD/ACRLSD) | inspect, predict |
| Synful | inspect, predict, extract, run |
| Viewer | Zarr Neuroglancer via connectio-view |
| Advanced workflows → Pipeline stages | precomputed, alignment, affinity, over-segmentation, agglomeration, lut, segmentation, webknossos-downsample |

All three models default to GPU for `predict`, as do Mito and Synful for `run`. CPU is also available. Inspection, data preparation, standalone postprocessing, viewers and stages in the advanced menu use CPU. The GUI defaults to `data_format_convert` for conversion and `lsd_env_py10` for models. Edit the environment in the form or set `CONNECTIO_CONVERSION_ENV` and `CONNECTIO_SEGMENTATION_ENV` before startup.

For TIFF input, normalization and CLAHE place the next stack in `output_folder/tiffs`. Alignment writes directly into its output directory. Open PNG, CSV and JSON reports under **Results and viewer** after each preprocessing job. Files up to 16 MiB can be previewed there. For a worked sequence, see [prepare a TIFF stack]({{ "/en/modules/" | relative_url }}).

If you already have affinities, go to **Advanced workflows → Pipeline stages**, extract fragments, then use the merge graph and a threshold lookup table to produce instance labels. Each submission runs one stage. Check its required inputs in [neuron segmentation stages]({{ "/en/pipeline/" | relative_url }}).

## Use your own data

- **Paths.** Start from a template or import JSON. LSD, Mito and stage paths resolve from the source config directory. Synful defaults to the workspace. `volumes/raw` identifies the array inside the store. Plain Synful Zarr input, voxel size and origin must all follow ZYX order, with physical values in nm.
- **Output.** Conversion and crop templates default to Zarr3. Select 2 or 3 for a new store. Choose a fresh output path. Rotation and resampling create a new array in the existing store. Crop bounds are XYZ voxel intervals with exclusive upper ends. Use `nearest` when resampling labels.
- **Checks.** The plan checks paths, basic fields and resource requests. Submit an `inspect` job to check model and data geometry, then predict a small region. A Mito `run` allocation needs enough host memory for watershed as well as resources for GPU prediction.
- **Viewing.** Start a viewer job, run the viewer tunnel command on your computer and open `LOCAL_URL`. The viewer needs its own tunnel alongside the GUI tunnel. Cancel the viewer in **Run history** when finished. Closing the browser leaves Slurm jobs running.

## Get a completion email

Under **Check and submit → Set up a sender account (SMTP)**, enter the sender address, SMTP host, port, encryption and app password. Select **Verify and save**. The username defaults to the sender address. Enter credentials through your own SSH-forwarded session. The workbench stores them in plaintext in `smtp.conf`, mode `0600`, in its state directory.

Fill in **Completion email (optional)** and select **Send test email**. Check the receiving inbox. New jobs use your configured SMTP account, or Slurm mail if no account is set. Leave the recipient empty to skip mail for this run. To switch an existing draft to SMTP, copy it and recheck the plan. Keep the service running or restart in the same workspace to process pending mail. The browser can close. History records SMTP acceptance or an error. If delivery was interrupted, check the inbox before retrying.

## Find or recover a run

The workspace's `.connectio_gui/` directory holds drafts, config snapshots, job records and review notes. Override it with `--state-dir`. Keep versions of the original data and checkpoints alongside your records. History shows the last 64 KiB of logs and lets you download configs, copy a run and record a review decision.

If a submission shows `SUBMISSION_UNKNOWN`, refresh the record and look for `connectio-gui-<first eight run-ID characters>` in `squeue` or `sacct` before starting another job. History covers jobs submitted through this workspace. Submit LSD and Synful training from the command line and use the training directory for progress, loss and checkpoints.
