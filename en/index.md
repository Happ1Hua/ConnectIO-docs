---
layout: default
title: User manual
lang: en
permalink: /en/
---

# ConnectIO user manual

For a first cluster job, convert the four sample PNG slices to Zarr. This checks the browser connection, the Slurm submission and access to the output before you bring in a specimen or model. Follow *Try the four-slice example* in the [GUI workbench]({{ "/en/gui/" | relative_url }}). For a Linux workstation or a Python session, start with [install and convert a stack]({{ "/en/getting-started/" | relative_url }}).

## Start with the data you have

| Starting material | Where to go |
| --- | --- |
| A new TIFF stack | Check slice order and brightness before choosing normalization, CLAHE or registration. See [prepare a TIFF stack]({{ "/en/modules/" | relative_url }}). |
| Aligned slices, HDF5 or Precomputed | Choose a converter, then check voxel size and origin against the source. See [format conversion and cropping]({{ "/en/formats/" | relative_url }}). |
| A raw Zarr and model weights | Generate an inference config and check that the weights and voxel grid match. See [weights and inference configs]({{ "/en/models/" | relative_url }}). |
| Neuron affinities or fragments | Pick up at the stage that consumes them. Later steps also need the merge graph. See [neuron segmentation stages]({{ "/en/pipeline/" | relative_url }}). |

## Choose an output

- **Neuron instances.** LSD and ACRLSD predict shape descriptors and affinities. Watershed and graph merging turn them into labels. See [from affinities to labels]({{ "/en/lsd-guide/" | relative_url }}).
- **Mitochondrial instances.** Mito predicts foreground and contours on its model grid and restores the labels to the source grid. See [mitochondrial segmentation]({{ "/en/mito/" | relative_url }}).
- **Synaptic partners.** Synful predicts postsynaptic sites and displacements to presynaptic partners. Export the pairs as CSV or WEBKNOSSOS skeletons for review. See [synapse detection]({{ "/en/synful/" | relative_url }}).

For an example of what to look for during review, the [digspider experiment]({{ "/en/case-study/" | relative_url }}) traces a registration failure near slice 461 and an affinity training run whose loss concealed a target error.
