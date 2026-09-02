# TypeScript Event implementation

This directory is the TypeScript implementation of Event. Trajectory is not a
peer abstraction: it is an Event-derived projection and optional UI contained
within this implementation.

The extraction's dependency-removal policy and source-layout rules are defined in the
[`Event architecture`](../../../docs/event/architecture.md).

Copied DSH code keeps its upstream relative path wherever practical. New
directories and files are allowed when they are required to make the extraction
an independently buildable, publishable, or runnable library; every such local
addition is identified explicitly below and must not be presented as upstream
DSH source.

## Upstream basis

The implementation is cut from DeepSeek Harness `0.1.2-alpha.3`, commit
`dd6322d604e00eec1ba5e0c8541159906a21094a`. The unmodified audit snapshot is at
`third_party/deepseek-harness/upstream/`.

| DeepSeek Harness source | Local implementation | Treatment |
| --- | --- | --- |
| `packages/core/session` | `packages/core/session` | Complete `src/` and `tests/` retained; `src/index.ts` host seam edited (see below) |
| `packages/session/session-persistence` | `packages/session/session-persistence` | Complete `src/` and `tests/` retained; `src/index.ts` and `src/coordinator.ts` host seam edited |
| `packages/session/session-persistence-jsonl` | `packages/session/session-persistence-jsonl` | Complete `src/` and `tests/` retained; `src/index.ts` host seam edited |
| `packages/client/ui-trajectory` | `packages/client/ui-trajectory` | Reusable source and 94 shell-independent tests retained; type-only imports are mapped locally, while the DSH plugin entry and invariants companion are omitted |
| `packages/client/ui-conversation` | same path | Assembler, location index, and four transitive contract files retained; their dependency specifiers alone are mapped locally |
| `packages/client/ui-renderer` | same path | Snapshot binding retained with its type-only store specifier mapped locally |
| `packages/client/store` | same path | The two-file observable store implementation and its complete 20-case upstream test retained; Cordis invariants companion omitted |
| `packages/client/ui-primitives` | same path | Exact 23-file runtime closure reached by Trajectory, 8 focused upstream suites, and 48 DOM fixtures retained; unrelated atoms omitted |
| `packages/client/ui-theme` | same path | Unchanged Trajectory theme styles retained |
| `packages/client/locale` | same path | Unchanged English and Chinese dictionaries retained |
| `packages/test-support/client-runtime` | same path | Unchanged translation helper retained |

The closed extraction currently contains 207 retained files. The identity
verifier accepts 10 documented necessary differences and applies 87 declared
module-specifier mappings before byte comparison; every other retained byte
must match the pinned snapshot.

The publishable boundaries added around this source are:

- `sdk/`: `@perix/event-sdk`, a zero-business-logic export package for Session,
  persistence, and JSONL persistence;
- `ui/trajectory/`: `@perix/event-ui`, the standalone Trajectory library;
- `apps/event/typescript/trajectory-demo/`: a development-only consumer of
  both packages.

All consumer-facing package, component, and test names use the Perix namespace:
`@perix/event-sdk`, `@perix/event-ui`, and `EventTrajectory`. Core Session and
persistence implementation imports and retained UI type imports use explicit
local relative paths; every such import-only rewrite is declared and checked
against the audited upstream bytes by `scripts/verify-upstream-identity.mjs`.
DSH module specifiers remain only in unchanged retained upstream tests and
source provenance text—not in implementation imports, package manifests,
lockfiles, installed dependencies, or published artifacts.

## Necessary local changes

- No retained directory is an npm workspace: the SDK bundles the three Event
  packages from source. Their `package.json` files are upstream bytes; their
  `tsconfig.json` files only drop the monorepo project references, because
  Vite reads the nearest `tsconfig.json` and the referenced directories do not
  exist here.
