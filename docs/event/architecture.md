# Event trajectory infrastructure architecture

> Language: English | [中文](architecture.zh.md)
>
> Document type: technical architecture. This document describes the
> components, their boundaries, and the rules for handling upstream code and
> dependencies. See [`requirements.md`](requirements.md) for requirements,
> [`specification.md`](specification.md) for interfaces and data formats, and
> [`decisions.md`](decisions.md) for the context behind key tradeoffs.

## 1. Overall structure

```text
                 conformance/event/v0  (shared cases and fixtures)
                 schemas/event/v0      (shared wire schemas)
                          ▲
          ┌───────────────┴────────────────┐
          │                                │
  TypeScript implementation          Python implementation
  packages/event/typescript/          packages/event/python/
  ├─ packages/   retained DSH source   src/runfold/event/
  │   core/session                     ├─ session.py / surface.py / repair.py
  │   session/session-persistence      ├─ persistence_jsonl.py / format.py
  │   session/session-persistence-jsonl├─ chunk_rows.py / messages.py
  │   client/*   Trajectory UI closure └─ ...
  ├─ runtime/    Runfold host and utilities
  │   host.ts (EventHost) / create.ts / messages.ts / values.ts / brand.ts
  ├─ sdk/        @runfold/event publication boundary
  └─ ui/trajectory/  @runfold/trajectory-ui publication boundary
          │                                │
          └──────── tests/event/cross-language ────────┘
```

The two implementations are native implementations of one contract. Their
cross-language connection is the shared Event data and behavioral contract, not
the UI language. There is one TypeScript/React UI.

## 2. Components

| Component | Location | Responsibility | Notes |
| --- | --- | --- | --- |
| Session core | `packages/event/typescript/packages/core/session` | Event validation, append, immutable snapshots, surface projection, fork prefixes, and repair | Retained from DSH; only host seams change |
| Persistence seam | `.../packages/session/session-persistence` | Abstract backend, write-behind coordinator, prepare/borrow, and torn-tail repair | Same policy as above |
| JSONL backend | `.../packages/session/session-persistence-jsonl` | Plain-text and multi-frame Zstandard logs, packed chunk rows, and atomic materialization | Same policy as above |
| Host and utilities | `.../runtime/` | `EventHost` event bus, scopes, and composition slots; `createEventRuntime()`; message and JSON utilities | [`runtime/README.md`](../../packages/event/typescript/runtime/README.md) |
| TypeScript SDK | `.../sdk/` | Publication boundary that only exports and packages the implementation | [`sdk/README.md`](../../packages/event/typescript/sdk/README.md) |
| Trajectory UI | `.../packages/client/*` + `.../ui/trajectory/` | DSH conversation assembler, projection, and React views with an independent host | [`ui/trajectory/README.md`](../../packages/event/typescript/ui/trajectory/README.md) |
| Python implementation | `packages/event/python/` | Independently installable native implementation of the same contract | [`python/README.md`](../../packages/event/python/README.md) |
| Upstream snapshot | `third_party/deepseek-harness/` | Audit snapshot at a fixed commit; excluded from builds | [`third_party README`](../../third_party/deepseek-harness/README.md) |

## 3. Design principles

### 3.1 Priority when requirements conflict

1. Preserve DSH's existing observable behavior;
2. Remove DSH-specific coupling so Event works independently;
3. Preserve TypeScript/Python logical equivalence and data interoperability;
4. Only then consider API polish, renaming, or directory refactoring.

DSH code must not be rewritten merely because another implementation appears
cleaner. Every deviation must be directly driven by independence,
cross-language, or publication requirements, and tests must prove that it does
not alter the intended behavior.

### 3.2 Source and directory responsibilities

| Location | Responsibility | Adaptation policy |
| --- | --- | --- |
| `third_party/deepseek-harness/upstream/` | Original DSH audit snapshot at a fixed version | No adaptation; preserve upstream bytes |
| `packages/event/typescript/packages/` | DSH-extracted source retaining upstream relative paths | Only host-seam changes required for independence, each registered by `scripts/verify-upstream-identity.mjs` |
| `packages/event/typescript/{runtime,sdk,ui,test-support}/` | Runfold-owned code | May change freely, but each file explains what it replaces and why |
| `packages/event/python/` | Native Python implementation | Implement the shared contract; do not translate the UI |
| `tests/event/` | Cross-language integration and interoperability tests | Belongs to neither single-language implementation |
| `schemas/`, `conformance/` | Cross-language, implementation-neutral data structures and behavior fixtures | Evolve through explicit versions |

