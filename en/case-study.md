---
layout: default
title: digspider case study
lang: en
permalink: /en/case-study/
---

# digspider: validated raw-to-segmentation case study

The local run used `tests/workspaces/raw_to_seg/`, **8×8×8 nm XYZ** voxels, `data_format_convert` for conversion/preprocessing/alignment, and `lsd_pytorch` for segmentation. Each stage had its own scripts, configs, data, reports, logs, and review record. A shared raw volume under `raw/` avoided duplicate Zarr copies. `tests/workspaces/` is Git-ignored: these run artifacts are **not guaranteed to exist in a public checkout**. This page records the verified findings, not a downloadable data release.

## Conversion, preprocessing, and alignment

The source contained 1,006 uint8 TIFF slices of 3072×2048 pixels. Conversion produced `volumes/raw` with XYZ shape 3072×2048×1006. All 6,329,204,736 voxels matched the source. The TIFF metadata reported 7.8125 nm in XY; the run used the operator-confirmed 8 nm in all axes without resampling.

Preprocessing performed full-stack QC, normalization, and CLAHE with clip limit/tile settings 1.5/16. Local bright spots and vertical stripes were accepted as acquisition artifacts. Each output was reviewed before the next operation.

Alignment used phase correlation with constrained ORB/RANSAC fallback for discontinuities. It accumulated pairwise transforms to slice zero and interpolated each original image once. A pure-translation attempt failed near slice 461; the accepted adaptive run identified a scale change and completed all 1,006 slices. Reports include transforms, valid regions, common valid mask, adjacent NCC, orthogonal views, and full voxel verification.

## Fine-tuning and affinity correction

The Spider baseline was fine-tuned on the digspider ground truth: 20,000 LSD steps and 5,000 ACRLSD steps. An audit then found that the reproduced affinity supervision incorrectly used nonzero labels as the validity mask. GrowBoundary zeros were therefore excluded instead of serving as negative edges, allowing an all-connected affinity prediction to reduce loss—especially for XY channels.

The fix separated target semantics from supervision validity, checked both endpoint masks, restored neighbor halo, and used cross-channel clipped balancing. The audit matched Gunpowder targets, masks, and weights on real ground truth. Old fine-tuned checkpoints and invalid inference outputs were removed, and both models were trained again from the baseline.

## Final segmentation

New affinity inference used the ground-truth source raw and the corrected checkpoints. The cropped affinities aligned with raw under Neuroglancer review. Watershed fragments, agglomeration, threshold LUTs, and final relabeling were then run and reviewed as separate results. The investigation established that earlier fragment misalignment came from the affected affinity/watershed path; choosing a local-minimum watershed polarity was useful for diagnosis but was not retained as a substitute for corrected affinity training.

## How to apply the case study

The run illustrates a sequence of acceptance decisions, not a fixed set of parameters for every specimen. Preserve the original TIFF stack, produce a separate converted Zarr, and compare source pixels to conversion output before intensity processing. Keep normalization and CLAHE outputs separate so the effect of each operation can be inspected. Alignment produces an aligned TIFF stack and report; convert that accepted stack to Zarr before inference. Carry `resolution` and `offset` into all downstream datasets and review XY, XZ, and YZ views after each scientific stage.

For training, check not only loss curves but also whether positive, negative, and ignored affinity edges are represented as intended. Re-run inference and every dependent post-processing stage after a supervision change. For final labels, compare multiple thresholds on representative regions and report both merge and split errors. The [LSD operator guide]({{ "/en/lsd-guide/" | relative_url }}) gives the commands and state requirements for a new run.

## Evidence and reproducibility limits

When the local workspace is available, its reports and JSON reviews retain the exact job IDs, hashes, parameters, and findings. Those large data products and local records are not included in the public repository because `tests/workspaces/` is ignored. A reader can reproduce the *method* from the published configs and documentation, but not the specific quantitative result without the source images, ground truth, checkpoints, and local run records. The published values above describe this one validated run; they should not be generalized to other volumes.
