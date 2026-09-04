# Event v0 interface and data specification

> Language: English | [中文](specification.zh.md)
>
> Document type: interface and data specification. This document defines the
> logical interfaces, disk format, and conformance criteria shared by both
> implementations. See [`requirements.md`](requirements.md) for requirements
> and [`architecture.md`](architecture.md) for architecture.

This document records the Event v0 logical interface and persistence boundary
shared by TypeScript and Python. The behavioral baseline is DeepSeek Harness
`0.1.2-alpha.3` (commit
`dd6322d604e00eec1ba5e0c8541159906a21094a`). Fields, sequences, surface,
repair, and disk format follow the retained DSH tests and
`conformance/event/v0/`.

## Logical model

- A Session consists of one header and a zero-based contiguous Event sequence.
- The Event envelope contains `type`, `seq`, `time`, and `data`, and may include
  `surfaceOp`, `sourceEventSeqs`, and `ignorable` where the rules permit.
- Every persisted value must be acyclic, lossless JSON. Sequence numbers and
  timestamps must be JavaScript safe integers; Python must not write integers
  that TypeScript would round.
- `user/message`, `assistant/message`, and `tool/result` are the current three
  surface Events. No other Event may carry surface metadata.
- Header and Event fields on disk always use the shared camelCase names. Python
  uses snake_case only for method parameters and attribute names; it does not
  rewrite data fields.

The public envelope schemas are in
[`schemas/event/v0/`](../../schemas/event/v0/). Schemas describe the portable
structure; implementation code and conformance cases jointly constrain the full
ordering, surface, repair, and unknown-Event rules.

## Behavioral interface mapping

| Behavior | TypeScript | Python | Shared semantics |
| --- | --- | --- | --- |
| Create | `runtime.sessions.create(...)` | `store.create(...)` | Create the header; remain lazily materialized while the Event list is empty |
| Append | `session.append(type, data, opts)` | `session.append(type, data, surface_op=..., source_event_seqs=...)` | Validate and copy JSON, then allocate a contiguous `seq` and current millisecond timestamp |
| Read | `sessionPersistence.load/inspect` | `persistence.load/inspect` | Return an independent, validated logical snapshot; `load` commits necessary repair |
| Restore/resume | `runtime.restore(id)` | `store.restore/resume` | Use the original header and complete persisted prefix; append only a missing `session/end-seed` |
| Persistence barrier | `runtime.sessions.flush(session)` | `store.flush(session)` | All prior Events are persisted when the call returns |
| Fork | `runtime.sessions.fork(...)` | `store.fork(...)` | Accept only an existing inclusive prefix outside an open turn |
| Suffix read | `readFrom(id, seq)` | `read_from(id, seq)` | Return expanded Events from logical seq; never expose packed rows |
| Raw trajectory | `readRaw(id)` | `read_raw(id)` | Return decompressed logical JSONL text and the header |
| Message projection | `deriveMessages()` | `derive_messages()` | Produce identical messages in current surface order |

TypeScript uses `createEventRuntime({ persistence })` to compose an `EventHost`,
a `SessionStore`, and an optional persistence backend. `runtime.restore(id)` is
the one-step entry point that publishes a Session after `prepare`. Python
composes `SessionStore` and persistence directly. Neither side depends on Cordis
or starts a server, sidecar, or subprocess.

The table defines **logical equivalence**, not API equivalence. The following
interfaces exist on only one side; callers must not assume a counterpart:

| Interface | Provider | Notes |
| --- | --- | --- |
| Write-behind batching (`writeBatchMaxDelayMs`) | TypeScript only | Python `flush` writes synchronously without a delayed batch; the externally visible persistence-barrier semantics are identical |
| `SessionPreparation` / `persistence.prepare` | TypeScript only | Ownership handle for an unpublished Session; `runtime.restore` encapsulates it and corresponds to Python `restore` |
| `listSnapshots` | TypeScript only | Returns headers with revision tokens; Python `list` returns headers only |
| `AbortSignal` for `inspect(id, signal)` | TypeScript only | Python `inspect` cannot be cancelled |
| Borrowed live source | TypeScript only | Reads return the snapshot of an in-memory Session with the same id when present; Python reads disk directly |
| `store.resume(id)` | Python only | Exact alias of `store.restore(id)`, retained only to match the resume terminology in this document |

## Restore, resume, and fork

- `inspect` may return a deterministic repaired view in memory without changing
  a torn physical tail.