- **Host seam (Cordis removal).** Five retained source files are edited, and
  only at the lines where they touched the DSH plugin platform:
  `core/session/src/index.ts` drops `Service`, the Typert lookup registration,
  the `dsh-scope` carrier (the carrier is now the session itself), and the
  Cordis module augmentations, and takes an `EventHost` instead of a
  `Context`; `core/session/src/types.ts` drops the Typert remote-error
  augmentation; `session/session-persistence/src/index.ts` does the same for the
  persistence base class (adding a `name` label the JSONL backend already
  overrode); `session/session-persistence/src/coordinator.ts` changes one type
  import; `session/session-persistence-jsonl/src/index.ts` drops the
  Schemastery config schema and `static inject`, validating `root` and
  `compression` in the constructor instead. Session append, fork, repair,
  surface, write-behind, and JSONL logic are untouched. The exact files are
  listed in `scripts/verify-upstream-identity.mjs`; other implementation
  differences are limited to the declared dependency-specifier rewrites below.
- **Local dependency specifiers.** Fourteen core Session and persistence source
  files replace only their DSH import/export specifiers with relative paths to
  the retained packages or `runtime/`. The identity verifier derives those
  relative paths from an explicit per-file mapping and requires the resulting
  file to be otherwise byte-identical to the pinned snapshot.
- **Trajectory type closure.** Retained UI source files replace only their DSH
  type specifiers with paths to the retained conversation contracts, SDK
  Session types, `runtime/ui-types.ts`, or `runtime/event-types.ts`. The latter
  two copy the exact host-facing fields and Event-map augmentations used by
  Trajectory from the source paths named in their headers. The local
  `TrajectoryRegistrationContext` exposes only event/view registration and
  request inspection, eliminating the Cordis cast without changing any
  definition or projection algorithm. All import-only rewrites remain covered
  by the identity verifier.
- **Retained tests kept unmodified.** `vitest.config.ts` aliases
  `@deepseek-ai/cordis` and `@deepseek-ai/dsh-scope` to `test-support/`, a
  test-only shim that provides `ctx.plugin` / `fiber.dispose` on top of host
  scopes. Its remaining core DSH aliases serve unchanged upstream tests only.
  Three host-only tests are not retained: `scoped.spec.ts` (scope-filtered
  dispatch), `typert.spec.ts` (Typert lookup registry), and `invariant.spec.ts`
  (the invariants plugin). The three corresponding `src/invariant.ts`
  companions are also not retained. All six original files remain available
  in `third_party/deepseek-harness/upstream/`.
- The DSH browser-plugin entry
  `packages/client/ui-trajectory/src/client/index.ts` and its package-level
  `src/invariant.ts` are not part of the standalone component and are omitted;
  their original bytes remain in the pinned `third_party` snapshot. The
  extraction registers the same definitions through
  `ui/trajectory/src/trajectory-runtime.ts`.
- **Trajectory runtime closure.** The original two-file client store and the
  exact 23-file UI-primitives import closure are retained under their DSH paths.
  `ui/trajectory/src/ui-primitives.ts` is only a standalone barrel for the
  selected exports; algorithms, styles, Markdown parsing, Shiki highlighting,
  KaTeX rendering, JSON inspection, Tooltip behavior, and icons are unchanged.
  The retained store/primitive regression subset contributes 182 tests and 48
  byte-identical DOM fixtures. Its test-only locale/component bridge contains
  only the two upstream helper fragments those suites need.
- The other retained directories under `packages/client/` and
  `packages/test-support/` are source-only: their files are imported by
  relative path from `ui/trajectory/src`, and their `package.json` and
  `tsdown.config.ts` are kept byte-identical to upstream because npm and Vite
  never read them. The `ui-trajectory` and `ui-primitives` tsconfigs are read by
  Vite's per-file esbuild transform; their unavailable monorepo project
  references are therefore removed while compiler options stay unchanged.
- `ui/trajectory/src/conversation-client.ts` re-exports the unchanged
  conversation runtime modules and contracts needed by Trajectory, and houses
  the smallest standalone registration and image-slot type seam whose original
  files depend on the full DSH browser host.
