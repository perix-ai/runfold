# Event verification matrix

The Event implementations are verified at eight independent layers.

| Layer | Location | What it proves |
| --- | --- | --- |
| Upstream Event regression | `packages/core/session/tests`, `packages/session/**/tests` | Retained Session and persistence behavior still matches the pinned source |
| Upstream Trajectory regression | `packages/client/ui-trajectory/tests` | Retained projection, layout, table, timeline, and view behavior remains intact |
| Perix SDK | `tests/sdk` | Public exports, lifecycle, immutability, replay, fork, JSONL round-trip/restart, raw/suffix reads, and isolation work through `@perix/*` imports |
| Perix UI | `tests/ui` | `EventTrajectory` projects, renders, localizes, pages, replaces input, and handles 20,000 events |
| Complete system | `tests/integration` | One log crosses validation, fork, JSONL durability, process-style restart, and React rendering |
| Cross-language conformance | `tests/event/cross-language`, `conformance/event/v0` | Both languages agree on valid/invalid inputs and repair; each reads, resumes, appends, and forks the other's plain/Zstd files; Python events render in Trajectory |
| Python implementation | `packages/event/python/tests` | Native Session, surface, repair, codecs, persistence, recovery, and 20,000-Event history work without TypeScript |
| Published artifacts | `tests/package`, `packages/event/python/tests/package_consumer.py` | Packed SDK/UI and Python wheel install into blank consumers and work through public APIs |

Run the complete matrix:

```bash
npm run verify
```

Focused commands are also available: `test:upstream`, `test:sdk`, `test:ui`,
`test:system`, `test:conformance`, `test:types`, `test:python`, `test:package`,
and `test:python:package`.