`upstream/` is a scoped snapshot retained for this extraction, not a mirror of
the complete DSH repository. Every upstream file in the snapshot must be
byte-for-byte identical to the fixed commit. If the dependency closure later
needs another upstream file, add it from that same fixed version rather than
editing `third_party`. Python uses the standard `pyproject.toml` plus
`src/runfold/event/` layout and adds no directory without an independent
responsibility.

### 3.3 Rules for handling DSH dependencies

"Preserve wherever possible" does not mean retaining the entire DSH dependency.
Handle each `@deepseek-ai/*` package, Cordis service, or DSH shell type according
to the responsibility it actually serves within Event:

| Dependency category | Treatment | Typical content | Current state |
| --- | --- | --- | --- |
| Core Event behavior | Preserve source and algorithms; change only imports and composition boundaries required for independence | Session, append, fork, repair, projection | Retained |
| Event-required types or small utilities defined by DSH | Extract a minimal implementation into `runtime/` | Message/ContentBlock, ID brands, deep freeze, JSON snapshots, timeout constants | Replaced |
| Harness host and plugin machinery | Remove; reproduce lifecycle-affecting behavior through a minimal local interface | Cordis Context/Service, scope, typert, plugin registration | Replaced by `EventHost`; see D01 in [`decisions.md`](decisions.md) |
| UI dependency closure required by Trajectory | Prefer faithful extraction; replace only host interfaces supplied by the complete DSH shell | Conversation assembler, renderer binding, store, UI primitives, locale, theme | Actual closure extracted from the fixed snapshot; host types and Event augmentation localized; see [`tasks/R25-R29-dsh-free.md`](tasks/R25-R29-dsh-free.md) |
| Necessary general-purpose third-party libraries unrelated to DSH | Retain with locked versions | React, shiki, compression or file-processing libraries | Retained |

After decoupling, packaged JavaScript, declarations, and the Python package must
not require any DSH package. Public APIs, types, module augmentations, and error
identifiers must not expose a DSH namespace. DSH names may remain only in
`third_party`, audit manifests excluded from publication resolution, provenance
notes, licenses, or tests asserting that names do not leak. They must not remain
as source imports, module augmentations, or test-configuration aliases, and the
dependency must not be hidden by copying the complete DSH runtime.

### 3.4 Host seam: EventHost

DSH Event code obtains three facilities from the Cordis plugin platform: an
event bus for `session/*` lifecycle events, ownership scopes with reverse-order
disposal, and named service slots. `EventHost` provides only those three and
reproduces the subset of Cordis lifecycle behavior used by retained code: event
ordering and carriers, effect initialization and reverse-order disposal, failure
isolation, parent/child scope disposal, and scope-bound service views. A Session
created in a child scope is therefore destroyed with that scope. There is no
plugin registration, dependency injection, scope-filtered dispatch, or type
registry. Eleven independent host tests lock this boundary.

`createEventRuntime({ persistence })` is the composition root: one host, one
`SessionStore`, an optional persistence backend, and a `restore(id)` method
corresponding to Python's `SessionStore.restore`.

### 3.5 Cross-language equivalence

TypeScript and Python are native implementations of the same Event contract.
The Python package contains the real logic for Session, append, persistence,
restore, resume, fork, repair, and projection. It is not a thin HTTP/IPC client
and does not load TypeScript source.

The implementations must be equivalent in all of the following respects: they
accept and reject the same Event and Session data; use the same field semantics,
sequence rules, lifecycle, fork-prefix rules, and repair rules; produce the same
normalized logical result for the same deterministic fixture; restore, append
to, and fork persisted trajectories written by the other language; and let the
TypeScript Trajectory UI display trajectories written by Python directly.

Random IDs, timestamps, and compressed bytes need not be byte-for-byte equal,
but they must satisfy the same constraints. Decoded and normalized Events and
derived results must be equivalent. Tests fix all nondeterministic inputs when
byte comparison is required. API surface differences, including TypeScript-only
write-behind, `prepare`, and `listSnapshots`, are enumerated in
[`specification.md`](specification.md).

### 3.6 Deviation policy

Every deviation from upstream must include all three of: its source (upstream
file and commit), its rationale (independence, cross-language, or publication),
and a regression test. TypeScript deviations are registered in the "Necessary
local changes" section of
[`packages/event/typescript/README.md`](../../packages/event/typescript/README.md)
and in the allowlist in `scripts/verify-upstream-identity.mjs`. Python mappings
are registered under "Necessary Python implementation mapping" in
[`specification.md`](specification.md).
