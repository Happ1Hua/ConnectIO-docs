---
layout: default
title: Review repairs and migration
lang: en
permalink: /en/audit/
---

# 26.11.02 review repairs

The supplied Kimi 3.1 Pro review claims 32 findings but contains 28 descriptions. High-priority entries 2, 3 and 5, and medium-priority entry 7 are blank. No reproducer can be inferred for these entries. The existing NML/CSV axis mapping passes asymmetric coordinates and anisotropic scales for all six axis permutations; this finding was not reproduced.

Repairs cover TIFF overwrite protection, private HTTP process ownership, restricted training checkpoint loading, chunk presence and content validation for LSD/Mito resume, temporary rotation outputs with rollback, input/config/version identity for Funke state, credential redaction and private worker configs, aligned Synful training ROIs, per-slice dtype/shape/channel checks, strict channel ranges, current multiscales metadata, center-preserving rotation geometry, HDF5 fallback axis conversion, global NMS plateau handling, sparse instance evaluation, complete preprocessing stack replacement, federated Slurm job IDs, NML group/branchpoint references, affinities `s0` resolution, exact threshold grid validation, dense-base provenance, checkpoint snapshots and source revision checks, and rollback of newly created agglomerate products. Zero rotations copy requested outputs, and alignment accepts PNG/JPEG inputs.

Storage and processing reject paths escaping through `..`, absolute child paths or symlinks. Automatically started MongoDB binds only to loopback. Distributed workers require an explicitly configured authenticated `db_host`.

## Migration

- Use a new LSD/Mito prediction output for legacy completion records without content digests. Missing or changed chunks now fail resume validation.
- Use a new Funke database/output when existing state lacks input/config identity.
- Configure an authenticated reachable MongoDB for distributed Slurm workers. Local processing retains automatic loopback MongoDB. Legacy whole-pipeline Slurm scripts require `CONNECTIO_MONGODB_URI` and verify authentication; they no longer start or shut down shared services.
- Synful defaults to patches whose context fits the raw ROI. Explicit historical edge padding requires `training.allow_context_padding=true`; raw and label physical ROIs must still agree.
- LUT thresholds and steps must use the 0.01 grid. Rebuild historical incorrectly truncated LUT names instead of loading a neighboring threshold.
- Normalization/CLAHE publishes a complete output directory; source and destination cannot overlap.

## Validation and limits

Regression tests inject failed writes and final exports, delete/corrupt prediction chunks, attempt executable pickle loading and symlink escapes, change input during inference, and exercise cross-block plateaus, sparse labels and asymmetric coordinates. The original Zarr2/Zarr3 regression suite and real tiny MongoDB/Daisy/Funke pipeline are also exercised. See [validation evidence]({{ "/validation/audit-26.11.02.json" | relative_url }}).

Directory publication rolls back Python exceptions; power loss/SIGKILL is not a global transaction across filesystems. Rotation retains `.backup-*` data during installation for manual recovery after abrupt termination. Production GPU workloads, cross-node Slurm and power-failure recovery are not validated here. Source revisions are filesystem fingerprints; continuously written sources should first be snapshotted read-only. Very large NMS plateaus can require expanded windows and additional memory. The [Chinese repair table]({{ "/zh/audit/" | relative_url }}) maps each described review item to its disposition.
