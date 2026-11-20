---
layout: default
title: LSD training and label export
lang: en
permalink: /en/segmentation/
---

# LSD training and WEBKNOSSOS export

For prediction with existing weights, follow [from affinities to labels]({{ "/en/lsd-guide/" | relative_url }}). This chapter covers the training inputs and the two ways to deliver a reviewed segmentation.

## Train on neuron annotations

The Spider baseline was trained for 8 × 8 × 8 nm FIB-SEM. Its converted weights use `activate_upsampling=true` to preserve the source transposed-convolution activation.

| Stage | Checkpoint | Iteration |
|---|---|---:|
| LSD | `lsd_spider_8x8x8nm_fibsem_v1_450000.pt` | 450000 |
| ACRLSD | `acrlsd_spider_8x8x8nm_fibsem_v1_230000.pt` | 230000 |

Provide `volumes/raw`, integer neuron IDs in `volumes/labels/neuron_ids`, and a supervision mask in `volumes/labels/labels_mask`. To select other arrays, set `datasets` in the training config. Match voxel size, axes, units and physical ROI before sampling. The trainer and predictor scale `uint8` by 255 and `uint16` by 65535. Floating raw must be finite and in [0, 1]. Normalized input maps to [−1, 1].

For affinity targets, the two endpoints form a positive edge when they share a nonzero neuron ID. Their masks establish where the edge can be supervised. Boundary zeros can supply valid negative examples. Inspect these targets when prediction looks uniformly connected. The [digspider experiment]({{ "/en/case-study/" | relative_url }}) shows the effect on fragments. Use `connectio-lsd-train` for training and [training recovery]({{ "/en/optimization/" | relative_url }}) to choose between initialization and resume.

## Export labels or switchable merge thresholds

In the final stage config, use `output_type="segmentation"` for a label volume at one `threshold`. Use `output_type="agglomerate"` to compare several thresholds in WEBKNOSSOS. Supply `thresholds` or `thresholds_minmax` with `thresholds_step`, plus `agglomerate_file`, `out_file` and `out_dataset`. Keep the matching LUTs and graph. Each mapping refers to the dense base fragments generated with it.

```text
webknossos_dataset/
├── datasource-properties.json
├── zarr.json
└── segmentation/
    ├── zarr.json
    ├── 1/                         # dense fragments at global voxel coordinates, Zarr3
    └── agglomerates/
        ├── agglomerate_view_000/
        ├── agglomerate_view_002/
        └── ...
```

Copy the complete `webknossos_dataset_path` to the datastore. When adding the generated `segmentation/` to an existing raw dataset, append its entry to `dataLayers`. Keep the raw layer and the original scale. Check a landmark to confirm both layers share a coordinate frame.

## View at coarser magnifications

After editing the example to point to the published dataset and layer, run:

```bash
connectio-segmentation-stage webknossos-downsample \
  connectio/segmentation/configs/stages/07_webknossos_downsample.example.json
```

This adds label magnifications using the WEBKNOSSOS downsampler. Set the coarsest magnitude to match raw. If the datastore shows “Not imported yet”, check that its runtime account can traverse the mounted directory and read `datasource-properties.json`, metadata and chunks. Trigger a disk scan and inspect the datastore import log.
