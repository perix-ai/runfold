# Perix Runtime Data

**The agent data plane for durable agent execution.**

`perix-runtime-data` holds the durable runtime-data facilities for Perix
agents. The first and currently only facility is **Event**: the append-only
execution trajectory of an agent Session, its persistence, restore/resume/fork
behavior, and the Trajectory UI that projects it. It is cut directly from
DeepSeek Harness rather than designed from scratch. This file is a map;
scope, design, and rules live under `docs/event/`.

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

## Where to read

| Question | Document |
| --- | --- |
| What is being built and what counts as done | [`docs/event/requirements.md`](docs/event/requirements.md) |
| How it is structured and how upstream code is handled | [`docs/event/architecture.md`](docs/event/architecture.md) |
| The interface and on-disk contract shared by both languages | [`docs/event/specification.md`](docs/event/specification.md) |
| How it is verified | [`docs/event/testing.md`](docs/event/testing.md) |
| Why key choices were made | [`docs/event/decisions.md`](docs/event/decisions.md) |
| Progress and open work | [`docs/event/tasks.md`](docs/event/tasks.md) |

## Quick start

```bash
npm install
npm run verify
npm run dev:event-ui
```

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

The repository implementation and all internal acceptance work through R35 are
complete: the current full gate verifies 207 retained upstream files, runs 1005
behavior tests, and installs both language packages into blank consumers. R33
now also proves the Python package in Nexent's real process and passes the
resulting parent/fork trajectory through the TypeScript public restore API and
retained UI. Production acceptance remains open only until the Nexent
integration commit is published to an authorized writable remote. See
[`docs/event/tasks.md`](docs/event/tasks.md) for the evidence and remaining work.
