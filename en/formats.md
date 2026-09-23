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
| WebKnossos | WKW/ZIP ↔ Zarr | `wkw_to_zarr`, `zarr_to_wkw` |
| Neuroglancer | precomputed ↔ Zarr | `precomputed_to_zarr`, `zarr_to_precomputed` |

```python
from connectio.conversion import tiff_stack_to_zarr

job = tiff_stack_to_zarr(
    input_folder="path/to/tiffs",
    output_zarr_path="output.zarr",
    output_dataset_path="volumes/raw",
    resolution=(8, 8, 8),
)
```

PNG and TIFF folder readers use natural slice order. Multi-channel PNG/hyperstack input writes separate layer datasets. TXM conversion supports process-based parallel decoding. WKW export is suitable for WebKnossos segmentation layers. HDF5 export can transpose ZYX Zarr input into the XYZ convention expected by another pipeline.

## Precomputed memory modes

| Preset | Read size | Workers/read-ahead | Use |
|---|---|---|---|
| `small` | full-XY slabs | up to 8 / 4 | volumes comfortably fitting RAM |
| `large` | at most 128 MiB per spatial read | 1 / 1 | TB-scale or wide-XY volumes |

`large` automatically tiles XY when a slab exceeds the byte budget. For custom behavior use `mode=None` with `max_batch_bytes`, `max_workers`, `read_ahead`, and optional `xy_tile`.

## Processing

`crop_zarr`, `rotate_zarr`, and resampling functions operate on 3-D XYZ or supported channel-first volumes and update spatial metadata. Rotation uses integer quarter-turns. Resampling accepts target physical resolution or scale factors. `merge_nml_files` combines skeleton annotations while resolving node-ID conflicts. See the executable files under `tutorials/` for complete Slurm-first calls.
