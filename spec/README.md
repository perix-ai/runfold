# Runtime Data Specifications

This directory defines the stable, harness-independent contracts of Perix Runtime Data.

## Modules

- `ids/` — namespace, execution, session, stream and record identities
- `stream/` — root/child stream lifecycle and lineage semantics
- `event/` — canonical append-only event model and ordering semantics
- `state/` — materialized logical state model
- `checkpoint/` — logical snapshot and restore semantics
- `artifact/` — artifact metadata, versions and lineage
- `effect/` — external-effect intent, commit status and idempotency
- `projection/` — derived views, including OpenTelemetry and analytics mappings

The specifications should remain independent from concrete storage engines and
agent harnesses.

## Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** describe
conformance requirements. A backend or harness adapter is conformant only when
it preserves the core invariants and passes the shared conformance suite.

Machine-readable record shapes live under `schemas/`. This directory defines
behavioral meaning; a schema defines representation. A conflict between the two
is a specification defect rather than an override in either direction.
