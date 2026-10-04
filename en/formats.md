---
layout: default
title: Formats and volume operations
lang: en
permalink: /en/formats/
---

# Formats and volume operations

Zarr is the primary volume format. TIFF/PNG/TXM ingestion writes XYZ arrays; specific learning workflows may use ZYX and must record the conversion explicitly. Always store three-element `resolution` and `offset` metadata.

| Format | Direction | Main entry points |
|---|---|---|
| TIFF | stack/3-D/hyperstack → Zarr; stack → 3-D TIFF | `tiff_stack_to_zarr`, `tiff_3d_to_zarr`, `hyperstack_tiff_to_zarr`, `tiff_stack_to_3d_tiff` |
| PNG | slice stack → Zarr | `png_stack_to_zarr` |
| ZEISS TXM | TXM → Zarr | `txm_to_zarr` |
| HDF5 | HDF5 ↔ Zarr | `hdf5_to_zarr`, `zarr_raw_to_hdf5_xyz` |
| WebKnossos | WKW/ZIP ↔ Zarr; Zarr2 → ready-to-open Zarr3 dataset; official CLI downsampling | `wkw_to_zarr`, `zarr_to_wkw`, `zarr2_to_zarr3`, `downsample_webknossos_layer` |
| Neuroglancer | precomputed ↔ Zarr | `precomputed_to_zarr`, `zarr_to_precomputed` |

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    input_folder="path/to/tiffs",
    output_zarr_path="output.zarr",
    dataset_name="volumes/raw",
    resolution=(8, 8, 8),
)
```

PNG and TIFF folder readers currently sort by filename. Zero-pad numeric slice names (for example `slice_0002.tif`, `slice_0010.tif`) or verify the resulting order; names such as `slice_10` sort before `slice_2`. Multi-channel PNG/hyperstack input writes separate layer datasets. TXM conversion supports process-based parallel decoding. WKW export is suitable for WebKnossos segmentation layers. The `zarr_raw_to_hdf5_xyz` helper specifically transposes a ZYX Zarr input into XYZ HDF5 for a different pipeline.

`zarr2_to_zarr3` converts one selected 3D `source_dataset` per call: use `category="color"` for raw or `category="segmentation"` for labels. Repeated calls to the same `output_dataset_path` add layers and update its root `datasource-properties.json`. Set `axes` to specify the source array order; provide `voxel_size` and `offset` when the source lacks `resolution` and `offset` attributes. It submits through Slurm by default; see `tutorials/zarr2_to_zarr3.py`.

For multiple magnifications, set `downsample_coarsest_mag=32` during conversion, or call `downsample_webknossos_layer(dataset_path, layer_name="segmentation", coarsest_mag=32)` on an existing dataset. It invokes the official WEBKNOSSOS CLI for only the selected layer and can submit through Connectio's Slurm wrapper. Agglomerate references are retained when older CLI versions rewrite metadata; new magnifications inherit the existing mag's read permissions without broadening dataset access.

## Precomputed memory modes

| Preset | Read size | Workers/read-ahead | Use |
|---|---|---|---|
| `small` | full-XY slabs | up to 8 / 4 | volumes comfortably fitting RAM |
| `large` | at most 128 MiB per spatial read | 1 / 1 | TB-scale or wide-XY volumes |

`large` automatically tiles XY when a slab exceeds the byte budget. For custom behavior use `mode=None` with `max_batch_bytes`, `max_workers`, `read_ahead`, and optional `xy_tile`.

## Processing

`crop_zarr`, `rotate_zarr`, and resampling functions operate on 3-D XYZ or supported channel-first volumes and update spatial metadata. Rotation uses integer quarter-turns. Resampling accepts target physical resolution or scale factors. `merge_nml_files` combines skeleton annotations while resolving node-ID conflicts. See the executable files under `tutorials/` for complete Slurm-first calls.

## Axis, metadata, and overwrite checklist

A Zarr path points to a store; a dataset path such as `volumes/raw` identifies an array inside it. Record the **actual array order** next to the three `resolution` and `offset` values. The TIFF/PNG stack converters write `(X, Y, Z)`, transposing each source `(Y, X)` image. LSD and Synful training paths may expect ZYX; changing attribute names alone does not transpose voxels. Check shape, a known landmark, and orthogonal views before passing one workflow's output to another.

The TIFF and PNG stack converters open the output Zarr root in write mode, replacing an existing root at that path. `hdf5_to_zarr` also opens its destination in write mode. Use a new output store when preserving an existing result. `precomputed_to_zarr` instead refuses to replace an existing target dataset unless its `overwrite` option is enabled. Inspect the destination before a large conversion and do not run two writers on the same store.

Metadata should be checked at the **dataset level**, not only at the group root. The HDF5 converter copies source groups and dataset attributes and can additionally place requested `resolution` and `offset` on the root; downstream readers may require these attributes on a particular array. Inspect the actual result with Zarr or the target viewer before treating the conversion as finished.

## Choose a conversion path

| Source | Use | Particular check |
|---|---|---|
| Numbered 2-D TIFF/PNG files | `tiff_stack_to_zarr` / `png_stack_to_zarr` | Filename order, transposed XY plane, dtype, multi-channel layer names. |
| 3-D or ImageJ hyperstack TIFF | `tiff_3d_to_zarr` / `hyperstack_tiff_to_zarr` | Stack/channel interpretation and destination dataset names. |
| HDF5 hierarchy | `hdf5_to_zarr` | Dataset tree, attributes, chunking, and shape. |
| Local Neuroglancer precomputed | `precomputed_to_zarr` | Resolution, Zarr v2 output, memory mode, and sample voxel equality. |
| Zarr for Neuroglancer or WKW | `zarr_to_precomputed` / `zarr_to_wkw` | XYZ input layout, voxel size, layer type, and known coordinates. |

For a precomputed source, an independently submitted CPU conversion can be written as:

```python
from connectio.conversion import precomputed_to_zarr