- `ui/trajectory` contains all reusable standalone host wiring and
  supplies the services that the unchanged DSH Trajectory view normally
  receives from the complete DSH shell. Its manifest directly declares the
  third-party packages used by the retained closure; it has no DSH package
  dependency, and the repository no longer needs npm `overrides` for DSH.
- `runtime/` is Perix-authored code that replaces the DSH utility packages the
  retained sources import: `brand.ts` (`@deepseek-ai/dsh-brand`), `values.ts`
  (`@deepseek-ai/dsh-util-values`), `timeout.ts` (`@deepseek-ai/dsh-timeout`),
  and `messages.ts` (the Event-facing subset of `@deepseek-ai/dsh-llm` plus the
  `ImageAttachmentRef` shape from `@deepseek-ai/dsh-attachment`). Core and
  persistence sources import these modules by relative path; `ui-types.ts` and
  `event-types.ts` provide the host-bound UI contracts and Event augmentations.
  The SDK bundles its imports directly. `vitest.config.ts` still resolves the
  original DSH names used by unchanged upstream tests; TypeScript and
  Trajectory compiler configs contain no DSH aliases. The published SDK depends
  on none of the replaced packages.
  `runtime/README.md` records each file's provenance.
- `sdk/` adds only package exports; the implementation remains in the retained
  DSH package trees above and in `runtime/`. `@perix/event-sdk/runtime` is the
  host (`EventHost`), and the root entry adds `createEventRuntime()`, the
  composition root that replaces `ctx.plugin(SessionStore)` and the
  persistence plugin. Its build bundles those three local implementation
  trees and mechanically rewrites only their internal declaration import paths,
  so an installed package never falls back to registry copies of those Event
  packages.
- The SDK declaration build converts upstream package-name JSDoc into pinned
  source-path provenance. Published SDK/UI JavaScript and declarations contain
  no DSH registry namespace at all; the blank-consumer package test scans every
  generated `.js` and `.d.ts` file and enforces that boundary.
- `ui/trajectory/index.d.ts` intentionally exposes only the browser component
  boundary. Internal DSH shell and projection types remain implementation
  details rather than leaking the full Harness type graph to consumers.

Retained DSH Event and persistence algorithms are unchanged; only documented
host seams and declared module-specifier rewrites differ, while the six listed
host-only files are omitted. `npm run verify:upstream-identity` (the first step
of `npm run verify`) enforces those boundaries against every retained file.
The native Python peer is in
`packages/event/python/`, parallel to this implementation rather than to
Trajectory; both execute the
[`Event v0 contract`](../../../docs/event/specification.md) and fixtures under
`conformance/event/v0/`.

## Test layout

- `packages/**/tests`: upstream behavioral regression tests, including 626
  Event, 182 selected UI-runtime, and 94 Trajectory cases; import-only test
  rewrites are identity-checked against the fixed snapshot;
- `tests/runtime`: 11 direct `EventHost` lifecycle cases covering event order,
  effect setup/disposal/failure, scope teardown, and scoped service views;
- `tests/sdk`: Perix public exports, lifecycle, fork, immutability, JSONL,
  restart, suffix/raw reads, and concurrent-session isolation;
- `tests/ui`: Perix component API, projection, localization,
  pagination callback, input replacement, and a 20,000-event history;
- `tests/integration`: SDK validation through fork,
  persistence, restart, and UI rendering;
- `tests/package`: packs both libraries, installs them into a
  blank project, type-checks the public API strictly, and runs the installed
  SDK.
- `../python/tests`: native Python core, persistence, conformance, large
  history, and blank-environment package tests.
- `test-support/`: test-only Cordis and dsh-scope shims used to run the
  retained upstream suites; never built or published.
- `../../../tests/event/cross-language`: bidirectional TypeScript/Python
  compatibility, shared-conformance tests, and a real Nexent Python trajectory
  restored and rendered by the TypeScript SDK/UI.

Run all layers with `npm run verify`. The current matrix contains 1005 behavior
tests plus TypeScript and Python blank-consumer installation checks. See
`TESTING.md` for the exact matrix.
