# Runfold

**The agent data plane for durable agent execution.**

Runfold is an agent runtime data platform developed and maintained by Heiki
Scott under the Perix.ai project name. Its first subsystem is **Event**: the
append-only execution trajectory of an agent
Session, its persistence, restore/resume/fork behavior, and the Trajectory UI
that projects it. Event is cut directly from DeepSeek Harness rather than
designed from scratch. This file is a map; scope, design, and rules live under
`docs/event/`.

## Repository layout

```text
runfold/
├── apps/
│   └── event/
│       └── typescript/
│           └── trajectory-demo/   # Development-only demo
├── packages/
│   └── event/
│       ├── typescript/
│       │   ├── packages/           # DSH source retained in upstream layout
│       │   ├── sdk/                # Publishable @runfold/event boundary
│       │   ├── ui/trajectory/      # Publishable @runfold/trajectory-ui boundary
│       │   └── tests/              # TypeScript Event tests
│       └── python/
│           ├── src/runfold/event/  # Native implementation and public API
│           ├── pyproject.toml      # runfold-event distribution
│           └── tests/              # Python core/persistence/package tests
├── tests/
│   └── event/cross-language/       # Bidirectional implementation tests
├── docs/
│   └── event/                      # Scope, contract, and task checklist
├── schemas/
│   └── event/v0/                   # Language-neutral wire schemas
├── conformance/
│   └── event/v0/                   # Shared cases and wire fixtures
├── integrations/
│   └── nexent/                     # Versioned downstream Event integration patches
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
| Who owns which material | [`COPYRIGHT.md`](COPYRIGHT.md) and [`NOTICE.md`](NOTICE.md) |
| How Runfold is distributed and released | [`OPEN_SOURCE_POLICY.md`](OPEN_SOURCE_POLICY.md) |
| How contributions are licensed | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Watch the Nexent trajectory restore/fork UI demo | [`docs/event/demos/nexent/`](docs/event/demos/nexent/) |
| Apply the validated Nexent product integration | [`integrations/nexent/`](integrations/nexent/) |

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

Those belong to separate runtime or application concerns.

## Licensing and attribution

Original Runfold code and modifications are copyright © 2026 Heiki Scott.
Perix.ai is the project and maintainer name, not a separate legal copyright
owner. The Event subsystem also contains code derived from DeepSeek Harness;
its original copyright, MIT license, pinned source, and unmodified audit
snapshot are preserved. See [`COPYRIGHT.md`](COPYRIGHT.md),
[`OPEN_SOURCE_POLICY.md`](OPEN_SOURCE_POLICY.md), [`NOTICE.md`](NOTICE.md),
[`LICENSE`](LICENSE), and
[`third_party/deepseek-harness/`](third_party/deepseek-harness/).

## Maintenance

Repository structure, verification, commit, and push rules are defined in
[`AGENTS.md`](AGENTS.md). Changes are kept as small logical units and pushed
after each verified commit instead of being accumulated into one large batch.

## Status

The Event trajectory subsystem has completed its production acceptance and all
recorded behavioral tasks through R44. The current full gate verifies 204
retained upstream files through 139 declared specifier mappings, runs 1005
behavior tests, and installs both language packages into blank consumers.
R33 also proves the Python package in Nexent v2.5.0's real process and passes
the resulting parent/fork
trajectory through the TypeScript public restore API and retained UI. The
Nexent product integration now additionally passes a 21-Turn cross-process
restore/fork test and renders the retained DSH detail panel, including the real
Tool schema. The Nexent branch is intentionally a local interoperability
experiment with no remote; any upstream proposal requires separate coordination
with the Nexent team. A repository-local
[UI demo](docs/event/demos/nexent/) shows the complete trajectory,
cold restore, detail tabs, and fork result. See
[`docs/event/tasks.md`](docs/event/tasks.md) for the full evidence. The exact
Nexent product changes are preserved separately as a
[versioned, replay-tested patch series](integrations/nexent/v2.5.0/).
