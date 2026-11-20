---
layout: default
title: Weights and inference configs
lang: en
permalink: /en/models/
---

# Match a checkpoint to the raw volume

For pretrained inference you need the raw array and the matching checkpoint. A ground-truth mask is only needed for supervised work. The `mito-joint` checkpoint ships in `connectio/mito_segmentation/models/joint/`. For LSD and Synful, use the corresponding local bundle or download the pinned files below.

| `--bundle` | Local files | Iteration/step |
| --- | --- | --- |
| `spider` | `spider/lsd_450000.pt` + `spider/acrlsd_230000.pt` | 450,000 / 230,000 |
| `digspider` | `digspider/lsd_20000.pt` + `digspider/acrlsd_5000.pt` | 20,000 / 5,000 |
| `multidataset` | `multidataset/lsd_400000.pt` + `multidataset/acrlsd_200000.pt` | 400,000 / 200,000 |
| `synful-e1sp5d3` | `e1sp5d3/paired_600000.pt` | 600,000 |

## Obtain LSD or Synful weights

Use an account with access to the relevant model repository. Run the download and checksum commands for the model you need. If you already have the files locally, start at configuration.

```bash
export HF_ENDPOINT=https://huggingface.co
hf auth login
hf download happyhua1/ConnectIO-LSD --revision 198285c3fa854981ffda10d314cafc347eb0a295 --local-dir checkpoints/lsd
hf download happyhua1/ConnectIO-Synful --revision 14f3f7eff804d1d63c53e988e5f08e585cc199b1 --local-dir checkpoints/synful
(cd checkpoints/lsd && sha256sum -c SHA256SUMS)
(cd checkpoints/synful && sha256sum -c SHA256SUMS)
```

The manifest's `upload_sha256` identifies the distributed file. The original converted-from weight may have a different hash. These exports support inference and weights-only initialization (`--init-checkpoint`). For `--resume` you need a training checkpoint containing optimizer and sampler state.

## Generate and inspect a configuration

Run these examples in a CPU allocation or on a workstation with `export CONNECTIO_EXECUTION_BACKEND=local`. On Slurm with the default backend, wait for each job before running a command that reads its output. Choose fresh result and config directories. For the Spider pair supply an XYZ raw array with 8 nm spacing and a physical origin.

```bash
connectio-models configure --bundle spider \
  --checkpoint-dir checkpoints/lsd --raw /path/to/raw.zarr \
  --output results/spider --config-dir runs/spider
connectio-models inspect runs/spider/lsd.json
connectio-models inspect runs/spider/acrlsd.json --allow-pending-lsd
```

The output directory `runs/spider/` contains both model configs and `affinity.json`. Before LSD has run, `--allow-pending-lsd` checks the planned connection. Repeat the ACRLSD inspection without that flag after the descriptors exist. Continue with [affinity prediction and fragment merging]({{ "/en/lsd-guide/" | relative_url }}).

For a paired Synful checkpoint, supply ZYX raw with nanometre coordinates:

```bash
connectio-models configure --bundle synful-e1sp5d3 \
  --checkpoint-dir checkpoints/synful --raw /path/to/raw.zarr \
  --output results/synful --config-dir runs/synful
connectio-synful inspect --config runs/synful/synful.json --inference-only
```

Inspection reads the weights, checks architecture and tile geometry, and samples up to 32³ raw voxels. Save the reported checkpoint SHA-256. A full ROI prediction is the next check for memory and output quality. `output_resume_checked=false` means inspection left existing prediction state unchecked.

ConnectIO reads `model_kwargs` (LSD) or `model` (Synful) from checkpoints that contain the architecture. Older weights need an explicit matching config. Keep Synful's vector scale (`d_scale`) with its paired weights. See [Synful prediction and export]({{ "/en/synful/" | relative_url }}) or [the bundled Mito model]({{ "/en/mito/" | relative_url }}) for the next commands.
