# Architecture

## Scope

Perix Runtime Data is the durable logical data layer beneath agent harnesses and
above physical storage.

```text
Agent / Harness
      |
      v
Canonical Runtime Data
  |-- Event streams -------- authoritative logical history
  |-- State ---------------- deterministic materialization
  |-- Checkpoint ------------ durable recovery boundary
  |-- Stream lineage -------- root and child histories
  |-- Artifact index -------- immutable metadata and byte references
  |-- Effect ledger -------- external-action intent and outcomes
  `-- Projections ---------- derived, disposable views
      |
      +--> Storage backends
      +--> OpenTelemetry
      `--> Analytics
```

## Authority model

Canonical events are the source of truth for Perix logical history. State,
checkpoints, Artifact indexes, Effect indexes and observability data are derived
from or transactionally tied to that history.

This does not claim authority over external reality. Artifact bytes remain
authoritative in their object store, and an external service remains
authoritative about whether a side effect occurred. Runtime Data records stable
references and the best durable knowledge of those outcomes.

## Recovery model

Stream, Event, State and Checkpoint form one recovery model. Fork is the operation
that creates a child Stream from a Checkpoint:

```text
parent Event Stream --fold--> State --snapshot--> Checkpoint
          |                                      |
          `----------- prefix through seq -------+--> child Stream
```

A state revision is an exact `(stream_id, seq)`, not a timestamp or schema
version. The fork operation creates a child that reads the immutable parent
prefix through its checkpoint and then applies child events beginning at child
sequence 1.

## Write boundaries

- Event batches append atomically using an expected stream head.
- State updates may be synchronous or asynchronous, but record their exact
  applied revision.
- Artifact metadata changes and their events commit in one Runtime Data
  transaction.
- Effect declarations and outcomes commit with their events, while the external
  action itself is coordinated through idempotency and reconciliation.
- Projection failures never roll back canonical writes.

## Separation from execution infrastructure

Filesystem, process and VM snapshots belong to the Execution Plane. A logical
Checkpoint may reference one but does not own its lifecycle.

```text
revision = (stream_id = "strm_...", seq = 187)
execution_ref = "runta:ckpt-42"
```

Restore validates the logical snapshot first and then asks the Execution Plane
adapter to resolve the optional execution reference.

## Adapter boundary

Adapters translate protocols; they do not redefine semantics. Harness adapters
produce canonical commands and events, storage adapters preserve atomicity and
ordering, and observability adapters emit lossy projections. Backend-specific
fields belong in namespaced extension payloads and must not alter core behavior.

## Deployment shape

The contracts are transport- and language-independent. A deployable `server/`
should be added only after an API protocol is accepted, and generated `sdks/`
should follow that protocol rather than becoming a second hand-written contract.
Until then, a future in-memory reference implementation is the preferred first
executable target.
