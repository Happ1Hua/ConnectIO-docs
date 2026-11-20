---
layout: default
title: Conversion, crop and resampling
lang: en
permalink: /en/formats/
---

# Convert a volume and check its coordinates

`raw.zarr` is the directory on disk. `volumes/raw` is an array inside it. Before conversion, write down the source voxel size, origin and axis order. You will need those values again to put labels or synapses back on the raw image.

| Format | Direction | Main entry points |
|---|---|---|
| TIFF | stack/3-D/hyperstack → Zarr; stack → 3-D TIFF | `tiff_stack_to_zarr`, `tiff_3d_to_zarr`, `hyperstack_tiff_to_zarr`, `tiff_stack_to_3d_tiff` |
| PNG | slice stack → Zarr | `png_stack_to_zarr` |
| ZEISS TXM | TXM → Zarr | `txm_to_zarr` |
| HDF5 | HDF5 ↔ Zarr | `hdf5_to_zarr`, `zarr_raw_to_hdf5_xyz` |
| WEBKNOSSOS | WKW/ZIP ↔ Zarr; Zarr2 → ready-to-open Zarr3 dataset; official CLI downsampling | `wkw_to_zarr`, `zarr_to_wkw`, `zarr2_to_zarr3`, `downsample_webknossos_layer` |
| Neuroglancer | precomputed ↔ Zarr | `precomputed_to_zarr`, `zarr_to_precomputed` |

## Convert aligned TIFFs

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    "aligned", "raw.zarr", dataset_name="volumes/raw",
    resolution=(8, 8, 8), offset=(0, 0, 0), zarr_format=3,
)
```

Replace the 8 nm spacing and zero origin with your measurements. This call submits a CPU job under the default cluster backend. The TIFF-stack reader takes `.tif` files in filename order. Zero-pad the indices so slice 2 sorts before slice 10. A source plane stored as YX becomes `raw[x,y,z]`. Compare a slice and an identifiable landmark after conversion. For HDF5, inspect metadata on the actual array as well as the root.

## Crop a region for a trial

```python
from connectio.processing import crop_zarr

crop_zarr(
    "raw.zarr", "roi.zarr", dataset_path="volumes/raw",
    crop_bbox_xyz=((0, 1000), (0, 1000), (0, 500)),
    backend="local",
)
```

With at least 1000 × 1000 × 500 voxels, the example takes exactly that many from the beginning of the XYZ volume. Upper bounds are exclusive. The optional crop `offset` is in voxel indices. Check the resulting shape and the **physical** origin in the output attributes, especially if your source is a subvolume.

## Rotate or change voxel size

- `rotate_zarr` applies integer quarter-turns, permutes spacing and updates the lower corner to keep the physical centre fixed when origin metadata is present. A rotation may use memory for the whole array.
- `resample_zarr` accepts either `target_resolution` or `scale_factors`. Use linear interpolation for intensity and `interpolation="nearest"` for integer labels. Choose a distinct `output_dataset_name` to keep the source array.
- For a wide Precomputed source, `mode="large"` tiles XY and limits each spatial read to 128 MiB. `small` uses full-XY slabs and parallel read-ahead. Set `mode=None` to tune `max_batch_bytes`, `max_workers` or `xy_tile` yourself.

To deliver a WEBKNOSSOS dataset, export each layer with `zarr2_to_zarr3`. Use `category="color"` for raw and `"segmentation"` for labels. Add layers sequentially so the root `datasource-properties.json` includes them all. Use `downsample_webknossos_layer` to add magnifications. Details on existing stores, axes and bounds are in [Zarr formats and coordinates]({{ "/en/zarr/" | relative_url }}).
