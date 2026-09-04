# Event trajectory infrastructure decision record

> Language: English | [中文](decisions.zh.md)
>
> Document type: lightweight architecture decision record (ADR). Each entry
> records a tradeoff that cannot be inferred directly from code: context,
> decision, consequences, and related items. Append new decisions at the end.
> Mark superseded decisions as "Superseded by Dxx" instead of deleting them.

## D01 · Do not vendor or bundle Cordis; replace host seams with a local EventHost

- Date: 2026-09-01
- Context: DSH's `SessionStore`, `SessionPersistence`, and JSONL backend inherit
  from Cordis `Service` and depend on `ctx.effect/on/emit/parallel`, scope
  carriers, typert registration, and `declare module` augmentation. Bundling
  Cordis into an internal chunk could hide it from published dependencies, but
  the lifecycle semantics of Event would still be defined by a plugin platform,
  creating an inverted dependency.
- Decision: Do not vendor or bundle Cordis. Retained source may change only at
  host-seam lines. `EventHost` in `runtime/src/host.ts` supplies the event bus,
  reverse-order ownership scopes, and composition slots, and reproduces the one
  Cordis rule that a service view read through a scope binds to that scope.
- Consequences: Five retained files enter the allowed-difference list. Scope-
  filtered dispatch, typert, and invariant plugins are not retained, so three
  corresponding upstream tests are excluded. The other 626 upstream tests pass
  unchanged through test-only shims. R30 adds 11 independent tests covering
  EventHost events, effects, scopes, disposal, and service binding, and fixes
  two deviations: reentrant disposal during effect initialization and
  observation of asynchronous rejection.
- Related: tasks.md R16–R21; [`architecture.md`](architecture.md) section 3.4.

## D02 · Delete the early greenfield Runtime Data draft

- Date: 2026-09-01
- Context: The repository's early `spec/`, `rfcs/0001`, `schemas/v0`,
  `conformance/cases`, `adapters/`, `docs/architecture.md`, and
  `docs/invariants.md` described namespaces, `event_id`, one-based sequences,
  and Checkpoint-based forks in which parent events were not copied. That model
  conflicted with the DSH Event model being extracted: zero-based sequences,
  prefix-copying forks, and no namespace.
- Decision: Delete the draft without retaining an annotated copy; Git history
  preserves it.
- Consequences: The repository describes only the Event infrastructure. State,
  Checkpoint, Artifact, Effect, and other facilities require separate
  requirements after Event is production-ready.
- Related: tasks.md R03.

## D03 · Python does not use a cross-process file lock

- Date: 2026-09-01
- Context: The Python port once wrote `.event.lock` in each Session directory as
  an advisory lock. DSH's JSONL backend has no cross-process lock, and the
  specification incorrectly described that Python-only behavior as a shared
  contract.
- Decision: Delete the file lock and retain the in-process `RLock`. Both
  implementations use the same single-writer contract: the caller guarantees
  that only one process writes a given Session at a time.
- Consequences: Both implementations leave the same disk footprint. If Nexent
  needs multiprocess exclusion, that will require a separate requirement.
- Related: tasks.md R01, R11.

## D04 · Initially bundle the Trajectory UI dependency closure from the registry unchanged (superseded by D05)

- Date: 2026-09-01
- Context: At runtime, `@runfold/trajectory-ui` actually used only subsets of
  `dsh-client-store` and `dsh-client-ui-primitives`; more than twenty other DSH
  packages supplied types only. The runtime packages were bundled, so consumers
  installed no DSH package.
- Decision: During R24 evaluation, retain the "bundle unchanged" approach and
  do not trim shiki syntax support. Use root `overrides` to pin the registry
  closure to the snapshot version during repository development.
- Consequences: This describes the transitional state during R24. R25–R29 later
  replaced it under D05: the actual store and UI-primitives runtime closure was
  extracted from the fixed snapshot, necessary general third-party dependencies
  were declared directly, and 25 DSH devDependencies, root `overrides`, and all
  DSH packages in the lockfile were removed. This entry no longer describes the
  current dependency state.
