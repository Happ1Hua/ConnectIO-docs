---
layout: default
title: Mitochondrial segmentation
lang: en
permalink: /en/mito/
---

# Segment mitochondria with Mito

Mito produces one integer ID per mitochondrion. For an overlay on the original EM, open `native.zarr/volumes/mitochondria`. The probability and watershed volumes are on a different grid.

## Configure the source

Install `.[mito-pytorch]` in the model environment. From the checkout, use the bundled `mito-joint` weights. Supply a three-dimensional `uint8` raw array with 8 nm XY spacing. Both XYZ and ZYX storage are supported. Record `resolution` and `offset` in the stored order, in nanometres. If the array lacks axis metadata, set `"axes": "xyz"` or `"axes": "zyx"` in the config.

```bash
connectio-models configure --bundle mito-joint \
  --checkpoint-dir connectio/mito_segmentation/models --raw /path/to/raw.zarr \
  --output mito-results --config-dir runs/mito
connectio-mito inspect --config runs/mito/mito.json
```

The config contains absolute paths. `inspect` checks the weights and geometry. It reports source and output axes. For example, a source XYZ spacing of [8, 8, 12] nm is read internally as [12, 8, 8] in ZYX. Preparation resamples Z to give a 30 × 8 × 8 nm model grid.

## Predict and restore to the native grid

The commands below are separate jobs under the default Slurm backend. Wait for each output. Use `--backend local` on a workstation. Prediction can use GPU. Segmentation uses a global CPU watershed with a lower-bound estimate of 64 bytes per model-grid voxel. Request sufficient host RAM from Slurm. `--memory-gib` sets the program's guard.

```bash
connectio-mito prepare --config runs/mito/mito.json
connectio-mito predict --config runs/mito/mito.json --device cuda
connectio-mito segment --config runs/mito/mito.json --memory-gib 192
connectio-mito restore --config runs/mito/mito.json
```

| Look in | What you can check |
| --- | --- |
| `prepared.zarr/volumes/raw` | Resampled raw in model-grid ZYX |
| `prediction.zarr/volumes/probabilities` | Foreground then contour, shaped [2,Z,Y,X], uint8 scaled to 255 |
| `instances.zarr/volumes/mitochondria` | Global uint32 instance IDs on the model grid |
| `native.zarr/volumes/mitochondria` | Nearest-neighbour labels restored to the source axes, shape, resolution and origin |

`run` executes all four steps in one allocation. For a brief prediction trial use `predict --max-blocks N`, then repeat without the limit to finish with the same inputs. Inspect any `.partial.zarr` from interrupted preparation or watershed before retrying.

## Inference settings

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

## Train and evaluate with instance annotations

Copy `connectio/mito_segmentation/configs/training/joint.json` and set the paired raw and label paths for each annotated volume. Keep the two volumes separate: the same integer may identify a different instance in each. `train_z` and `val_z` refer to the resampled model grid. Use an integer GT volume whose physical extent matches raw. Set `labels_axes` separately where needed.

```bash
connectio-mito prepare-training --config my-training.json
connectio-mito train --config my-training.json --device cuda \
  --init-checkpoint connectio/mito_segmentation/models/joint/spider_fibsem_mito_v1.pt
connectio-mito train --config my-training.json --device cuda \
  --resume /path/to/new-mito-training/train/mito_1000.pt
```

`--init-checkpoint` initializes weights for a new experiment. A native training save includes optimizer and RNG state for `--resume`. Evaluate on a held-out crop with its original physical offset.

```bash
connectio-mito evaluate --config runs/mito/mito.json \
  --gt-file /path/to/holdout.zarr --gt-dataset volumes/mito_segmentation \
  --prediction-file /path/to/holdout-output/native.zarr --memory-gib 16
```

## Which checkpoint ships with ConnectIO?

The bundled `spider_fibsem_mito_v1.pt` is step 2000 of a 5000-step joint fine-tune on digspider and E1Sp5D3. Selection used the equally weighted mean AP75 of two within-crop holdouts. Each crop used model-grid Z [0,70) for training and [86,107) for validation. These are the selection measurements.

| Validation crop | AP | AP50 | AP75 |
| --- | ---: | ---: | ---: |
| digspider | 0.349222 | 0.445545 | 0.445545 |
| E1Sp5D3 | 0.534018 | 0.745403 | 0.571465 |
| Equal-weight mean | 0.441620 | 0.595474 | 0.508505 |

The converted file's SHA-256 is `b153d123e82fbe26346724c1a8cf82046445163c19ea0f5ae39676e042d8ef79`. The model manifest and parity records are in `connectio/mito_segmentation/models/joint/`. CPU verification compared reference logits, TTA and watershed. For a new specimen, inspect native-grid labels on an annotated region before interpreting full-volume counts.

To reproduce the conversion from the original training archive, supply that archive separately and verify its source hash:

```bash
connectio-mito convert \
  --source-checkpoint /path/to/selected_checkpoint.pth.tar \
  --output-checkpoint /path/to/new/spider_fibsem_mito_v1.pt --bundle mito-joint \
  --expected-sha256 34420077f8b2ce133ef3b477c7f77bf32c2b5071e4c74e321aa99912baf1b7d3
```
