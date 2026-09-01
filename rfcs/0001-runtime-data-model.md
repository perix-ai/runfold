# RFC 0001 — Runtime Data Model

Status: Draft

## Problem

Agent frameworks currently persist execution information using incompatible event logs, snapshots, checkpoints, traces, files and side-effect records.

Perix needs a harness-independent runtime-data model that supports:

- durable recovery
- resume
- fork / branch
- state inspection
- artifact lineage
- external-effect safety
- observability projection

## Initial model

```text
Execution
  |
  +-- Session
        |
        +-- Event Stream
        |     `-- Event(seq, type, payload, ...)
        |
        +-- State(version)
        |
        +-- Checkpoint(logical_version, execution_ref?)
        |
        +-- Artifact(version, uri, lineage)
        |
        `-- Effect(intent, status, external_ref, idempotency_key)
```

## Open questions

- stream boundary: execution vs session vs turn
- sequence allocation and concurrency model
- snapshot cadence
- fork validity rules
- event compaction policy
- effect transaction protocol
- canonical event schema vs OTel semantic mapping
