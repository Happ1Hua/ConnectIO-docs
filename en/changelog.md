---
layout: default
title: Changelog
lang: en
permalink: /en/changelog/
---

# Changelog

## 26.11.02 — 2026-11-02

- Fix unsafe file replacement, checkpoint loading, process ownership and resume integrity across Zarr2/Zarr3.
- Bind Funke state to input/config identity; restrict automatic MongoDB to loopback and redact credentials.
- Fix cross-block NMS plateaus, sparse instance evaluation, image validation, metadata and NML merge references.
- See the [review repair record]({{ "/en/audit/" | relative_url }}) for migration notes, validation and limitations.

## 26.10.28 — 2026-10-28

- Add shared Zarr2/Zarr3 I/O across conversion, processing, model workflows and Neuroglancer.
- Preserve WEBKNOSSOS ROI, axes, scales and segmentation IDs; retain native Zarr2 defaults.
- Add explicit output selection, configurable LSD training datasets and dual-format regression tests.
- Include local/Slurm execution updates and synchronize README, examples and bilingual documentation.

## 26.10.23 — 2026-10-23

- Mito reads XYZ/ZYX Zarr through blockwise ZYX views and restores original input axes in native-grid exports.
- Validate all axis metadata declarations and explicit settings; reorder physical coordinates together with pixels. Missing axes require an explicit configuration.
- Training and evaluation support mixed stored axes; model weights are unchanged.

## 26.10.22 — 2026-10-22

- Native PyTorch residual-SE U-Net+ mitochondrial segmentation, strict checkpoint conversion, and `connectio-mito`.
- `mito-joint` model configure/inspect, paired multi-volume training, Zarr resampling, tiled prediction, global BC watershed and native-grid export.
- Migrated selected two-GT step-2000 weights with SHA256, selection provenance and a local Hugging Face upload bundle; bilingual documentation updated.

## 26.10.13 — 2026-10-13

- Added local inference config generation for Spider, DigSpider, joint LSD/ACRLSD and paired Synful bundles.
- Added checkpoint parameter/identity conflict checks and GT-free, read-only inference preflight.
- Fixed inference from paired Synful exports without a training section while retaining vector scale.
- Model repositories are private; documentation now distinguishes authorized downloads from local use.


## Documentation update — 2026-10-08

- Published model links and a bilingual guide now cover LSD/Synful downloads, pinned revisions, checksums, paired configuration and initialization/recovery limits.

## 26.10.04 — 2026-10-04

- Added training geometry validation, bounded sampling and exact indexed recovery with atomic checkpoints.
- Added Synful raw/output chunk revision checks, bounded resampling with recoverable publication and nearest uint64 label support.
- Added disk-backed evaluation and bounded batched/multi-GPU inference with optional CUDA mixed precision and timing reports.

- Unified LSD/ACRLSD raw normalization across training and inference, including uint16 and normalized floating inputs.
- Bound inference resume to checkpoint, input revision, geometry, and configuration signatures, with per-dataset state and a single-writer lock; unsigned legacy outputs require a new path.
- Preserved fractional evaluation geometry and validated axes, units, and voxel-grid alignment; added explicit legacy axes options.
- Added CPU regression checks for scientific input/output correctness.

## 26.09.23

- Made public compute APIs Slurm-first with CPU `C64M512G` and GPU `GPUA800` defaults, configurable resource and environment options, job status/result/cancel handles, and no login-node fallback.
- Added standalone `precomputed`, `alignment`, `affinity`, `over-segmentation`, `agglomeration`, `lut`, and `segmentation` submissions with persistent per-run status and graph state.
- Added readable stage JSON examples and preserved manual Neuroglancer review boundaries.
- Consolidated project documentation as a bilingual GitHub Pages site and reduced repository-facing READMEs to concise entry points.

## 26.07.29

Moved Zarr, synapse, HDF5, and precomputed viewers to interactive Slurm launchers; separated compute and browser ports; generated SSH tunnel commands; added lifecycle cleanup; made tutorial paths relocatable; defaulted large Zarr viewing to lazy reads; and exposed viewer CPU, memory, partition, and time settings.

## 0.1.7

Fixed HDF5-to-Zarr conversion.

## 0.1.6

Fixed lazy Zarr Neuroglancer lifecycle and layer-name sanitization; added HDF5 keep-alive; added bounded streaming, read-ahead, XY tiling, and small/large presets for precomputed-to-Zarr.

## 0.1.5

Added threaded precomputed reads, Zarr-to-precomputed, PNG-stack conversion, parallel conversion/processing options, and progress reporting.

## 0.1.4

Added ImageJ hyperstack TIFF support and channel splitting.