- `load` discards the final incomplete physical record, retains Events already
  written completely, and fills an unfinished tool result, `step/end`, and
  `turn/end` in DSH order.
- Resume uses the complete history after restore. When that history contains a
  new live suffix after the previous seed boundary and does not already end in
  `session/end-seed`, the construction lifecycle appends one marker for the new
  seed/live boundary. Restoring the same history again when it already ends in
  that marker is idempotent, so merely viewing or reopening it does not keep
  growing the log. This matches the fixed DSH property test: one boundary per
  explicit replay, with idempotent replay of a terminal marker.
- A fork `boundary` is an inclusive Event sequence number. The child Session
  records `parentSession` and `seedLength`, inherits the parent's `cwd`, and has
  a new id and `createdAt`.

Shared repair inputs and field-level expected results are fixed in
[`conformance/event/v0/cases/repair.json`](../../conformance/event/v0/cases/repair.json).

## Physical JSONL format

```text
<root>/
└── <project-key>/
    └── <encoded-session-id>/
        └── session.jsonl[.zstd]
```

- The first JSONL record is the `type: "session"` header. Every later record is
  either an Event or a storage-only packed chunk row.
- Three or more consecutive text, reasoning, or tool-call deltas with identical
  shapes may be stored as one packed row. Reads must expand them into the
  per-Event history.
- Consecutive `sourceEventSeqs` may be stored as a `[start, end]` range. Public
  logical APIs always return an expanded integer array.
- `none` uses UTF-8 plain-text JSONL. `zstd` uses multiple independent,
  checksummed Zstandard frames: the header occupies the first frame and each
  append batch forms another frame.
- A root must not mix plain text and Zstandard. Legacy flat
  `<id>.jsonl[.zstd]` files under a project directory are explicitly rejected,
  not silently ignored.
- Materialization uses a temporary file, fsync, and atomic publication. A failed
  append rolls back to the original length.
- Neither implementation uses a cross-process file lock, matching DSH. The
  caller guarantees a single writer process per Session at any moment.
  TypeScript's persistence coordinator and Python's per-Session `RLock` provide
  in-process serialization independently.

Python 3.14 uses the standard-library `compression.zstd`; Python 3.10–3.13 use
`zstandard` through `runfold-event[zstd]`. Both paths write the same checksummed
frame format without exposing the compression implementation through the
logical API.

## Necessary Python implementation mapping

Python is neither a line-by-line translation of the TypeScript source nor a
remote SDK. It implements the same observable behavior natively. Each deviation
below is directly required by the language or independent publication:

| DSH behavior source | Python location | Necessary rationale | Regression evidence |
| --- | --- | --- | --- |
| `core/session` | `runfold/event/session.py`, `surface.py`, `repair.py`, `request_header.py` | Remove Cordis, brands, and the complete LLM runtime while retaining Event behavior | Python core tests and shared validation/repair cases |
| `core/session/chunk-rows`, `seq-ranges` | `chunk_rows.py` | Preserve the same storage codec so both languages exchange files directly | Packed fixture and bidirectional JSONL tests |
| `session-persistence-jsonl` | `format.py`, `persistence_jsonl.py`, `_zstd.py` | Native persistence in a Python process without a Node server | Plain/Zstd/torn-tail/restart/package tests |
| DSH JSON snapshot and message utilities | `_json.py`, `messages.py`, `types.py` | Event needs only minimal JSON/message shapes and must not depend on the full DSH runtime | Invalid-input, message, and installation tests |

Python returns independent snapshots to prevent callers from mutating its
internal log. TypeScript returns deep-frozen objects. Their observable guarantee
is the same: callers cannot rewrite accepted history.

## Conformance acceptance

`conformance/event/v0/` contains valid and invalid Sessions, deterministic
repair cases, and packed JSONL projections. System tests also exercise these
real-file paths:

- Python writes plain text and Zstandard; TypeScript restores through
  `runtime.restore()`, appends, flushes, and forks; Python then rereads through
  `restore/resume`;
- TypeScript writes plain text and Zstandard; Python restores through
  `restore/resume`, appends, and forks; TypeScript then rereads through
  `runtime.restore()`;
- Python trajectories enter the retained TypeScript Trajectory UI and render
  messages;
- Normalized headers, Events, surfaces, messages, and repair results are
  field-for-field equal.

Random UUIDs, real-time `createdAt`/`time`, JSON object key order, and compressed
frame bytes need not be byte-for-byte equal across languages. Logical results
for fixed inputs must be equal.
