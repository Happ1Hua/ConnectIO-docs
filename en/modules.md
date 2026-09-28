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
    kwargs={
        "input_zarr_path": "in.zarr",
        "output_zarr_path": "out.zarr",
        "dataset_path": "volumes/raw",
        "crop_bbox_xyz": ((0, 256), (0, 256), (0, 64)),
    },
    resource="cpu",
)
```

## A reviewable TIFF workflow

The TIFF preprocessing CLIs submit CPU work by default. Run one command, wait for its job to finish, review the result, and only then use its output as the next command's input:

```bash
connectio-tiff-check --input source_tiffs --output qc
connectio-tiff-normalize --input source_tiffs --output normalized \
  --method robust-z-no-clip --z-window 21
connectio-tiff-clahe pilot --input normalized/tiffs --output clahe_pilot \
  --candidates 1.5:16,2.0:16,2.0:30
connectio-tiff-clahe apply --input normalized/tiffs --output clahe \
  --clip-limit 1.5 --grid-size 16
```

The first command writes `summary.json`, `per_slice_qc.csv`, Z-intensity trends, and representative contact sheets. Normalization writes processed images under `normalized/tiffs/` plus per-slice gain/offset and before/after QC. `robust-z-no-clip` aims to avoid out-of-range pixels; `mean-std-clip` explicitly permits clipping and reports the count. The CLAHE `pilot` writes visual parameter comparisons without processing the full stack. The `apply` mode writes the selected full stack under `clahe/tiffs/` plus QC. The paths and parameter values above are examples; decide on a setting from the pilot and your raw-image review.

To align an accepted TIFF stack:

```bash
connectio-align --input clahe/tiffs --output aligned --method phase
```

`phase` estimates translations; `ecc` and `orb` can estimate more general transforms and fall back to phase when their result is rejected, unless `--no-fallback` is set. `aligned/alignment_report.json` records pairwise and cumulative matrices and registration metrics. Each aligned image is resampled once from its original source; inspect drift, missing borders, and XZ/YZ continuity before converting the aligned stack to Zarr. The [digspider case study]({{ "/en/case-study/" | relative_url }}) gives a concrete review example.

## Volume and annotation helpers

`connectio.conversion` includes TIFF, PNG, TXM, HDF5, WKW, hyperstack, and precomputed converters. `connectio.processing` includes `crop_zarr`, `rotate_zarr`, `resample_zarr`, `downsample_zarr`, `upsample_zarr`, and `merge_nml_files`. Their exact axis and overwrite behavior matters; see [formats and volume operations]({{ "/en/formats/" | relative_url }}). `connectio.alignment.emalignkit` exposes `register_pair` and `align_folder_pairwise` for Python workflows.

If two submitted jobs write to the same Zarr, serialize them with an explicit dependency or wait for the first result. A submitted function returns before its output is ready. Keep one run's paths, configs, reports, and review notes together, and use distinct output paths when comparing processing choices.

## Viewer workflow

The viewer examples in `tutorials/neuroglancer_view_zarr.py`, `neuroglancer_view_hdf5.py`, `neuroglancer_view_synapse.py`, and `neuroglancer_view_precomputed_http.py` configure interactive Slurm services. Edit their data paths, dataset names, site login address, local/remote ports, and resource settings before running a script in an interactive terminal. The launcher prints the job ID, follows its log, and shows an SSH tunnel command. Start that tunnel on your own computer and open the printed local URL. Ctrl+C in the launcher cancels its viewer job.

For large Zarr data, leave lazy viewing enabled unless the selected data can fit in the requested memory. Channel-first affinity arrays need a viewer layer or shader that selects a channel; a raw grayscale layer does not automatically display them correctly. Review known landmarks and all three orthogonal planes before accepting a coordinate mapping.

## Find an example by task

| Task | Example |
|---|---|
| TIFF/PNG/TXM and hyperstack ingestion | `tiff_to_zarr.py`, `png_stack_to_zarr.py`, `txm_to_zarr.py` |
| HDF5 and WKW interchange | `hdf5_to_zarr.py`, `zarr_to_hdf5.py`, `wkw_to_zarr.py`, `zarr_to_wkw.py` |
| Neuroglancer precomputed | `precomputed_to_zarr.py`, `neuroglancer_generate_precompute_format.py` |
| Crop, rotation, resampling | `crop_zarr.py`, `rotate_zarr.py`, `resample_zarr.py` |
| TIFF QC and alignment | `tiff_preprocessing.py`, `align_tiffs.py` |
| LSD inference and viewing | `lsd_inference.py`, `neuroglancer_view_zarr.py` |
| Skeleton annotations | `merge_nmls.py` |

Several examples contain site-specific data paths and resource values. Treat them as editable templates, then inspect the submitted job record and output. [Slurm execution]({{ "/en/slurm/" | relative_url }}) explains the common submission controls.
