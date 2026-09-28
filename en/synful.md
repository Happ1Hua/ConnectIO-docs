---
layout: default
title: Synful PyTorch
lang: en
permalink: /en/synful/
---

# Synful PyTorch: synapse partner detection

ConnectIO provides the PyTorch Synful pipeline as `connectio.synapse_detection.synful_pytorch`, under its own `synapse_detection` package rather than `segmentation`. It predicts a postsynaptic indicator and a partner displacement vector, extracts candidate pre/post pairs, and exports CSV and WEBKNOSSOS NML skeletons. The package also provides training, checkpoint validation, TensorFlow NPZ weight conversion, optional segmentation filtering, and blockwise NMS utilities.

This is separate from the [LSD/ACRLSD segmentation pipeline]({{ "/en/segmentation/" | relative_url }}). The two workflows may share the same raw and neuron segmentation volumes, but Synful uses its own configuration, checkpoints, and output directory. ConnectIO does not include the original Synful experiment data or trained weights.

## 1. Install the integration

The integration is currently available on the `codex/synful-pytorch-integration` branch of [ConnectIO](https://github.com/Happ1Hua/ConnectIO/tree/codex/synful-pytorch-integration). Check out that branch until the integration is merged into `main`:

```bash
git clone --branch codex/synful-pytorch-integration https://github.com/Happ1Hua/ConnectIO.git
cd ConnectIO
python -m pip install -e '.[synful-pytorch]'
connectio-synful --help
```

Use a Python environment with a PyTorch build appropriate for your accelerator and driver. The `synful-pytorch` extra installs the package dependencies; it does not select a CUDA build or submit a GPU job. Training, full-volume inference, and GPU validation should run in an allocated compute session. A CPU run is useful for a small test ROI but can be slow for production volumes.

The source package can also be invoked as `python -m connectio.synapse_detection.synful_pytorch` if a console script is unavailable. Existing scripts that imported `connectio.segmentation.synful_pytorch` must update that import path; the `connectio-synful` command name is unchanged.

## 2. Prepare the data and configuration

Copy the [packaged example JSON](https://github.com/Happ1Hua/ConnectIO/blob/codex/synful-pytorch-integration/connectio/synapse_detection/configs/synful.example.json):

```bash
cp connectio/synapse_detection/configs/synful.example.json my-synful.json
```

The example contains placeholder paths and ROIs. Change them before running `inspect` or training. Relative data and output paths are resolved from the **current working directory** by the current Synful implementation; an absolute path is safer when launching from Slurm scripts. The example's `synful-results/` directory and `my-synful.json` are ignored by Git.

| JSON section | Required meaning | Checks to make |
|---|---|---|
| `data.gt_file` | HDF5 ground-truth crop for supervised training and validation | Contains raw, neuron labels, and CREMI synapse annotations. |
| `data.inference_file` | HDF5 or Zarr raw volume to predict | `raw_dataset` must exist and describe a 3D ZYX volume. |
| `data.raw_dataset` | Raw dataset key in both inputs | Example: `volumes/raw`. |
| `data.labels_dataset` | Neuron-ID dataset key in the GT file | Example: `volumes/labels/neuron_ids`. |
| `splits.train` / `splits.validation` | `offset_nm` and `shape_nm` for two GT ROIs | Use absolute ZYX nanometres; each ROI must fit inside the label volume and contain annotated postsynaptic points. |
| `model` | Network width, heads, downsampling factors | Keep identical to the checkpoint architecture when resuming or validating. |
| `training` | Input shape, loss, augmentation, optimizer, output and checkpoint schedule | The input shape must satisfy valid convolutions and pooling alignment. |
| `inference` | Input tile, output directory, optional AMP | Choose a new output directory for a different checkpoint, raw volume, ROI, or tile shape. |
| `extraction` | CC or NMS method, thresholds, block shape, context | Scores have different meanings for CC and NMS. |
| `export` | WEBKNOSSOS dataset name and XYZ axis mapping | Verify the target dataset's voxel size, origin, and axis convention. |
| `postprocessing` (optional) | Segmentation volume and pair filtering | Omit this section to export unfiltered candidates. |

Each input volume must be 3D and have a `resolution` attribute containing positive ZYX voxel sizes in nanometres. `offset` is an optional ZYX nanometre attribute; if absent, the implementation uses zero. Floating-point raw data must already be in `[0, 1]`; unsigned integer raw data is normalized automatically. The GT HDF5 file additionally needs `annotations/ids`, `annotations/locations`, and `annotations/presynaptic_site/partners`. Annotation offsets are read from the `annotations` group.

First inspect the configured volumes, annotations, split counts, and model output shapes:

```bash
connectio-synful inspect --config my-synful.json
```

`inspect` opens the configured GT and inference inputs. It is an input check, not a synthetic-data dry run; it fails if a placeholder path or required dataset remains.

## 3. Train or resume

Train from random initialization inside a GPU allocation:

```bash
connectio-synful train --config my-synful.json --device cuda --steps 100
```

The short run checks the training path; 100 steps do not establish model quality. `--steps` means **additional steps in this invocation**. Without it, training runs until `training.max_steps`. Training samples raw and labels from the GT crop, builds indicator and vector targets, applies the configured augmentation, and checks the validation split at `training.validation_every`.

The training directory contains `config.json`, `metrics.jsonl`, `latest.pt`, and periodic `step_XXXXXXX.pt` checkpoints. A run without `--resume` refuses to reuse a directory that already contains `latest.pt`. To continue the same run:

```bash
connectio-synful train --config my-synful.json --device cuda \
  --resume synful-results/training/latest.pt --steps 100
```

Resume restores model weights, optimizer, scaler, step, and the saved PyTorch RNG state. The model, data, splits, and specified training semantics must match the checkpoint. Use a new output directory for an independent run.

The Python API also supports `train(config, init_checkpoint=...)` for weights-only initialization, but the current `connectio-synful train` command does **not** expose `init_checkpoint`. `--resume` continues a training run; it is not a weights-only fine-tune switch.

## 4. Predict a small ROI, then a volume

`predict` requires a trained checkpoint with both indicator and partner-vector outputs. To check an ROI first, provide its ZYX offset and shape in nanometres:

```bash
connectio-synful predict --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda \
  --roi-offset-nm 0 0 0 --roi-shape-nm 512 1024 1024 \
  --output-dir synful-results/roi-check
```

Replace the ROI with one inside your raw volume and aligned to its voxel grid. Both ROI flags are required together. `--max-blocks 1` can stop after a first block for a pipeline check; the result is incomplete and cannot be extracted until `predict` resumes and finishes. To predict the configured full volume, omit both ROI flags:

```bash
connectio-synful predict --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda
```

Prediction writes `prediction.zarr` with `volumes/pred_syn_indicator` (float32 probability) and `volumes/pred_partner_vectors` (float32 nanometre vectors), plus `prediction.sqlite` and its lock file. Spatial `resolution` and `offset` metadata are retained. A block is recorded as complete only after both arrays are written. Repeating the command with the same output and signature skips completed blocks. The signature includes the source path and geometry, checkpoint hash, input tile, ROI, halo, and quantization mode. A changed signature requires a new output directory.

The `run` command performs prediction and, once complete, extraction and export in one invocation:

```bash
connectio-synful run --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda
```

`run` does not export while prediction is incomplete, including when `--max-blocks` stops it early.

## 5. Extract candidates and export

To process an already complete prediction without rerunning the network:

```bash
connectio-synful extract --config my-synful.json
```

The command reads `inference.output_dir/prediction.zarr`, detects postsynaptic sites, samples the predicted vectors to locate presynaptic partners, and writes `synapses/synapses.npz`. The NPZ contains candidate IDs, paired positions, scores, voxel size, and offset. Extraction uses its own SQLite completion record in the `synapses/` directory.

| `extraction` setting | Effect |
|---|---|
| `method: "cc"` | Connected components above `threshold`; `score_type` can be `sum`, `mean`, `max`, or `count`. |
| `method: "nms"` | Local maxima above `threshold`; score is a peak probability. |
| `score_threshold` | Discards detections whose method-specific score is not greater than this value. |
| `context_nm` | Halo around extraction blocks. It must cover the NMS radius; a CC touching the halo edge raises an error instead of being silently truncated. |
| `block_shape` | Extraction core in ZYX voxels. |
| `min_distance_nm` | Minimum accepted pre/post distance. |

Do not reuse a CC sum-score threshold for NMS peak probabilities. If a CC reaches a halo edge, increase `context_nm` and choose a new extraction output directory or run directory. The extraction signature binds results to the prediction and extraction settings.

By default, export writes `03.synapses.csv` and `06.synapses.nml` next to the prediction, plus `export_report.json`. If `postprocessing` is configured, it also checks endpoint neuron labels, removes nearby duplicates, and writes `04.filtered_synapses.csv` and `06.filtered_synapses.nml`. The optional section needs `segmentation_file`, `segmentation_dataset`, and `distance_threshold_nm`; the segmentation must cover the candidates and use compatible physical coordinates.

## 6. Coordinates and WEBKNOSSOS delivery

Synful's internal order is **ZYX in nanometres**. Candidate CSV columns are explicitly named `pre_z_nm`, `pre_y_nm`, `pre_x_nm`, `post_z_nm`, `post_y_nm`, and `post_x_nm`. In the exported NML, each pair becomes one tree with two nodes and one edge. NML node coordinates are nonnegative, integer magnification-1 **XYZ voxel coordinates**. The exporter rejects nonfinite, negative, or off-grid positions.

`export.axis_order` tells the exporter which source axis supplies each output NML axis. `xyz` is the default example; some datasets require `zyx`. Verify the mapping against the target WEBKNOSSOS dataset and its image orientation before importing. The NML scale comes from the raw volume's voxel-size metadata. If the dataset has a nonzero physical origin, set `export.origin_nm_xyz` deliberately and verify a known point. The NML is a skeleton annotation; it does not contain the raw volume or segmentation.

For standalone CSV-to-NML conversion, the package also exposes:

```bash
python -m connectio.synapse_detection.synful_pytorch.io.nml \
  --csv synful-results/inference/03.synapses.csv \
  --output synful-results/inference/review.nml \
  --dataset YOUR_WEBKNOSSOS_DATASET \
  --voxel-size-xyz 8 8 8 --axis-order xyz
```

Use `--origin-nm-xyz`, `--schema`, or `--score-threshold` only when their meanings are known for your input. Existing NML files are protected from overwrite by this standalone command unless `--overwrite` is supplied.

## 7. Validate and interpret results

```bash
connectio-synful validate --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda
```

Validation predicts the configured GT `validation` ROI, extracts candidates, and writes `metrics.json` below `training.output_dir/validation/<checkpoint-hash>/`. It reports TP, FP, FN, precision, recall, F1, and average pre/post endpoint errors. A match requires **both** endpoints to fall within the matching distance (400 nm by default in the API); matching uses endpoint distance, not neuron IDs. These numbers describe the configured GT ROI. Check for overlap with training data before treating them as independent test results.

Legacy TensorFlow weights exported to NPZ can be converted with `connectio-synful convert-tf --weights-npz WEIGHTS.npz --checkpoint OUTPUT.pt --config my-synful.json`. This converts one compatible model. A checkpoint containing only an indicator or only a vector model cannot drive paired inference; independently trained legacy models require a properly constructed paired checkpoint that keeps both networks.

## 8. Common failures

| Message or symptom | Likely cause and action |
|---|---|
| Missing `resolution` or “Expected ZYX volume” | Fix the input dataset key or metadata; the loader requires a 3D volume and valid ZYX voxel size. |
| “Input shape must align with pooling grid” | Use a model-compatible input tile; check `inspect` after editing the shape. |
| “No annotated posts in split” | Move or enlarge the GT ROI to include annotated posts while keeping it inside the label volume. |
| “Output belongs to a different input/checkpoint/config” | Choose a new prediction or extraction output directory for the changed run. |
| “Prediction is incomplete” | Resume `predict` with the same inputs until all blocks finish, then run `extract`. |
| “CC exceeds extraction halo” | Increase `extraction.context_nm`; use a fresh extraction directory. |
| NML “Off-grid/negative/nonfinite coordinate” | Check raw voxel size, physical origin, axis mapping, and candidate coordinates. |
| NML appears rotated or displaced | Check `export.axis_order`, `export.origin_nm_xyz`, raw `resolution`/`offset`, and the WEBKNOSSOS dataset metadata together. |

The [source package guide](https://github.com/Happ1Hua/ConnectIO/blob/codex/synful-pytorch-integration/connectio/synapse_detection/synful_pytorch/README.md) and [example configuration](https://github.com/Happ1Hua/ConnectIO/blob/codex/synful-pytorch-integration/connectio/synapse_detection/configs/synful.example.json) track the exact branch used by this page.
