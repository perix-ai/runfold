# Perix Runtime Data

**The Agent Data Plane for durable agent execution.**

`perix-runtime-data` defines and implements the durable runtime-data layer for Perix agents.

It owns the semantics and lifecycle of:

- **Event** — canonical append-only execution facts
- **State** — materialized logical runtime state
- **Checkpoint** — durable recovery boundaries
- **Fork** — lineage-aware branching from valid recovery points
- **Artifact** — versioned metadata and references for generated files/data
- **Effect** — externally committed side effects and idempotency records
- **Projection** — derived views such as OpenTelemetry and analytics exports

## Design principle

One logical source of truth; multiple projections.

```text
Canonical Event
      |
      +--> State Materializer
      |
      +--> Checkpoint / Fork
      |
      +--> Artifact / Effect references
      |
      +--> OTel / Analytics projections
```

Runtime-data semantics are independent from any specific harness, model provider,
sandbox, database, or observability backend.

## Repository layout

```text
perix-runtime-data/
├── docs/
├── spec/
│   ├── ids/
│   ├── event/
│   ├── state/
│   ├── checkpoint/
│   ├── artifact/
│   ├── effect/
│   └── projection/
├── adapters/
│   ├── harness/
│   ├── storage/
│   └── observability/
├── tests/
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
