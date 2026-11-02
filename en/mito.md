---
layout: default
title: Mito PyTorch mitochondrial instance segmentation
lang: en
permalink: /en/mito/
---

# Mito PyTorch

This CLI uses the common execution policy: `--backend local` runs on a workstation and `--backend slurm` submits a job. Set `export CONNECTIO_EXECUTION_BACKEND=local` to run the commands below locally by default. Otherwise Slurm is the default; help never submits. See [local and Slurm execution]({{ "/en/slurm/" | relative_url }}).

ConnectIO 26.10.22 implements the MitoEM foreground/contour (BC) model directly in PyTorch: residual-SE U-Net+, non-local bottleneck, five levels `[32,64,96,128,160]`, two logits. Runtime training and inference do not import PyTorch Connectomics, MONAI, torchvision, yacs or the source project. Source attribution and MIT licenses are included. The small independent MitoEM 3D AP evaluator is retained with a local NumPy compatibility fix.

## Installation and execution

```bash
python -m pip install -r requirements-mito.txt
python -m pip install -e . --no-deps
connectio-mito --help
# Equivalent: python -m connectio.mito_segmentation.mito_pytorch
```

Use a CUDA PyTorch build appropriate for the GPU. These native commands execute in the current session, as Synful does; allocate compute resources first. For example, after generating the config below:

```bash
sbatch --partition=GPUA800 --gres=gpu:1 --cpus-per-task=4 --mem=64G \
  --wrap='OMP_NUM_THREADS=4 python -m connectio.mito_segmentation.mito_pytorch predict --config runs/mito/mito.json --device cuda'
```

The job inherits the activated environment and submission directory. Run global watershed in a CPU allocation sized for the whole model-grid volume; `--memory-gib` is a guard, not a Slurm memory request.

## The migrated joint checkpoint

The selected checkpoint is **joint step 2000**, after a 5000-step fine-tune on **digspider + E1Sp5D3**. Selection maximized the equally weighted mean validation AP75; ties use mean AP50, mean AP, then earlier step. Both 400³, 8 nm GT crops were converted to 107×400×400 at 30×8×8 nm. Each used model-grid Z `[0,70)` for training and `[86,107)` for validation, separated by a 480 nm gap. Instance IDs belong to separate volumes and must not be concatenated.

| Validation crop | AP | AP50 | AP75 |
| --- | ---: | ---: | ---: |
| digspider | 0.349222 | 0.445545 | 0.445545 |
| E1Sp5D3 | 0.534018 | 0.745403 | 0.571465 |
| Equal-weight mean | 0.441620 | 0.595474 | 0.508505 |

These are the original selection results, not a new benchmark of the integrated pipeline. They are spatial holdouts within annotated crops; the digspider holdout was already used in prior selection. Full-volume E1Sp5D3 inference includes training regions and is not independent testing.

- Original checkpoint retained at `checkpoints/retained/mito/joint/selected_checkpoint.pth.tar` (~28 MB).
- Converted weights are bundled at `connectio/mito_segmentation/models/joint/spider_fibsem_mito_v1.pt` (14,693,296 bytes).
- Source SHA256: `34420077f8b2ce133ef3b477c7f77bf32c2b5071e4c74e321aa99912baf1b7d3`.
- Converted SHA256: `b153d123e82fbe26346724c1a8cf82046445163c19ea0f5ae39676e042d8ef79`.
- Tracked provenance: `connectio/mito_segmentation/models/joint/manifest.json` and `parity.json`.

The export contains all model parameters and BatchNorm buffers, architecture, voxel size, iteration and provenance. It uses restricted `weights_only=True` loading. Optimizer state from the original pipeline is retained in the original file, not transferred to the native trainer. Use converted weights for inference or `--init-checkpoint`, never exact legacy resume. The converted 14.7 MB `spider_fibsem_mito_v1.pt` is included directly in GitHub and the Python wheel at `connectio/mito_segmentation/models/joint/`; the original training archive remains local.

## Configuration and inference

```bash
connectio-models configure --bundle mito-joint \
  --checkpoint-dir connectio/mito_segmentation/models --raw /path/to/raw.zarr \
  --output mito-results --config-dir runs/mito
connectio-models inspect runs/mito/mito.json
connectio-mito inspect --config runs/mito/mito.json
```

`connectio-models` writes `mito.json` with absolute paths and refuses overwrite. Hand-edited paths resolve relative to the JSON file. The editable inference template is `connectio/mito_segmentation/configs/inference/joint.json`. `family` is `mito`, `model_bundle` is `mito-joint`; omit `model` to use checkpoint metadata. Explicit architecture, bundle and model-voxel-size conflicts are rejected. Preflight strictly loads weights and checks raw geometry; it performs no forward pass and writes no output.

