---
layout: default
title: User manual
lang: en
permalink: /en/
---

# ConnectIO documentation

ConnectIO turns electron microscopy stacks into volumes you can inspect in Neuroglancer or WEBKNOSSOS. From an aligned volume you can segment neurons, label individual mitochondria or detect synaptic partners. Each model has its own inputs and can be run independently.

## Getting started

On a Linux workstation, [install and convert a stack in Python]({{ "/en/getting-started/" | relative_url }}). On a Slurm cluster, [submit the sample job from the GUI]({{ "/en/gui/" | relative_url }}). Both tutorials use four bundled PNG slices and produce the same 32 × 32 × 4 array.

## Modules

| Module | Start here | Design choices |
| --- | --- | --- |
| Volume preparation | [Inspect and align a TIFF stack]({{ "/en/modules/" | relative_url }}), then [convert or crop the volume]({{ "/en/formats/" | relative_url }}). | [When to apply CLAHE]({{ "/en/modules/" | relative_url }}#design-choice) |
| Neuron segmentation · LSD / ACRLSD | [Choose the stage that matches your input]({{ "/en/pipeline/" | relative_url }}). If you already have affinities, [start with fragments and merging]({{ "/en/lsd-guide/" | relative_url }}). | [Which merge products to keep]({{ "/en/pipeline/" | relative_url }}#design-choice) |
| Mitochondrial segmentation · Mito | [Predict foreground and contours with the bundled checkpoint]({{ "/en/mito/" | relative_url }}). Use the restored instance labels for an overlay on the acquisition grid. | [Model grid or native grid]({{ "/en/mito/" | relative_url }}#design-choice) |
| Synapse detection · Synful | [Predict postsynaptic sites and partner vectors]({{ "/en/synful/" | relative_url }}). Inspect a region before exporting paired endpoints. | [When to filter partners]({{ "/en/synful/" | relative_url }}#design-choice) |

For a worked experiment, [the digspider case study]({{ "/en/case-study/" | relative_url }}) follows a registration failure near slice 461 and shows how an affinity training error appeared in the final fragments.
