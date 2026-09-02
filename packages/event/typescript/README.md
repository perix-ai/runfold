# TypeScript Event implementation

This directory is the TypeScript implementation of Event. Trajectory is not a
peer abstraction: it is an Event-derived projection and optional UI contained
within this implementation.

The extraction's goals, dependency-removal policy, multi-language contract, and
completion criteria are defined in the
[`Event extraction brief`](../../../docs/event/README.md).

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
| `packages/client/ui-trajectory` | `packages/client/ui-trajectory` | Complete package source and tests retained unchanged |
| `packages/client/ui-conversation` | same path | Only the unchanged assembler, location index, and four transitive contract files retained |
| `packages/client/ui-renderer` | same path | Only unchanged snapshot binding retained |
| `packages/client/ui-theme` | same path | Unchanged Trajectory theme styles retained |
| `packages/client/locale` | same path | Unchanged English and Chinese dictionaries retained |
| `packages/test-support/client-runtime` | same path | Unchanged translation helper retained |

The publishable boundaries added around this source are:

- `sdk/`: `@perix/event-sdk`, a zero-business-logic export package for Session,
  persistence, and JSONL persistence;
- `ui/trajectory/`: `@perix/event-ui`, the standalone Trajectory library;
- `apps/event/typescript/trajectory-demo/`: a development-only consumer of
  both packages.

All consumer-facing package, component, and test names use the Perix namespace:
`@perix/event-sdk`, `@perix/event-ui`, and `EventTrajectory`. Original DSH
module specifiers remain only inside retained upstream source and its build
aliases, where changing them would make the source diverge from the audited
upstream implementation. Those retained-source workspaces keep their upstream
package identity, are marked private, and are never the consumer-facing SDK.

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
  listed in `scripts/verify-upstream-identity.mjs`; every other retained file
  is byte-identical to upstream.
- **Retained tests kept unmodified.** `vitest.config.ts` aliases
  `@deepseek-ai/cordis` and `@deepseek-ai/dsh-scope` to `test-support/`, a
  test-only shim that provides `ctx.plugin` / `fiber.dispose` on top of host
  scopes. Three upstream tests that exercise mechanisms the host does not have
  are excluded: `scoped.spec.ts` (scope-filtered dispatch), `typert.spec.ts`
  (Typert lookup registry), and `invariant.spec.ts` (the invariants plugin).
- The other retained directories under `packages/client/` and
  `packages/test-support/` are source-only: their files are imported by
  relative path from `ui/trajectory/src`, and their `package.json` and
  `tsdown.config.ts` are kept byte-identical to upstream because npm and Vite
  never read them. The one exception is
  `packages/client/ui-trajectory/tsconfig.json`: Vite's esbuild transform reads
  the nearest `tsconfig.json`, and the upstream file references monorepo
  directories that do not exist here, so its `references` array is removed.
  Compiler options are unchanged.
- `ui/trajectory/src/conversation-client.ts` only
  re-exports the two unchanged conversation runtime modules needed by
  Trajectory.
- `ui/trajectory` contains all reusable standalone host wiring and
  supplies the services that the unchanged DSH Trajectory view normally
  receives from the complete DSH shell.
- `runtime/` is Perix-authored code that replaces the DSH utility packages the
  retained sources import: `brand.ts` (`@deepseek-ai/dsh-brand`), `values.ts`
  (`@deepseek-ai/dsh-util-values`), `timeout.ts` (`@deepseek-ai/dsh-timeout`),
  and `messages.ts` (the Event-facing subset of `@deepseek-ai/dsh-llm` plus the
  `ImageAttachmentRef` shape from `@deepseek-ai/dsh-attachment`). Retained
  sources keep their upstream specifiers; the SDK build, the test runner, and
  the UI type-check resolve those specifiers to `runtime/` (see
  `sdk/vite.config.ts`, `vitest.config.ts`, `tsconfig.tests.json`, and
  `ui/trajectory/tsconfig.json`), so the published SDK bundles them and depends
  on none of the replaced packages. `runtime/README.md` records each file's
  provenance.
- `sdk/` adds only package exports; the implementation remains in the retained
  DSH package trees above and in `runtime/`. `@perix/event-sdk/runtime` is the
  host (`EventHost`), and the root entry adds `createEventRuntime()`, the
  composition root that replaces `ctx.plugin(SessionStore)` and the
  persistence plugin. Its build bundles those three local implementation
  trees and mechanically rewrites only their internal declaration import paths,
  so an installed package never falls back to registry copies of those Event
  packages.
- The published declarations keep the upstream `@module @deepseek-ai/...`
  JSDoc lines as provenance. They import, re-export, or augment no DSH module,
  and the published JavaScript does not mention the namespace at all;
  `tests/package` enforces both.
- `ui/trajectory/index.d.ts` intentionally exposes only the browser component
  boundary. Internal DSH shell and projection types remain implementation
  details rather than leaking the full Harness type graph to consumers.

No retained DSH Event, persistence, projection, view, style, or behavioral test
source is modified. `npm run verify:upstream-identity` (the first step of
`npm run verify`) enforces this: every file under `packages/` must be
byte-identical to the pinned snapshot except the seven manifests and configs
listed in `scripts/verify-upstream-identity.mjs`, each of which is explained
above. The native Python peer is in
`packages/event/python/`, parallel to this implementation rather than to
Trajectory; both execute the
[`Event v0 contract`](../../../docs/event/contract.md) and fixtures under
`conformance/event/v0/`.

## Test layout

- `packages/**/tests`: unchanged upstream behavioral regression tests;
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
  compatibility and shared-conformance tests.

Run all layers with `npm run verify`. See `TESTING.md` for the exact matrix.
