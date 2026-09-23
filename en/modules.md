---
layout: default
title: Modules and tutorials
lang: en
permalink: /en/modules/
---

# Modules and tutorials

## Conversion and processing

ConnectIO converts TIFF, PNG, TXM, HDF5, WKW, and Neuroglancer precomputed volumes to or from Zarr. Processing helpers crop, rotate, and resample Zarr volumes. Conversion functions stream data where possible and preserve spatial metadata. For a lossless TIFF conversion, verify slice order, shape, dtype, hashes or voxel equality, and write `resolution`/`offset` explicitly.

## Preprocessing

TIFF tools provide QC, normalization, and CLAHE. QC reports per-slice statistics, intensity trends, and candidate discontinuities without changing pixels. Normalization and CLAHE must be reviewed separately; acquisition artifacts such as local bright spots and vertical stripes should be documented rather than mistaken for processing failures. CLI entry points are `connectio-tiff-check`, `connectio-tiff-normalize`, and `connectio-tiff-clahe`.

## Alignment

`connectio-align` and `align_folder_pairwise` support phase correlation, ECC, and ORB registration. Pairwise transforms are accumulated to the first slice while each source image is interpolated once. Inspect cumulative drift, overlap, invalid borders, and XZ/YZ continuity. Registration scores do not replace visual review.

## Visualization

Neuroglancer scripts are manual Slurm launchers. Set the Zarr path and dataset, start the script, wait for its connection record, create the printed SSH tunnel locally, and open the local URL. Scalar raw data and channel-first affinity data require different shader/range handling. Viewer scripts are not compute functions and were not converted to the generic submitter.

## Tutorial index

The `tutorials/` directory contains one-file examples for TIFF/PNG/TXM to Zarr, HDF5 and WKW interchange, precomputed conversion, crop, resample, rotate, NML merge, TIFF preprocessing, TIFF alignment, LSD inference, and Neuroglancer viewing. Each compute example defines `SLURM_OPTIONS`, calls the real ConnectIO function, and prints the job record. When two examples write the same Zarr, add an `afterok` dependency.

The Python API can also submit an import path without importing imaging dependencies on the login node:

```python
from connectio.execution import submit_function

job = submit_function(
    "connectio.processing.crop", "crop_zarr",
    kwargs={"input_zarr_path": "/data/in.zarr", "output_zarr_path": "/data/out.zarr"},
    resource="cpu",
)
```
