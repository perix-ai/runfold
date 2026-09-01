# Runtime Data Specifications

This directory defines the stable, harness-independent contracts of Perix Runtime Data.

## Modules

- `ids/` — execution, session, event, checkpoint, artifact and effect identities
- `event/` — canonical append-only event model and ordering semantics
- `state/` — materialized logical state model
- `checkpoint/` — logical checkpoint, restore and fork semantics
- `artifact/` — artifact metadata, versions and lineage
- `effect/` — external-effect intent, commit status and idempotency
- `projection/` — derived views, including OpenTelemetry and analytics mappings

The specifications should remain independent from concrete storage engines and agent harnesses.
