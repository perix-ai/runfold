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
├── apps/
│   └── event/
│       └── typescript/
│           └── trajectory-demo/   # Development-only demo
├── packages/
│   └── event/
│       ├── typescript/
│       │   ├── packages/           # DSH source retained in upstream layout
│       │   ├── sdk/                # Publishable @perix/event-sdk boundary
│       │   ├── ui/trajectory/      # Publishable @perix/event-ui boundary
│       │   └── tests/              # TypeScript Event tests
│       └── python/
│           ├── sdk/                # Native installable perix-event-sdk
│           └── tests/              # Python core/persistence/package tests
├── tests/
│   └── event/cross-language/       # Bidirectional implementation tests
├── docs/
│   └── event/                      # Scope, contract, and task checklist
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
│   └── event/v0/
├── adapters/
│   ├── harness/
│   ├── storage/
│   └── observability/
├── conformance/
│   └── event/v0/                   # Shared cases and wire fixtures
├── third_party/
│   └── deepseek-harness/
│       └── upstream/               # Unmodified pinned DSH source snapshot
└── rfcs/
```

## Event reference implementation

The current extraction goal, DSH dependency-removal rules, multi-language
contract, and completion criteria are centralized in the
[`Event 轨迹设施说明`](docs/event/README.md). It is the source of
truth for this work.

The first executable slice is intentionally Event-only and is cut directly
from DeepSeek Harness `0.1.2-alpha.3`:

- `@perix/event-sdk` exposes the unchanged DSH Session, persistence seam, and
  JSONL backend through namespaced subpath exports without reimplementing their
  behavior;
- `perix-event-sdk` is a native Python implementation of the same Session,
  surface, repair, JSONL, restore/resume, and fork contract; it does not invoke
  TypeScript or require a server;
- `@perix/event-ui` runs DSH's unchanged conversation assembler, Trajectory
  projection, and Trajectory React view behind a small standalone host;
- `apps/event/typescript/trajectory-demo` is development-only and contains no
  reusable library implementation.

```bash
npm install
npm run verify
npm run dev:event-ui
```

`npm run verify` builds every package, runs the retained upstream regression
suite plus TypeScript/Python/conformance/system suites, and installs the
TypeScript and Python SDKs into blank consumer environments.

The untouched upstream reference lives under `third_party/deepseek-harness/`.
The retained extraction lives under `packages/event/typescript/`; the
native Python peer lives under `packages/event/python/`. Their shared v0
contract is recorded in [`docs/event/contract.md`](docs/event/contract.md).

## Non-goals

This repository does **not** own:

- long-term agent memory
- enterprise knowledge / RAG
- sandbox / VM lifecycle
- model routing
- skills / tools / MCP registry
- product agent UI or control plane (the repository includes only a standalone
  host for DSH Trajectory)

Those belong to separate Perix planes.

## Maintenance

Repository structure, verification, commit, and push rules are defined in
[`AGENTS.md`](AGENTS.md). Changes are kept as small logical units and pushed
after each verified commit instead of being accumulated into one large batch.

## Status

Pre-alpha. The Python v0 implementation and bidirectional conformance path are
executable; the TypeScript extraction still requires the DSH/Cordis dependency
cleanup listed in [`docs/event/tasks.md`](docs/event/tasks.md) before the whole
Event facility can be called production-ready.
