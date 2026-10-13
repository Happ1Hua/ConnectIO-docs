---
layout: default
title: Model configuration and preflight
lang: en
permalink: /en/models/
---

# Model configuration and GT-free inference preflight

ConnectIO 26.10.13 generates inference configs from local checkpoints and checks model parameters, tile geometry and coordinates without ground truth (GT). Update your installation to obtain `connectio-models`, or use `python -m connectio.models` instead.

Update the installation from the source directory, using a PyTorch build compatible with the compute environment:

```bash
python -m pip install -e '.[lsd-pytorch,synful-pytorch]'
```

The model repositories are currently **private, not publicly released**: [ConnectIO-LSD](https://huggingface.co/happyhua1/ConnectIO-LSD) and [ConnectIO-Synful](https://huggingface.co/happyhua1/ConnectIO-Synful). Downloads require an authorized account. Local configuration and inspection make no network requests and do not change repository visibility. Existing local weights work without a Hub login. Access instructions will be updated when the weights become public.

## Inference configs for each bundle

| `--bundle` | Local files | Iteration/step |
| --- | --- | --- |
| `spider` | `spider/lsd_450000.pt` + `spider/acrlsd_230000.pt` | 450,000 / 230,000 |
| `digspider` | `digspider/lsd_20000.pt` + `digspider/acrlsd_5000.pt` | 20,000 / 5,000 |
| `multidataset` | `multidataset/lsd_400000.pt` + `multidataset/acrlsd_200000.pt` | 400,000 / 200,000 |
| `synful-e1sp5d3` | `e1sp5d3/paired_600000.pt` | 600,000 |

These counters are not epochs or validation rankings. The joint model shares weights across E1Sp2D1_SOG, E1Sp3D1, E1Sp5D3, E5Sp7D1, E8W1CB and E8W6_SOG. Synful's folder identifies the configured use dataset; it does not establish the original pretraining dataset.

### LSD / ACRLSD

Point `--checkpoint-dir` at the local directory containing `spider/`, `digspider/` and `multidataset/`. The previously curated local weights can use `checkpoints/upload/lsd`. Supply the actual raw path and fresh output locations. For another LSD bundle, change `--bundle` and use distinct run/output directories.

```bash
connectio-models configure --bundle spider \
  --checkpoint-dir checkpoints/lsd --raw /path/to/raw.zarr \
  --output results/spider --config-dir runs/spider
connectio-models inspect runs/spider/lsd.json
connectio-models inspect runs/spider/acrlsd.json --allow-pending-lsd
connectio-segmentation-stage affinity runs/spider/affinity.json
```

The generator creates `lsd.json`, `acrlsd.json` and `affinity.json` with absolute paths, matching model parameters, iterations and upstream links. Existing configs are not overwritten. The affinity stage submits to Slurm and runs LSD followed by ACRLSD in one GPU allocation. Raw must be a 3D XYZ Zarr with 8 nm `resolution` and `offset` metadata; outputs stay separate from raw.

ACRLSD inspection normally requires existing LSD output. Before the first run, `--allow-pending-lsd` checks the planned dependency and explicitly reports it as `pending`, without claiming to have verified upstream pixels or output geometry. After LSD finishes, inspect again without this flag to validate geometry and the upstream checkpoint signature.

Editable templates are included at `connectio/segmentation/configs/inference/{spider,digspider,multidataset}.{lsd,acrlsd}.json`. Replace their `/path/to/...` fields. Network parameters can be omitted and read from the checkpoint.

### Synful

Point `--checkpoint-dir` at the folder containing `e1sp5d3/`, or use `checkpoints/upload/synful` for the curated local files. Raw uses ZYX axes and nanometre coordinates.

```bash
connectio-models configure --bundle synful-e1sp5d3 \
  --checkpoint-dir checkpoints/synful --raw /path/to/raw.zarr \
  --output results/synful --config-dir runs/synful
connectio-synful inspect --config runs/synful/synful.json --inference-only
# Run predict inside an allocated GPU session.
connectio-synful predict --config runs/synful/synful.json --device cuda
```

Generated `synful.json` needs no `gt_file`, neuron labels or `splits`. The config includes its checkpoint, so `--checkpoint` is optional. Its `[110,268,268]` input tile gives `[34,56,56]` output for this paired architecture; the training example's `[66,646,646]` tile is invalid for this model. Synful executes in the current session, so allocate compute resources first. `run` also extracts and exports after prediction; set `export.dataset` before NML export.

The editable inference-only template is `connectio/synapse_detection/configs/synful.e1sp5d3.inference.json`. You can also use `connectio-models inspect runs/synful/synful.json`. Existing supervised `connectio-synful inspect` still supports training configs with GT.

## Automatic parameter loading and conflict checks

Inference reads architecture parameters from the checkpoint when `model_kwargs` (LSD) or `model` (Synful) is absent. Explicit conflicting settings fail before prediction output is written. LSD also checks stage, iteration, bundle and declared voxel resolution. Spider/DigSpider's `activate_upsampling=true` can no longer silently replace the joint model's default setting. Historical checkpoints without architecture metadata still require a correct explicit configuration.

Synful preserves its two independent networks and the recorded vector `d_scale`. This project's exported nm-vector paired weights use scale 1. Inference no longer requires training configuration in an exported checkpoint, and a conflicting recorded scale is rejected.

## What preflight validates

Inspection reads checkpoints and raw without submitting Slurm, performing a network forward pass or writing predictions. It validates state-dict keys/shapes, tile geometry, raw dimensionality, axes, units and ROI grid, and reports checkpoint SHA-256. A sample of at most `32×32×32` voxels at the start of raw checks dtype/normalization conditions. `--device cuda` checks whether CUDA is visible in the current session.

This does not scan all pixels, measure GPU peak memory/throughput, or establish biological accuracy. `output_resume_checked=false` explicitly reports that existing output recovery identity was not validated. Start with a fresh output and representative ROI. Effective model parameters and vector scale now enter inference identity, so old output signatures may differ; never delete recovery records to force reuse.

## Download private weights and verify (authorization required)

Skip this section if you already have local weights. Authorized users can log in with the [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli). Login alone does not grant repository access; a 401/404 is not sufficient evidence of an invalid token.

```bash
export HF_ENDPOINT=https://huggingface.co
hf auth login
hf download happyhua1/ConnectIO-LSD --revision 198285c3fa854981ffda10d314cafc347eb0a295 --local-dir checkpoints/lsd
hf download happyhua1/ConnectIO-Synful --revision 14f3f7eff804d1d63c53e988e5f08e585cc199b1 --local-dir checkpoints/synful
(cd checkpoints/lsd && sha256sum -c SHA256SUMS)
(cd checkpoints/synful && sha256sum -c SHA256SUMS)
```

The commands pin previously verified revisions. Record the new revision and manifest when updating authorized weights. The seven files total approximately 2.39 GB. `upload_sha256`/`upload_bytes` identify downloads; `source_sha256` identifies the original pre-export file. Hub filenames and hashes differ from historical local Spider manifests.

Exports support inference or `--init-checkpoint` initialization in a new directory. They lack optimizer/RNG/sampler state for exact training `--resume`. Model cards document available provenance and scientific limits. Source-code availability does not make private weights publicly available.
