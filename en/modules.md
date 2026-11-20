---
layout: default
title: Prepare a TIFF stack
lang: en
permalink: /en/modules/
---

# Prepare a TIFF stack for segmentation

Keep the acquired slices in `source_tiffs/` and choose a separate output directory for each operation below. The example uses Slurm. Wait for each job and inspect its output before issuing the next command. On a workstation set `CONNECTIO_EXECUTION_BACKEND=local` first. The same operations are available in the [GUI workbench]({{ "/en/gui/" | relative_url }}).

## Check the stack before adjusting brightness

```bash
connectio-tiff-check --input source_tiffs --output qc
```

Open `qc/z_intensity_trends.png`. If the mean jumps at a particular slice, look up that slice in `per_slice_qc.csv` and inspect the image. Stripes confined to part of a field may still be visible after matching the overall brightness. Keep `summary.json` as a baseline.

## Normalize, then choose a contrast setting

```bash
connectio-tiff-normalize --input source_tiffs --output normalized \
  --method robust-z-no-clip --z-window 21
```

Compare the processed slices in `normalized/tiffs/` with the original. The example uses a 21-slice window. If you also need local contrast enhancement, run a CLAHE pilot on this output.

```bash
connectio-tiff-clahe pilot --input normalized/tiffs --output clahe_pilot \
  --candidates 1.5:16,2.0:16,2.0:30
```

Inspect the comparison images for membrane contrast and amplified noise. The following command uses clip limit 1.5 and a 16-cell grid. Substitute the pair you selected in the pilot.

```bash
connectio-tiff-clahe apply --input normalized/tiffs --output clahe \
  --clip-limit 1.5 --grid-size 16
```

## Align the accepted slices

```bash
connectio-align --input clahe/tiffs --output aligned --method phase
```

Use the directory from the last step you actually ran. Phase correlation estimates translations. For more complex motion, `ecc` and `orb` are also available. Check `aligned/alignment_report.json` for cumulative drift, then inspect the borders and continuity in XZ and YZ. The aligned TIFFs are directly in `aligned/`. Use this folder as input to [TIFF-to-Zarr conversion]({{ "/en/formats/" | relative_url }}).

## Other scripts in the checkout

| Task | Example |
|---|---|
| TIFF/PNG/TXM and hyperstack ingestion | `tiff_to_zarr.py`, `png_stack_to_zarr.py`, `txm_to_zarr.py` |
| HDF5 and WKW interchange | `hdf5_to_zarr.py`, `zarr_to_hdf5.py`, `wkw_to_zarr.py`, `zarr_to_wkw.py` |
| Neuroglancer precomputed | `precomputed_to_zarr.py`, `neuroglancer_generate_precompute_format.py` |
| Crop, rotation, resampling | `crop_zarr.py`, `rotate_zarr.py`, `resample_zarr.py` |
| TIFF QC and alignment | `tiff_preprocessing.py`, `align_tiffs.py` |
| LSD inference and viewing | `lsd_inference.py`, `neuroglancer_view_zarr.py` |
| Skeleton annotations | `merge_nmls.py` |

The [tutorial directory](https://github.com/Happ1Hua/ConnectIO/tree/main/tutorials) contains editable examples. Set your paths and resources before running them. For Zarr, HDF5, Precomputed or synapse overlays, select the corresponding `neuroglancer_view_*` script. Follow its tunnel instructions from your computer. For channel-first affinities, check each direction separately.
