---
layout: default
title: Install and convert a stack
lang: en
permalink: /en/getting-started/
---

# Install and convert a stack

This first conversion runs on a CPU and takes four small PNG files from the GUI package. For the browser version of the same exercise, see the [GUI workbench]({{ "/en/gui/" | relative_url }}).

## Install from the source checkout

Use a Python environment on Linux. The GUI and its sample images are included on the [GUI branch of ConnectIO](https://github.com/Happ1Hua/ConnectIO/tree/codex/connectio-gui-v1). From the root of that checkout, run:

```bash
python -m pip install -e .
connectio-gui --help
```

On a cluster, the compute nodes need to be able to read the installation, the input and the output directory. Run the example below in a CPU allocation or on a workstation.

## Read back the result

```python
from pathlib import Path
from tempfile import mkdtemp

import connectio.gui
from connectio import zarr_io
from connectio.conversion import png_stack_to_zarr

slices = Path(connectio.gui.__file__).parent / "examples" / "png-stack"
output = Path(mkdtemp()) / "example.zarr"
png_stack_to_zarr(str(slices), str(output), zarr_format=3, backend="local")
raw = zarr_io.open_group(str(output), mode="r")["volumes/raw"]
print(output, raw.shape, raw.dtype, list(raw.attrs["axes"]))
```

Expect `(32, 32, 4)`, `uint8` and `['x', 'y', 'z']`. Each increment in the last index moves to the next PNG. The example prints its temporary output path and creates a fresh one on each run. For your own stack, use a permanent output location and supply the measured `resolution` and `offset`.

## Add the dependencies for your experiment

| Work | Install in the environment that runs the job |
| --- | --- |
| Conversion, TIFF processing and alignment | Base install above |
| LSD / ACRLSD | `python -m pip install -e '.[segmentation]'` |
| Mito | `python -m pip install -e '.[mito-pytorch]'` |
| Synful | `python -m pip install -e '.[synful-pytorch]'` |

Use a PyTorch build compatible with the compute node for GPU prediction. The fragment and graph stages also need the legacy Daisy/Funke packages listed in `requirements-segmentation.txt` and access to MongoDB. See [local and Slurm execution]({{ "/en/slurm/" | relative_url }}) for cluster environments and worker setup.

For another local computation, pass `backend="local"` or set `CONNECTIO_EXECUTION_BACKEND=local` in the shell. With the default Slurm backend, a call made outside an allocation returns a job ID. Read its logs after it runs.