Since **26.10.23**, raw can be a **uint8 XYZ or ZYX Zarr** array, by default `volumes/raw`. `resolution` and `offset` must be in nm and follow the stored array axes. The default `"axes": "auto"` reads `axis_order`, `axes` or `_ARRAY_DIMENSIONS`; multiple declarations must agree. Lists of axis names and axis dictionaries are accepted. Missing declarations require an explicit `"axes": "xyz"` or `"axes": "zyx"`. Explicit configuration cannot override conflicting metadata. A dataset-level `data.axes` overrides the top-level default.

XYZ input is read through a lazy ZYX view: only requested blocks are transposed, and physical resolution/offset are reordered with them. No full-volume transpose or separate transposed raw copy is required. Preparation still writes its usual resampled model-grid data. XY resolution must be 8 nm; physical Z resolution comes from metadata. Gaussian antialiasing and cell-centred interpolation operate along physical Z, regardless of storage order. The source store stays read-only, and output paths remain separate.

For an existing XYZ store without axis metadata, set the following fields in `mito.json` (keep the other generated fields):

```json
{"axes": "xyz", "data": {"raw_file": "/path/to/raw.xyz.zarr", "raw_dataset": "volumes/raw"}}
```

All tile/stride/padding/block sizes and `voxel_size_zyx_nm` remain **ZYX model-grid parameters**. For example, source XYZ resolution `[8,8,12]` and offset `[40,24,120]` become internal ZYX `[12,8,8]` and `[120,24,40]`. Final `native.zarr` restores XYZ shape, resolution and offset. Intermediate prepared/prediction/instance arrays remain ZYX (probabilities: CZYX). Preflight reports both stored and logical geometry plus `output_axes`.

Axis interpretation now participates in source identity. Use a fresh output directory for runs prepared by 26.10.22; old preparation signatures are rejected rather than silently reused.

```bash
connectio-mito prepare --config runs/mito/mito.json
# Inside a GPU allocation:
connectio-mito predict --config runs/mito/mito.json --device cuda
# Inside an appropriately sized CPU allocation:
connectio-mito segment --config runs/mito/mito.json --memory-gib 192
connectio-mito restore --config runs/mito/mito.json
```

`run` performs prepare/predict/segment/restore in one allocation; individual commands permit separate resource requests. `--checkpoint` overrides the config. `predict --max-blocks N` supports a bounded trial; repeat without that option to complete it. Prediction records data geometry, checkpoint SHA256 and inference settings; incompatible reuse fails. Completed blocks are skipped. CLI writers are locked per output directory. Keep source pixels immutable throughout a run: identity records metadata, not a full pixel hash. Interrupted preparation or post-processing leaves a `.partial.zarr` requiring inspection before retry; complete instance/native outputs are never overwritten.

| Setting | Default / meaning |
| --- | --- |
| `inference.input_shape` | `[17,257,257]` ZYX; same-size network output |
| `inference.stride` | `[8,128,128]`; cannot exceed the tile |
| `inference.block_shape` | `[64,512,512]`; limits accumulation memory |
| `inference.padding` | `[4,64,64]`; reflected context at volume edges |
| `inference.batch_size` | `1` |
| `inference.tta` | `4` XY flips, or `1` without TTA |
| Normalization | `(uint8 / 255 - 0.5) / 0.5` |
| Blending | Gaussian, sigma 0.2, floor 1e-4; quantized uint8 probabilities |
| Watershed | `thres1=.85`, `thres2=.6`, `thres3=.8`, `thres_small=1024`, `seed_thres=32` |

Outputs under `output_dir`:

- `prepared.zarr/volumes/raw`: 30×8×8 nm raw.
- `prediction.zarr/volumes/probabilities`: uint8 `[2,Z,Y,X]`, foreground then contour, scale 255.
- `instances.zarr/volumes/mitochondria`: globally unique uint32 instances at model resolution.
- `native.zarr/volumes/mitochondria`: nearest-neighbour labels on the source grid with its original **XYZ/ZYX order**, shape/offset/resolution. All three axis metadata declarations are written consistently. This adds no Z detail.

Global watershed is intentionally not replaced with disconnected per-block instances. Its lower-bound memory guard uses 64 bytes per voxel; account for library overhead and validate the job's actual memory needs. Chunk layout and border contexts affect inference near blocks, so the native pipeline is not claimed to reproduce a historical full-volume result bit for bit. Model/TTA/target/watershed parity and synthetic pipeline tests are documented separately.

## Training with two GT volumes

