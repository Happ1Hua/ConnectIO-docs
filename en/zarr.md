---
layout: default
title: Zarr2 and Zarr3 compatibility
lang: en
permalink: /en/zarr/
---

# Zarr2 and Zarr3 in 26.10.28

Connectio detects local directory-backed Zarr2 and Zarr3 inputs automatically.
Zarr2 retains the installed `zarr<3` implementation; Zarr3 uses TensorStore,
including WEBKNOSSOS `sharding_indexed`, transpose, bytes, zstd and checksums.
No global patch or upgrade of third-party Zarr is required.

## Coverage

| Workflow | Zarr3 behavior | Existing Zarr2 behavior |
| --- | --- | --- |
| PNG, TIFF stack, 3D TIFF, hyperstack, TXM, HDF5, WKW annotation, precomputed → Zarr | Select v3 output explicitly | Python API default remains v2; tutorials default to v3 |
| Zarr → HDF5, WKW, precomputed, WEBKNOSSOS | Read arrays/layers and preserve declared geometry | Existing inputs remain supported |
| Crop, rotation, up/downsampling | Read/write v3; use a separate output for registered WK arrays | Existing array processing and recovery remain supported |
| LSD/ACRLSD training, inference, evaluation and model preflight | Shared reader, v3 prediction output and configurable training dataset paths | Original dataset names and v2 output remain defaults |
| Funke watershed, agglomeration, LUT and segmentation | Daisy adapter supports v3 arrays and world-coordinate ROIs | Native legacy Daisy v2 path retained |
| Mito preparation, training data, prediction, watershed, native export and evaluation | Shared reader/writer and XYZ/ZYX metadata | Existing axis validation and model-grid requirements retained |
| Synful training, prediction/resume, extraction, evaluation and CSV/NML exports | WK XYZ input becomes a bounded ZYX view; v3 prediction chunks are integrity-checked | Existing ZYX/HDF5 and v2 prediction behavior retained |
| Neuroglancer, synapse overlays, LSD viewer, precomputed export | Metadata-aware lazy reader with magnitude selection | Same entry points |
| TIFF preprocessing/alignment, NML merging and checkpoint conversion | These operations do not read or write Zarr | Their native formats and interfaces remain unchanged |

## Select output format

```python
from connectio.conversion import tiff_stack_to_zarr

tiff_stack_to_zarr("input-tiffs", "new-output.zarr", zarr_format=3, backend="local")
```

All decorated workflow APIs accept `zarr_format=2` or `3`; CLI launchers accept
`--zarr-format 3`, including when submitting through Slurm. Model JSON configs
can set top-level `"zarr_format": 3`. Native Funke stage configs accept the same
field. `CONNECTIO_ZARR_FORMAT=3` provides a process-wide default; use
`connectio.zarr_io.output_format(3)` for a scoped Python default.

Existing stores retain their format. A context/environment default does not
silently migrate an existing v2 root. Write to a new output directory when a
format change is desired. Appending with an explicit conflicting format is an
error. New v3 outputs use ordinary numeric Zarr3 arrays; they are **not**
automatically registered WEBKNOSSOS datasets. Use the existing WEBKNOSSOS export
stage to generate `datasource-properties.json`, magnifications and attachments.
The existing `zarr2_to_zarr3` API name is retained and now also accepts v3 source
arrays when re-exporting a layer.

## Tutorial output selection (26.11.05)

`tiff_to_zarr.py`, `png_stack_to_zarr.py`, `txm_to_zarr.py`, `hdf5_to_zarr.py`,
`wkw_to_zarr.py`, `precomputed_to_zarr.py`, and `crop_zarr.py` accept
`--zarr-format {2,3}` and default to **Zarr3** for new outputs. Edit example
paths before running. The script constant `ZARR_FORMAT = 3` sets its default;
an explicit command-line option takes precedence.

```bash
export CONNECTIO_EXECUTION_BACKEND=local
python tutorials/tiff_to_zarr.py                  # Zarr3 by default
python tutorials/tiff_to_zarr.py --zarr-format 2  # Zarr2
```

This tutorial default is separate from the Python API default of Zarr2. Appending
to an existing store requires its actual format; select a new output directory
to change formats. Rotation/resampling scripts inherit their existing container's
format. Dedicated WEBKNOSSOS export produces Zarr3, and downsampling adds
magnifications to an existing dataset. HDF5/WKW/precomputed exports and viewers
keep their own output formats.

See [tutorial format validation]({{ "/validation/tutorial-formats-26.11.05.json" | relative_url }}).

## WEBKNOSSOS input and coordinates

Use a dataset root plus an array path such as `color/1`, `segmentation/4` or a
layer name to select its finest available magnitude. The reader removes global
padding using the layer bounding box, preserves the physical origin, converts
scale units to nm, follows `dimension_names` / `axisOrder` and removes a singleton
channel. Non-spatial arrays and attachments are not exposed as image volumes.

The logical origin is local index zero at the cropped ROI; `offset` is its
physical position in nm. Coarse magnifications round the bounding box outward to
their voxel grid. Generic arrays retain their stored axes and `resolution` /
`offset` attributes. Model resolution, axis and aligned-supervision checks still
apply: format support does not rescale a volume to a checkpoint's required grid.

Crops use XYZ voxel ranges local to the logical ROI unless an explicit voxel
`offset` is supplied. Crop/rotate normalize declared axes to (C)XYZ; resampling
uses XYZ. Registered WEBKNOSSOS arrays must use a different output dataset for
rotation/resampling, because replacing their shape would invalidate dataset-wide
metadata. Sources are not rewritten to normalize coordinates.

LSD training keeps the existing default paths. Override them explicitly for WK
or custom layouts (a genuine supervised mask is still required):

```json
{
  "samples": ["/path/to/dataset"],
  "datasets": {"raw": "color/1", "labels": "segmentation/1", "mask": "mask/1"},
  "zarr_format": 3
}
```

Synapse CSV coordinates remain global XYZ nm. `voxel_size` in the synapse viewer
and precomputed exporter is a fallback when metadata is missing, not an override
of WEBKNOSSOS scale. Native Synful training/annotation coordinates remain ZYX nm.

## Scope and validation

The v3 writer supports fixed-width numeric/boolean arrays and the existing
Blosc, zstd and gzip compressor choices (legacy zlib requests use gzip at the same DEFLATE level). Variable-length strings, objects,
structured dtypes and arbitrary Zarr2 filters are rejected explicitly rather
than silently changed. Existing v2 support for these types is unaffected.
Remote/object-store URLs are not added by this release. Rotation retains its
existing whole-volume RAM requirement. Native WKW export retains its existing
memory behavior. Precomputed export remains single-channel.

For legacy Conda MKL/OpenMP environments, set `MKL_THREADING_LAYER=GNU` when using spawned DataLoader workers.

Run `python -m pytest tests -q` in an environment with the scientific, conversion
and legacy Funke dependencies. Model regressions execute both formats through
`dual_zarr`; tests cover actual pixel/label parity, physical metadata, resume
checks and output isolation. `CONNECTIO_RUN_FUNKE_SMOKE=1` additionally runs real
MongoDB/Daisy/Funke postprocessing for both formats. Local production workspaces
are excluded by `pytest.ini`. See [validation evidence]({{ "/validation/zarr3-26.10.28.json" | relative_url }})
and the repository `tests/README.md` for commands and runtime limits. CPU tests do
not claim full-volume GPU performance or full retraining equivalence.
