---
layout: default
title: Release notes
lang: en
permalink: /en/changelog/
---

# Release notes

## GUI preview branch

The GUI supports TIFF preprocessing, volume operations, conversion, three model workflows and Neuroglancer review. The language switch preserves form entries. Completion mail can use a sender configured in the GUI. These features are on `codex/connectio-gui-v1`. See the [GUI workbench]({{ "/en/gui/" | relative_url }}) for setup and the four-slice example.

In the November 6 cluster acceptance run, a 1000 × 1000 × 500 crop matched all 500 million source voxels. The operation checks exercised 46 GUI operations, mostly on smaller inputs. The run tested data transfer and file formats. It did not measure whole-volume inference throughput or model accuracy.

## Package releases

| Version | Change affecting a run |
| --- | --- |
| 26.11.05 | The seven conversion and crop tutorials write Zarr3 by default. Pass `--zarr-format 2` for a v2 output. |
| 26.11.02 | Prediction recovery checks completed chunks. Funke graph state is tied to its inputs and config. See [migration notes]({{ "/en/audit/" | relative_url }}) before continuing an older run. |
| 26.10.28 | Added shared Zarr2/Zarr3 I/O, including WEBKNOSSOS bounding boxes, axes, scales and label IDs. See [Zarr formats and coordinates]({{ "/en/zarr/" | relative_url }}). |
| 26.10.23 | Mito accepts raw and labels stored in XYZ or ZYX and restores output to the original axes. |
| 26.10.22 | Added `connectio-mito` and the bundled joint step-2000 weights for mitochondrial instance segmentation. |
| 26.10.13 | Added config generation and inference-only inspection for Spider, DigSpider, joint LSD/ACRLSD and paired Synful. |
| 26.10.04 | Added indexed training recovery, prediction signatures, bounded resampling, disk-backed evaluation, batched inference and optional CUDA mixed precision. |
| 26.09.23 | Compute APIs default to Slurm. Neuron segmentation stages can be submitted and reviewed independently. |
| 26.07.29 | Interactive Slurm viewers print SSH tunnel instructions and read large Zarr volumes lazily. |
| 0.1.7 | Fixed HDF5-to-Zarr conversion. |
| 0.1.6 | Fixed lazy viewer lifecycle and added bounded streaming for Precomputed imports. |
| 0.1.5 | Added threaded Precomputed reads, Zarr-to-Precomputed export and PNG stacks. |
| 0.1.4 | Added ImageJ hyperstack TIFF and channel splitting. |