Edit `connectio/mito_segmentation/configs/training/joint.json` into your own config with two paired raw/GT paths and a fresh output directory. GT must have integer instance IDs and matching physical geometry after axis normalization. Raw and GT may have different stored axes. Each training dataset accepts `axes` and `labels_axes` (default: dataset `axes`); use `auto` for independently declared mixed-axis inputs. `train_z` and `val_z` refer to the **resampled model grid**. Data preparation creates separate volumes; labels use nearest-neighbour sampling and retain IDs.

```bash
connectio-mito prepare-training --config my-training.json
connectio-mito train --config my-training.json --device cuda \
  --init-checkpoint connectio/mito_segmentation/models/joint/spider_fibsem_mito_v1.pt
connectio-mito train --config my-training.json --device cuda \
  --resume /path/to/new-mito-training/train/mito_1000.pt
```

The native trainer samples the two volumes equally, uses foreground rejection within the selected volume, and never reflects padding across the training split. Its BC targets, class balancing and per-channel weighted BCE + 0.5 Dice follow the reference. The native augmentation is spatial flips; the native warmup/cosine SGD schedule and sampler are not claimed to reproduce the original upstream training trajectory. Validation intervals are excluded from training; checkpoint selection is explicit evaluation, not automatic use of GT during inference. `--steps` limits additional steps for a smoke run. Native saves retain optimizer, RNG and configuration/source identity for resume. Exact-resume regression is verified on CPU; GPU determinism is not promised across hardware/software changes.

For validation, create a Zarr crop containing only the chosen holdout (with its physical offset), configure inference on that crop, and compare prediction and GT on the same grid:

```bash
connectio-mito evaluate --config runs/mito/mito.json \
  --gt-file /path/to/holdout.zarr --gt-dataset volumes/mito_segmentation \
  --prediction-file /path/to/holdout-output/native.zarr --memory-gib 16
```

Evaluation normalizes XYZ/ZYX GT and predictions independently before shape and coordinate checks. If metadata is absent, pass `--gt-axes xyz` and/or `--prediction-axes xyz` (or `zyx`). It uses the original MitoEM instance-size-ranked 3D AP evaluator. It does not crop mismatched GT silently.

## Conversion and verification

26.10.23 axis-adaptation validation: 36 related tests passed. With the bundled weights, a real EM crop stored as XYZ and ZYX produced bitwise-identical probabilities and identical native labels after matching axes. Tests also cover anisotropic resolution, nonzero offsets, missing/conflicting declarations, mixed-axis raw/GT, and uint32 IDs above 65535. See `models/joint/axes_validation.json` within the mito module.


Verified on the actual joint weights: CPU logits are bitwise equal to the reference for `[9,33,35]` and `[17,257,257]`; four-flip TTA, BC targets, class weights and watershed also match. All 27 selected regression tests passed. The built wheel ran a real EM crop through the complete native pipeline on CPU. GPU/full-volume parity has not been tested.


```bash
connectio-mito convert \
  --source-checkpoint /path/to/selected_checkpoint.pth.tar \
  --output-checkpoint /path/to/new/spider_fibsem_mito_v1.pt --bundle mito-joint \
  --expected-sha256 34420077f8b2ce133ef3b477c7f77bf32c2b5071e4c74e321aa99912baf1b7d3
```

Conversion preserves the state-dict tensor names and values, loads all keys strictly and rejects missing/mismatched tensors, non-finite values, wrong source hashes and existing destinations. The `mito-joint` name is reserved for the selected checkpoint. The independent verifier `tools/verify_mito_conversion.py` can compare against the original checkout inside its old environment. The reference is needed only for that optional verification.

## Optional Hugging Face mirror upload

The primary distribution is the GitHub repository. An optional local Hugging Face mirror bundle is prepared; Hub upload is **not executed**. The proposed repository is `happyhua1/ConnectIO-Mito`. This follows the existing model naming; its remote existence/visibility has not been assumed. The command creates it private if missing and does not change an existing repository's visibility.

```bash
hf auth login
(cd checkpoints/upload/mito && sha256sum -c SHA256SUMS)
hf upload happyhua1/ConnectIO-Mito checkpoints/upload/mito . \
  --repo-type model --private --commit-message "ConnectIO 26.10.22: native PyTorch mito joint-GT checkpoint"
```

The package includes the model card, converted weights, selection record, inference/training configs, manifest and checksums. After uploading, record the resulting Hub revision and use that revision for reproducible downloads; no revision can be supplied before publication.


## Zarr2 / Zarr3 (26.10.28)

Volume I/O supports both formats. New outputs remain Zarr2 by default; select `zarr_format=3`, `--zarr-format 3`, or a model config with `"zarr_format": 3` for new Zarr3 stores. See [format coverage, coordinates and validation]({{ "/en/zarr/" | relative_url }}).
