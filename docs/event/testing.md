# Event trajectory infrastructure verification strategy

> Language: English | [中文](testing.zh.md)
>
> Document type: verification strategy. This document explains how the project
> proves that requirements are met without behavioral regression. See
> [`packages/event/typescript/TESTING.md`](../../packages/event/typescript/TESTING.md)
> for the test-file matrix and commands.

## 1. Principle

Testing is part of the extraction itself, not a final addition. Any code
rewritten to remove a DSH dependency must first have its behavior locked by the
retained upstream tests, then gain tests for the new public interface and
cross-language contract.

## 2. Verification layers

| Layer | What it proves | Location |
| --- | --- | --- |
| Documentation pairing | The five governing documents have canonical English and Chinese translation copies, valid language links, no orphan file, and matching last-change commits | `scripts/verify-doc-pairs.mjs` |
| Upstream identity | Retained source is byte-for-byte identical to the fixed commit except for registered host seams | `scripts/verify-upstream-identity.mjs`, the first upstream check in `npm run verify` |
| Public project identity | Current source, configuration, documentation, and Nexent patches do not reintroduce the legacy technical identity; maintainer ownership, historical provenance, and negative tests remain only through file-level allowances | `scripts/verify-public-identity.mjs` |
| Upstream behavioral baseline | DSH Event, persistence, and Trajectory regression tests pass unchanged against the extracted implementation | `packages/event/typescript/packages/**/tests`, run through `test-support/` shims |
| Host lifecycle | `EventHost` is equivalent for the Cordis lifecycle subset used by retained code, including events, effects, scopes, disposal, and service binding | `packages/event/typescript/tests/runtime/` |
| Single-language implementation | TypeScript and Python each pass unit, integration, persistence, and invalid-input tests | `packages/event/<language>/tests/` |
| Cross-language contract | Shared fixtures have identical accept/reject outcomes, repair results, and Event type lists; TS writes/Python reads and writes, Python writes/TS reads and writes; restore/resume/fork work in both directions; real Nexent parent/child trajectories pass TS public restore and UI acceptance | `conformance/event/v0/`, `tests/event/cross-language/` |
| UI | DSH view behavior is preserved through upstream view cases ported to an independent host; Python-generated and large trajectories render | `packages/event/typescript/tests/ui/` |
| Published artifacts | TS packages install into a blank project; Python builds a wheel in an isolated builder and installs only that artifact into a second blank environment with `--no-index`; strict type boundaries, public runtime behavior, and absence of DSH references all pass | `packages/event/typescript/tests/package/`, `packages/event/python/tests/package_consumer.py` |

## 3. Required scenarios

- Clean shutdown, truncated or damaged log repair, sequence conflict, and
  concurrent Sessions;
- Plain-text and Zstandard physical formats, including packed chunk-row writes
  and expansion;
- Append after restore; idempotent reopening when the log already ends with
  `session/end-seed`; one new boundary on the next restore after a new live
  suffix; fork limited to stable prefixes;
- TypeScript writes/Python reads and writes, and Python writes/TypeScript reads
  and writes;
- UI rendering for Python-generated trajectories and histories on the order of
  20,000 Events.

## 4. Known gaps

Upstream tests excluded from the extraction tree and their rationale are listed
under "Known gaps" in
[`packages/event/typescript/TESTING.md`](../../packages/event/typescript/TESTING.md).
Each item is either covered by an equivalent test under the independent host or
tests a shell mechanism that the Event component does not provide.

## 5. Entry point

The complete gate first checks all five bilingual documentation pairs, then
verifies 204 retained files, 10 necessary differences, and 139 declaration
mappings. It runs 1,005 behavioral tests (626 Event, 182 UI runtime, 94
Trajectory, 11 EventHost, 15 SDK, 33 UI, 36 Python, 1 system, and 7
cross-language), then installs blank TypeScript and Python consumers. After
building, it scans Runfold's public identity; both blank consumers also verify
package names, contents, and bundled licenses.

```bash
npm run verify
```

See the `scripts` section of `package.json` and TESTING.md for commands that run
individual layers.
