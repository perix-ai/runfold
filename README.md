# Perix Runtime Data

**The agent data plane for durable agent execution.**

`perix-runtime-data` holds the durable runtime-data facilities for Perix
agents. The first and currently only facility is **Event**: the append-only
execution trajectory of an agent Session, its persistence, restore/resume/fork
behavior, and the Trajectory UI that projects it. It is cut directly from
DeepSeek Harness rather than designed from scratch.

Further facilities (materialized state, checkpoints, artifact and effect
ledgers, observability projections) are out of scope until Event is
production-ready. Earlier from-scratch design drafts for them were removed on
2026-09-01; see git history before that date if they are needed again.

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
│           ├── src/perix_event/    # Native implementation and public API
│           ├── pyproject.toml      # perix-event-sdk distribution
│           └── tests/              # Python core/persistence/package tests
├── tests/
│   └── event/cross-language/       # Bidirectional implementation tests
├── docs/
│   └── event/                      # Scope, contract, and task checklist
├── schemas/
│   └── event/v0/                   # Language-neutral wire schemas
├── conformance/
│   └── event/v0/                   # Shared cases and wire fixtures
└── third_party/
    └── deepseek-harness/
        └── upstream/               # Unmodified pinned DSH source snapshot
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