job = precomputed_to_zarr(
    "source_precomputed", "raw.zarr", "volumes/raw",
    resolution=(8, 8, 8), mode="large",
)
print(job.job_id, job.stdout)
```

The example paths are placeholders. `mode="small"` uses full XY slabs with parallel read-ahead; `mode="large"` caps an individual spatial read at 128 MiB, uses one reader, and tiles XY when needed. To tune `max_batch_bytes`, `max_workers`, `read_ahead`, or `xy_tile` yourself, leave `mode=None` because presets override those knobs.

## Crop, rotate, and resample safely

`crop_zarr` takes a `crop_bbox_xyz` of X/Y/Z start/end pairs, a `dataset_path`, and an optional separate `output_dataset_path`. Its `offset` argument shifts the requested coordinate ranges before indexing, while `resolution` is used to update saved metadata. Check the resulting shape and physical origin. The function refuses an existing destination dataset.

`rotate_zarr` accepts 90° quarter-turn counts around lab X, Y, and Z, applied in `apply_order` (default `xyz`). It supports 3-D XYZ and channel-first CXYZ. A rotation updates the `resolution` ordering; when an `offset` attribute exists, the implementation resets it to `[0, 0, 0]`. Re-establish the intended world origin before overlaying the result with another volume.

`resample_zarr` accepts either `target_resolution` or `scale_factors` and uses linear interpolation. Supply `output_dataset_name` when preserving the input; without it, rotate/resample operate on the input dataset. Use linear interpolation for continuous intensity fields; for categorical segmentation labels, set `interpolation="nearest"` to preserve IDs exactly. Verify physical extent, shape, resolution, and data range after processing.

## Verification and troubleshooting

Before deleting or replacing a source, compare a small set of exact voxel coordinates and at least one full slice; check shape, dtype, channel count, `resolution`, and `offset`. A visually plausible XY view can still hide a reversed Z order or swapped axes. If a conversion stops partway through, inspect whether the output store is incomplete; select a fresh destination for a clean rerun unless the particular converter documents restart behavior.

See [code optimization and resource controls]({{ "/en/optimization/" | relative_url }}) for the 2026-10-04 training recovery, input/output identity, streaming resampling, evaluation memory and pipelined inference update.
