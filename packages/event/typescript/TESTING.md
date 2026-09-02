# Event verification matrix

The Event implementations are verified at ten independent layers.

| Layer | Location | What it proves |
| --- | --- | --- |
| Upstream Event regression | `packages/core/session/tests`, `packages/session/**/tests` | Retained Session and persistence behavior still matches the pinned source |
| Upstream UI-runtime regression | `packages/client/store/tests`, selected `packages/client/ui-primitives/tests` | The locally retained store, Tooltip, JsonTree, Markdown parser/renderer, streaming highlighter, and 48 DOM baselines match the pinned implementation |
| Upstream Trajectory regression | `packages/client/ui-trajectory/tests` | Retained projection, layout, table, timeline, and view behavior remains intact |
| EventHost lifecycle | `tests/runtime` | 11 direct cases lock event order/carriers, effect setup and reverse disposal, rejection handling, nested scopes, and scoped service views to the fixed Cordis subset |
| Perix SDK | `tests/sdk` | Public exports, lifecycle, immutability, replay, fork, JSONL round-trip/restart, raw/suffix reads, and isolation work through `@perix/*` imports |
| Perix UI | `tests/ui` | `EventTrajectory` projects, renders, localizes, pages, replaces input, and handles 20,000 events; the ported upstream view cases cover ledger, inspector, timeline, and duration state on the standalone host |
| Complete system | `tests/integration` | One log crosses validation, fork, JSONL durability, process-style restart, and React rendering |
| Cross-language conformance | `tests/event/cross-language`, `conformance/event/v0` | Both languages agree on valid/invalid inputs and repair; each reads, resumes, appends, and forks the other's plain/Zstd files; Python events render in Trajectory |
| Python implementation | `packages/event/python/tests` | Native Session, surface, repair, codecs, persistence, recovery, and 20,000-Event history work without TypeScript |
| Published artifacts | `tests/package`, `packages/event/python/tests/package_consumer.py` | Packed SDK/UI and Python wheel install into blank consumers and work through public APIs |

Run the complete matrix:

```bash
npm run verify
```

Focused commands are also available: `test:upstream`,
`test:upstream:ui-runtime`, `test:runtime`, `test:sdk`, `test:ui`, `test:system`,
`test:conformance`, `test:types`, `test:python`, `test:package`, and
`test:python:package`.

The current complete run checks 207 retained files, 10 documented differences,
87 declared specifier mappings, and 1002 behavior tests before the two blank
consumer installation checks.

## Known gaps

Three upstream test files are excluded in the root `vitest.config.ts`:

| Excluded test | Reason | Coverage status |
| --- | --- | --- |
| `packages/core/session/tests/gen-persistence-catalog.spec.ts` | Verifies DSH monorepo code generation, not Session behavior | Not applicable to the extraction |
| `packages/client/ui-trajectory/tests/client-bundle.client.spec.ts` | Asserts the DSH browser `ModuleLoader` packaging contract; the extraction ships Vite ESM | Replaced by `tests/package` |
| `packages/client/ui-trajectory/tests/views.client.spec.tsx` | Mounts the complete DSH shell (slot ring, Conversation tabs, locale plugin) | **Ported.** `tests/ui/trajectory-view.spec.tsx` runs its 25 shell-independent cases (ledger and inspector interactions, timeline projection, view state) against the standalone host with the upstream assertions unchanged. The six remaining cases test plugin registration, tab labels, and the Node plugin half, which the Event component does not have |

Three host-only test files are not retained in the extraction:

| Test in pinned snapshot | Reason | Coverage status |
| --- | --- | --- |
| `packages/core/session/tests/scoped.spec.ts` | Tests dsh-scope's scope-filtered dispatch, a Harness host mechanism the Perix host does not have | Every listener hears every session by design |
| `packages/core/session/tests/typert.spec.ts` | Tests the Typert lookup registration removed with Cordis | Not applicable |
| `packages/core/session/tests/invariant.spec.ts` | Tests the Cordis invariants companion plugin removed in R13 | Not applicable |

Their original bytes, and the three omitted package-owned `src/invariant.ts`
companions, remain under `third_party/deepseek-harness/upstream/` for audit.
