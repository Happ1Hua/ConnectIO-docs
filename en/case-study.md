---
layout: default
title: The digspider experiment
lang: en
permalink: /en/case-study/
---

# digspider: a scale change and an affinity error

A pure-translation alignment broke down near slice 461. Later, an affinity model learned to connect voxels across membranes. Both problems appeared in a single digspider run, at different steps. Comparing each intermediate output with the source made it possible to separate the two.

## A scale change halfway through the stack

The acquisition contained 1,006 uint8 TIFFs of 3072 × 2048 pixels. Every one of the 6,329,204,736 voxels matched after conversion to XYZ Zarr. The TIFFs reported 7.8125 nm in XY. The experiment used the operator-confirmed 8 nm isotropic spacing without resampling the source.

The stack was normalized and processed with CLAHE (clip limit 1.5, grid 16). Local bright spots and vertical stripes were already present in the acquisition. Near slice 461 the section scale changed. Phase correlation alone could not register that pair. Using constrained ORB/RANSAC at discontinuities aligned the stack through section 1006. Pair transforms accumulated to slice zero, and each original image was interpolated once.

## Why the training loss was misleading

Starting from Spider weights, the experiment fine-tuned LSD for 20,000 steps and ACRLSD for 5,000 on digspider annotations. The XY affinities were high even across boundaries. The training code had treated a nonzero label as the condition for *valid supervision*. That excluded zeros introduced at boundaries. The model could lower its loss by predicting connections where a negative edge should have been scored.

The correction used endpoint masks to determine validity and equal, nonzero labels to define a positive target. With the neighbour halo restored and weights balanced across channels, targets, masks and weights matched Gunpowder on the annotated region. Both models were retrained from the baseline.

## What the reviewers opened next

The new affinity crop aligned with its source raw in Neuroglancer. Review then proceeded through watershed fragments, agglomeration, threshold LUTs and final labels. Changing watershed polarity had helped locate the fault during diagnosis. The retrained affinity model supplied the production input.

The original images, annotations and run records are held outside the public documentation. For a new specimen, follow the [TIFF procedure]({{ "/en/modules/" | relative_url }}) and [affinity review]({{ "/en/lsd-guide/" | relative_url }}) with your own coordinates and checkpoints.
