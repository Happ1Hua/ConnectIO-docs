---
layout: default
title: Zarr formats and coordinates
lang: en
permalink: /en/zarr/
---

# Choose a Zarr format and locate the array

ConnectIO detects local directory-backed Zarr2 and Zarr3 on read. It reads v2 with `zarr<3` and v3 with TensorStore. For a new output, the default depends on the entry point.

| Operation | New output |
| --- | --- |
| Python conversion or crop | Zarr2 by default. Pass `zarr_format=3` for v3. |
| Conversion/crop tutorial or GUI template | Zarr3 by default. Set `--zarr-format 2` in the tutorial or select 2 in the form. |
| Rotation or resampling inside a store | Inherits the store format |
| WEBKNOSSOS layer export | Zarr3 plus the dataset metadata required by WEBKNOSSOS |

```python
from connectio.conversion import tiff_stack_to_zarr

tiff_stack_to_zarr("aligned", "new.zarr", zarr_format=3, backend="local")
```

For model or Funke stage JSON set `"zarr_format": 3`. `CONNECTIO_ZARR_FORMAT` supplies a process default. An explicit format must agree with an existing store. Choose a new directory to change format. The v3 writer supports fixed-width numeric/boolean arrays and Blosc, zstd and gzip compression. Use a compatible numeric representation before exporting object or variable-length data.

## Find a layer and its origin

A plain array such as `volumes/raw` has the axes and physical metadata recorded on that array. In a WEBKNOSSOS dataset choose a layer and magnification, for example `color/1` or `segmentation/4`. A bare layer name selects its finest available magnitude. The reader uses the bounding box to remove global padding, converts scale to nm and follows `dimension_names` or `axisOrder`. Coarser magnifications round the bounding box outwards to the voxel grid.

Index zero in this logical array is the start of its region. The physical `offset` locates that voxel in the specimen. Crop ranges use **XYZ voxel indices** relative to this region unless you supply a crop offset. For registered layers, give rotation or resampling a distinct output array. For a model with a different required spacing, resample deliberately.

## Use model and annotation coordinates

- LSD training can map `datasets.raw`, `datasets.labels` and `datasets.mask` to `color/1`, `segmentation/1` and a supervision mask. Verify all three cover the same physical region.
- Mito reads declared XYZ or ZYX and restores native labels to the original axes. Plain Synful arrays and training annotations use ZYX nm. WEBKNOSSOS inputs can be exposed to Synful as a bounded ZYX view.
- Read coordinate column names when importing CSV. Synful's pre/post columns name each physical axis. WEBKNOSSOS NML nodes use XYZ voxels at magnification 1. See [synapse export]({{ "/en/synful/" | relative_url }}) for origin and axis mapping.

Dual-format regression checks compare pixels, labels, physical origins and recovery. The tutorial checks also cover explicit format selection and appending to existing stores. [Zarr test record]({{ "/validation/zarr3-26.10.28.json" | relative_url }}) · [Tutorial format checks]({{ "/validation/tutorial-formats-26.11.05.json" | relative_url }})
