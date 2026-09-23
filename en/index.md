---
layout: default
title: English documentation
lang: en
permalink: /en/
---

# ConnectIO

ConnectIO provides reusable conversion, preprocessing, alignment, segmentation, and visualization workflows for connectomics volumes. Release **26.09.23** makes computation Slurm-first and exposes every segmentation phase as an independent submission.

## Documentation

- [Install and start]({{ "/en/getting-started/" | relative_url }}): environments, installation, and first submissions.
- [Raw-to-segmentation pipeline]({{ "/en/pipeline/" | relative_url }}): stage boundaries, review gates, and restart behavior.
- [Segmentation]({{ "/en/segmentation/" | relative_url }}): LSD/ACRLSD inference, Funke post-processing, configs, MongoDB state, and models.
- [Slurm execution]({{ "/en/slurm/" | relative_url }}): defaults, overrides, job handles, and cluster rules.
- [Modules and tutorials]({{ "/en/modules/" | relative_url }}): conversion, preprocessing, alignment, formats, visualization, and examples.
- [Formats and volume operations]({{ "/en/formats/" | relative_url }}): supported interchange formats, memory modes, and processing operations.
- [Changelog]({{ "/en/changelog/" | relative_url }}): current and historical releases.
- [digspider case study]({{ "/en/case-study/" | relative_url }}): the validated 8 nm workflow and affinity-supervision correction.

## Design rules

1. A compute entry point submits to Slurm by default; it never silently falls back to a login node.
2. Each scientific stage produces reviewable output and stops. The operator approves it before submitting the next stage.
3. Paths live in JSON configuration, and relative paths resolve from the configuration file, so a workflow can be moved as a unit.
4. A shared raw Zarr can be referenced by every stage without copying the volume.
5. Neuroglancer launchers keep their existing Slurm behavior and remain manual review tools.
