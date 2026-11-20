---
layout: default
title: Synapse detection
lang: en
permalink: /en/synful/
---

# Detect synaptic partners with Synful

Starting from raw EM and paired indicator/vector weights, Synful predicts a postsynaptic site and a displacement to its presynaptic partner. The result you review is a pair of points. A neuron segmentation is optional and can filter the candidates after detection.

## Predict a region you can review

Generate `runs/synful/synful.json` with the paired checkpoint and `inspect --inference-only` as described in [weights and inference configs]({{ "/en/models/" | relative_url }}). Plain Zarr and HDF5 raw are 3D **ZYX**. Spacing and physical origin follow the same order in nm. Check these before using raw from an XYZ converter. Relative Synful paths resolve from the working directory. For WEBKNOSSOS input, see [layer coordinates]({{ "/en/zarr/" | relative_url }}).

Replace the example ROI with one inside your volume. Both offset and extent are in **nanometres**, aligned to the voxel grid. The example uses CUDA. The CLI defaults to Slurm outside an allocation. To run on your workstation add `--backend local`.

```bash
connectio-synful predict --config runs/synful/synful.json --device cuda \
  --roi-offset-nm 0 0 0 --roi-shape-nm 512 1024 1024 \
  --output-dir synful-results/roi-check
```

Wait for completion. Open `prediction.zarr` under `synful-results/roi-check`. The array `volumes/pred_syn_indicator` contains postsynaptic probabilities and `volumes/pred_partner_vectors` contains vectors in nm. Both are float32. For a one-block I/O trial, add `--max-blocks 1`. Rerun with the same ROI and output path to finish. A change to the checkpoint, tile or raw requires a fresh output.

## Extract pairs and check their coordinates

Set `export.dataset` to the target WEBKNOSSOS dataset name. Extract from the same output directory used for the ROI:

```bash
connectio-synful extract --config runs/synful/synful.json \
  --output-dir synful-results/roi-check
```

Open `synapses/synapses.npz` for the candidate IDs, scores and endpoint positions. The exported `03.synapses.csv` labels its coordinates explicitly (`pre_z_nm` through `post_x_nm`). In `06.synapses.nml` each tree is one pair with two nodes and one edge. Check one point against a landmark in WEBKNOSSOS. NML uses integer **XYZ voxels at magnification 1**. Verify `export.axis_order`, voxel size and `export.origin_nm_xyz` if the overlay appears rotated or shifted. For standalone conversion:

```bash
python -m connectio.synapse_detection.synful_pytorch.io.nml \
  --csv synful-results/roi-check/03.synapses.csv \
  --output synful-results/roi-check/review.nml \
  --dataset YOUR_WEBKNOSSOS_DATASET \
  --voxel-size-xyz 8 8 8 --axis-order xyz
```

| `extraction` setting | Effect |
|---|---|
| `method: "cc"` | Connected components above `threshold`; `score_type` can be `sum`, `mean`, `max`, or `count`. |
| `method: "nms"` | Local maxima above `threshold`; score is a peak probability. |
| `score_threshold` | Discards detections whose method-specific score is not greater than this value. |
| `context_nm` | Halo around extraction blocks. It must cover the NMS radius; a CC touching the halo edge raises an error instead of being silently truncated. |
| `block_shape` | Extraction core in ZYX voxels. |
| `min_distance_nm` | Minimum accepted pre/post distance. |

Choose score thresholds separately for CC and NMS. `postprocessing.segmentation_file`, `segmentation_dataset` and `distance_threshold_nm` enable neuron-label and duplicate filtering. Review `04.filtered_synapses.csv` alongside the original candidates and `export_report.json`. For a full volume, omit both ROI flags and use a new output directory. `connectio-synful run` performs prediction, extraction and export in sequence.

## Train on an annotated crop

Copy `connectio/synapse_detection/configs/synful.example.json` to `my-synful.json`. Supply an HDF5 crop with raw, neuron labels and CREMI `annotations/ids`, `annotations/locations` and `annotations/presynaptic_site/partners`. Set `splits.train` and `splits.validation` in absolute ZYX nm. Inspect the split counts before starting.

```bash
connectio-synful inspect --config my-synful.json
```

```bash
connectio-synful train --config my-synful.json --device cuda --steps 100
```

The training directory holds `metrics.jsonl`, `latest.pt` and periodic checkpoints. `--steps` counts additional steps. Use `--init-checkpoint` in a fresh directory for weights-only fine-tuning. To resume the optimizer and sample sequence:

```bash
connectio-synful train --config my-synful.json --device cuda \
  --resume synful-results/training/latest.pt --steps 100
```

```bash
connectio-synful validate --config my-synful.json \
  --checkpoint synful-results/training/latest.pt --device cuda
```

Validation reports precision, recall, F1 and endpoint errors for the configured holdout. Matching requires both endpoints within the tolerance. In the recorded `tests/synful_real` check, the validation ROI contained five annotated pairs. After two training steps there was one true positive, no false positives and four false negatives. This small run checks the data path and export. The checkpoint may overlap the annotated region. [Test procedure and results](https://github.com/Happ1Hua/ConnectIO/tree/main/tests/synful_real)

## If extraction or export stops

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
