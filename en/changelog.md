---
layout: default
title: Changelog
lang: en
permalink: /en/changelog/
---

# Changelog

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