- Related: tasks.md R24.

## D05 · Remove DSH names and registry dependencies completely (completed)

- Date: 2026-09-01
- Completed: 2026-09-02
- Context: `@deepseek-ai/*` import names in retained source resolved through six
  build and test aliases, and the UI closure still depended on 25 registry
  packages under D04. The consumer required both names and real dependencies to
  be removed from code.
- Decision: Establish R25–R29 in
  [`tasks/R25-R29-dsh-free.md`](tasks/R25-R29-dsh-free.md). The key design changes
  the identity verifier to apply an explicit mapping table to upstream content
  before byte comparison, keeping upstream identity machine-verifiable after
  import rewrites. Retain the `@runfold/event/runtime` self-reference because a
  relative `.ts` path in `declare module` cannot enter the published `.d.ts`.
- Consequences: After R25–R29, production imports, installation manifests, the
  lockfile, `npm ls --all`, and SDK/UI artifacts contain no DSH registry
  namespace. R36 further replaces module specifiers and test-configuration
  aliases in retained tests with local relative paths governed by identity
  verification. Fixed upstream names remain only in audit manifests,
  provenance/license text, and tests asserting that names do not leak; none
  participate in module resolution. Identity verification currently covers 204
  files, 10 necessary differences, and 139 declaration mappings. Complete
  verification passes 1,005 behavioral tests plus blank TypeScript and Python
  consumer installations.
- Related: tasks.md section 3.2 and R36.

## D06 · Use Runfold as the technical identity; separate maintainer identity from the legal copyright holder

- Date: 2026-09-03
- Context: The project will serve other teams as an independent agent runtime
  data platform. Embedding the maintainer organization's name in packages,
  imports, schemas, and downstream UI would unnecessarily carry it into
  consumer code. Completely hiding the maintainer and original rights holder
  would make the copyright boundary unclear.
- Decision: Name the independent project Runfold and use Runfold consistently
  as the public technical identity of TypeScript, Python, schemas, and UI.
  Perix.ai is the project maintainer's name. Under the user's R50 confirmation,
  the natural person Heiki Scott is the current copyright holder for original
  Runfold code, modifications, and protectable arrangement. Preserve the fixed
  DeepSeek Harness provenance, original copyright, and MIT license in full.
- Consequences: Version 0.1.0 had not been publicly released, so the migration
  was clean and provided no compatibility alias for old package names. Task and
  acceptance records from before the migration retain the old name as
  historical fact but do not define the current API.
- Related: tasks.md R45–R50.

## D07 · Keep the GitHub organization perix-ai; register Runfold publication namespaces

- Date: 2026-09-03
- Context: D06 raised a naming-layer question: packages and imports use Runfold,
  while the code is hosted at `github.com/perix-ai/runfold`. Checks on
  2026-09-03 found all four relevant namespaces available: npm scope `@runfold`,
  `@runfold/event`, `@runfold/trajectory-ui`, PyPI names `runfold-event` and
  `runfold`, and GitHub organization `runfold`. The `perix-ai` organization
  already existed.
- Decision: Keep the GitHub organization `perix-ai`. There are three reasons:
  the organization identifies the maintainer while the repository identifies
  the product, making `perix-ai/runfold` conventional and `runfold/runfold`
  redundant; moving would erase the deliberate product/maintainer separation
  established by D06; and consumers type only `npm i @runfold/event` or
  `pip install runfold-event`, while the organization appears only in repository
  URLs. Register the npm `@runfold` scope and PyPI `runfold-event` before first
  publication so names recorded by R52 cannot be taken.
- Consequences: Repository metadata points to `github.com/perix-ai/runfold`. If
  Runfold later needs independence from its maintainer (`COPYRIGHT.md` already
  allows for rights transfer), create a `runfold` organization and transfer the
  repository then. GitHub retains redirects for rename and transfer, so the
  future cost remains manageable.
- Related: tasks.md R52 and R59; task brief
  `tasks/R52-R59-release-governance.md`.
