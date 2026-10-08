---
layout: default
title: Model downloads
lang: en
permalink: /en/models/
---

# Model downloads and checkpoint configuration

Pretrained weights are published separately from the ConnectIO source package:

- [ConnectIO-LSD](https://huggingface.co/happyhua1/ConnectIO-LSD): paired LSD/ACRLSD segmentation models.
- [ConnectIO-Synful](https://huggingface.co/happyhua1/ConnectIO-Synful): the complete Synful indicator/partner-vector pair.

## Available bundles

One final bundle is retained per dataset or joint training collection. LSD needs both stages; Synful keeps both independent networks in one file. The counters below are **iterations/steps, not epochs**. Choosing the highest iteration does not establish the best validation performance.

| Bundle | LSD repository files | Iteration/step |
| --- | --- | --- |
| DigSpider | `digspider/lsd_20000.pt` + `digspider/acrlsd_5000.pt` | 20,000 / 5,000 |
| Joint multi-dataset training | `multidataset/lsd_400000.pt` + `multidataset/acrlsd_200000.pt` | 400,000 / 200,000 |
| Spider baseline | `spider/lsd_450000.pt` + `spider/acrlsd_230000.pt` | 450,000 / 230,000 |
| Synful, configured for E1Sp5D3 | Synful repository: `e1sp5d3/paired_600000.pt` | 600,000 |

The joint model was trained on E1Sp2D1_SOG, E1Sp3D1, E1Sp5D3, E5Sp7D1, E8W1CB and E8W6_SOG; these datasets share one model pair. The Synful folder identifies the project's use dataset, not a confirmed record of the original pretraining dataset or an independent test set.

## Download and verify

With the [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli) installed, run from your project directory. The public repositories can be downloaded without login. Authentication and uploads should use the official endpoint; an existing `HF_ENDPOINT` pointing to a mirror can interfere with token validation.

```bash
export HF_ENDPOINT=https://huggingface.co
hf download happyhua1/ConnectIO-LSD --revision 198285c3fa854981ffda10d314cafc347eb0a295 --local-dir checkpoints/lsd
hf download happyhua1/ConnectIO-Synful --revision 14f3f7eff804d1d63c53e988e5f08e585cc199b1 --local-dir checkpoints/synful
```

These commands pin the repository revisions verified on **2026-10-08**. To use a newer release, inspect its model card and manifest, then select and record its revision. All seven checkpoint files total approximately **2.39 GB**. Each repository also includes per-checkpoint `.config.json`, a model card, `manifest.json` and `SHA256SUMS`. Verify from each repository's download root:

```bash
(cd checkpoints/lsd && sha256sum -c SHA256SUMS)
(cd checkpoints/synful && sha256sum -c SHA256SUMS)
```

`upload_sha256` and `upload_bytes` in `manifest.json` describe the downloadable file. `source_sha256` identifies the original checkpoint and is not the checksum to use for the export. Preserve the revision and manifest with your run records.

## Configure the downloaded models

### LSD and ACRLSD

Set each inference JSON's `checkpoint` to the downloaded file's absolute path, or to a path resolved relative to that JSON. Set `checkpoint_iteration` to the matching iteration. Downloading does not rewrite the packaged default configs: their historical long Spider filenames differ from the Hub's `spider/lsd_450000.pt` and `spider/acrlsd_230000.pt`.

Copy `model_kwargs` from the matching `.config.json` into the inference JSON. **Spider and DigSpider use `activate_upsampling=true`; the joint multi-dataset model uses `{}`.** Do not carry Spider's setting into a joint-model run. These LSD bundles target 8 nm isotropic FIB-SEM; the current LSD inference path uses XYZ spatial axes.

Run LSD first, then point ACRLSD's `lsd_file` and `lsd_dataset` at that run's LSD output. Keep the two checkpoints from the same table row: ACRLSD 5,000 uses LSD 20,000, ACRLSD 200,000 uses LSD 400,000, and ACRLSD 230,000 uses LSD 450,000. Fill in your raw, ROI, output paths and compute resources as described in the [segmentation guide]({{ "/en/segmentation/" | relative_url }}) and [LSD operating guide]({{ "/en/lsd-guide/" | relative_url }}).

### Synful

Copy the `model` object from `e1sp5d3/paired_600000.config.json` into your Synful run config. It specifies `fmap_num=4`, `fmap_inc_factor=5`, `num_heads=1`, `allow_floor_pooling=true` and downsample factors `[[1,3,3],[3,3,3],[3,3,3]]`. The generic example architecture may differ. Keep the complete paired checkpoint; do not merge its two independently trained encoders or replace it with a single-task checkpoint.

After configuring raw, geometry, ROI and a fresh output directory, run in an allocated compute session:

```bash
connectio-synful predict --config my-synful.json \
  --checkpoint checkpoints/synful/e1sp5d3/paired_600000.pt --device cuda
```

Synful resolves relative paths from the command's working directory and uses ZYX nanometre coordinates. See the [Synful guide]({{ "/en/synful/" | relative_url }}) for the complete workflow.

## Training and prediction recovery

Published checkpoints omit optimizer, RNG and sampler recovery state. Use them for inference or **`--init-checkpoint`** in a new training directory, not for exact training `--resume`. Model tensors were compared exactly with their source during export, but the serialized file hashes changed. Replacing an older checkpoint therefore requires a **new inference output directory** under ConnectIO's signature checks. Historical local Spider manifests describe different serialized files; use the Hub manifest for these downloads.

Validate the selected model on representative target ROIs before a full-volume run. Existing small-ROI functional checks and iteration counts do not establish independent accuracy or biological correctness. Model cards provide the available provenance and use limitations.
