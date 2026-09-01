# RFC 0001 — Runtime Data Model

Status: Draft

## Problem

Agent frameworks persist execution information using incompatible event logs,
snapshots, checkpoints, traces, files and side-effect records. Perix needs a
harness-independent runtime-data model that supports durable recovery, resume,
forking, state inspection, artifact lineage, external-effect safety and
observability projection.

## Terminology

- **Namespace** — isolation boundary for ownership, authorization and ID
  uniqueness. A namespace commonly maps to a tenant or workspace.
- **Execution** — one user-visible agent operation.
- **Session** — a durable conversational or workflow scope within an execution.
- **Stream** — one ordered line of logical history. Every session starts with one
  root stream; the fork operation creates a child stream.
- **Revision** — an exact event position, represented by `(stream_id, seq)`.
- **Schema version** — the version of an individual record or event payload. It
  is not a state revision.
- **Command** — an idempotent request that may create records and append Events;
  commands are behavior, not part of the persisted domain hierarchy.

## V0 model

```text
Namespace
  `-- Execution
        `-- Session
              |-- Stream(root)
              |     |-- Event(seq, event_id, type, schema_version, payload)
              |     |-- State(revision)
              |     |-- Checkpoint(revision, state_ref, execution_ref?)
              |     |-- Artifact(artifact_id, artifact_version, produced_at)
              |     `-- Effect(effect_id, status, idempotency_key, ...)
              |
              `-- Stream(child)
                    |-- parent_stream_id
                    |-- parent_seq
                    `-- child Events(seq starts at 1)
```

Artifact and Effect lifecycle changes are represented by canonical events. Their
tables or documents are transactional indexes optimized for lookup; they do not
form a second logical history. Artifact bytes and the external systems touched by
Effects remain outside Runtime Data.

## Event stream and append semantics

V0 uses one root stream per session. A stream is ordered by a contiguous,
strictly increasing `seq` beginning at 1. Wall-clock timestamps never determine
ordering. Root and child Stream creation each append the Stream's creation Event
as sequence 1.

Writers append with optimistic concurrency:

```text
append(stream_id, expected_seq, event_drafts[])
```

The operation succeeds only if `expected_seq` is the current stream head. A
batch append allocates contiguous sequence numbers and commits atomically. A
complete retry whose Event IDs already occupy the same contiguous batch with
identical client-supplied content returns the original result, even though its
`expected_seq` is stale. Partial ID reuse, cross-stream reuse or reuse with
different content is an integrity error.

Concurrency across different streams is intentionally unordered. Relationships
that cross streams use explicit IDs and revisions rather than timestamps.

## State and schema versions

Materialized State is a deterministic fold of a stream's logical history. Its
revision is the last applied `(stream_id, seq)`. A forked stream's history is the
parent prefix through `parent_seq`, followed by the child stream's own events.

`schema_version` only describes record shape. Readers must preserve unknown
events. A materializer must either understand an event, apply a documented
deterministic upcaster, or fail recovery; silently dropping an event is invalid.

## Checkpoint and fork behavior

A Checkpoint is an immutable manifest that binds:

- an exact revision;
- a logical State snapshot reference and content digest;
- an optional Execution Plane checkpoint reference;
- the schema/materializer versions required to restore it.

`fork(checkpoint_id, child_stream_id, command_id)` creates a child Stream from an
existing Checkpoint. The child stores `parent_stream_id`, `parent_seq` and
`checkpoint_id`; it does not copy or renumber the parent prefix. Parent history
remains unchanged. `command_id` or the caller-supplied `child_stream_id` provides
operation idempotency. V0 does not define a separate Fork entity or `fork_id`,
and does not permit forking from an uncheckpointed revision.

## Artifact semantics

An Artifact has a stable `artifact_id` and immutable versions. Each version
records the producing revision, media/type metadata, content digest, lineage and
an external `uri`. Publishing an Artifact version and appending its canonical
event occur in one Runtime Data transaction. Runtime Data does not own the bytes.

## Effect transaction protocol

External side effects cannot share an atomic transaction with Runtime Data. V0
therefore uses an intent ledger with these durable states:

```text
declared -> claimed -> committed
               |---> failed -----> claimed (policy retry)
               `---> unknown ----> committed | failed (reconciliation)
```

The declaration and every status transition commit atomically with their
canonical events. A claim is leased so that abandoned work can be recovered. An
expired claim becomes `unknown` unless the executor can prove invocation never
started. The executor sends the stable `idempotency_key` to the external system
when that system supports it, then records the outcome and canonical event
atomically.

If a worker may have completed the external action but cannot record the result,
the Effect becomes `unknown`. It must be reconciled before retry unless the
external operation is known to honor the same idempotency key. `committed` is
terminal; retries return the recorded result.

## Compaction and retention

V0 does not rewrite or renumber committed events. Checkpoints may accelerate
recovery, and old segments may be archived, but archived events remain part of
logical history. Redaction, legal deletion and destructive compaction require a
separate RFC because they interact with append-only guarantees.

## Security boundary

Every persisted record belongs to exactly one `namespace_id`. Cross-namespace
references are invalid. Adapters must not place credentials or unrestricted
secret values in canonical payloads; sensitive fields require an explicit data
classification and redaction policy.

## Deferred decisions

- snapshot cadence and garbage collection
- physical storage schemas and indexing
- multi-stream transactions beyond Artifact/Effect lifecycle writes
- legal deletion and cryptographic erasure
- canonical event-type catalog and OpenTelemetry semantic mappings
