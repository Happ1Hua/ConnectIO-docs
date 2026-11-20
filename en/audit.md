---
layout: default
title: Migration notes
lang: en
permalink: /en/audit/
---

# Reusing results from before 26.11.02

When moving an experiment to a newer installation, keep its raw data, configuration, checkpoint and outputs. The following changes affect whether an old run can continue in place.

| Existing result | What to do |
| --- | --- |
| Partial LSD or Mito prediction | Old completion records without content digests need a new output. Current records check that completed chunks still exist and match their digests. |
| Funke graph database | Use a new database and output if the old state lacks input/config identity. For cross-node workers supply an authenticated MongoDB service. Local workers can use loopback. |
| LUTs generated with fractional percentages | Threshold and step must fall on the 0.01 grid. Regenerate a LUT if its old filename resulted from truncation. |
| Synful training near a crop edge | The default sampler requires context within raw. To reproduce edge padding explicitly, set `training.allow_context_padding=true` and check raw and labels still cover the same physical ROI. |
| Normalized or CLAHE TIFF stack | Choose an output folder separate from the source. The processed stack and QC are published together. |
| Interrupted rotation | Look for the preserved `.backup-*` directory if interruption occurred while installing the result. Keep the backup until you have inspected the destination. |

## What was checked

The recorded suite ran 400 tests, including a small MongoDB/Daisy/Funke workflow. Checks included missing or changed prediction chunks, interrupted writes and exports, NML references, all six axis permutations, and sparse uint64 labels. The record covers local runs. Cross-node operation and recovery after power failure require separate verification. [26.11.02 validation record]({{ "/validation/audit-26.11.02.json" | relative_url }})
