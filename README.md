# Perix Runtime Data

**The agent data plane for durable agent execution.**

`perix-runtime-data` defines the durable runtime-data layer for Perix agents.

It owns the semantics and lifecycle of:

- **Stream** — an ordered root or lineage-aware child history
- **Event** — canonical append-only execution facts
- **State** — materialized logical runtime state
- **Checkpoint** — durable recovery boundaries
- **Artifact** — versioned metadata and references for generated files/data
- **Effect** — externally committed side effects and idempotency records
- **Projection** — derived views such as OpenTelemetry and analytics exports

## Design principle

One canonical logical history; multiple materializations and projections.

```text
Canonical Event Stream
      |
      +--> State --> Checkpoint --> Forked Stream
      |
      +--> Artifact index / Effect ledger
      |
      `--> OTel / Analytics projections
```

Runtime-data semantics are independent from any specific harness, model provider,
sandbox, database, or observability backend.

V0 uses one root stream per session, optimistic concurrency through
`expected_seq`, and exact `(stream_id, seq)` revisions. See
[`RFC 0001`](rfcs/0001-runtime-data-model.md) for the current model.

## Repository layout

```text
perix-runtime-data/
├── docs/
├── spec/
│   ├── ids/
│   ├── stream/
│   ├── event/
│   ├── state/
│   ├── checkpoint/
│   ├── artifact/
│   ├── effect/
│   └── projection/
├── schemas/
│   └── v0/
├── adapters/
│   ├── harness/
│   ├── storage/
│   └── observability/
├── conformance/
│   ├── cases/
│   └── fixtures/
└── rfcs/
```

## Non-goals

This repository does **not** own:

- long-term agent memory
- enterprise knowledge / RAG
- sandbox / VM lifecycle
- model routing
- skills / tools / MCP registry
- agent UI or control plane

Those belong to separate Perix planes.

## Status

Architecture bootstrap / pre-alpha.

The repository currently defines contracts and conformance requirements. A
reference implementation has not yet been added.
