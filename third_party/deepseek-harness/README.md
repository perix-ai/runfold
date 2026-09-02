# DeepSeek Harness upstream snapshot

Upstream: `https://github.com/deepseek-ai/deepseek-harness`

Pinned revision: `dd6322d604e00eec1ba5e0c8541159906a21094a`
(`0.1.2-alpha.3`).

`upstream/` is a scoped, unmodified source snapshot exported directly from the
pinned Git commit. It is reference material only; production code does not
import from it.

## Contents

The snapshot contains every upstream package that the retained Event and
Trajectory sources import, so the whole first-level dependency closure can be
audited offline. Packages are grouped by how the extraction uses them.

Retained and cut into `packages/event/typescript/packages/`:

| Upstream directory | Package |
| --- | --- |
| `packages/core/session` | `@deepseek-ai/dsh-session` |
| `packages/session/session-persistence` | `@deepseek-ai/dsh-session-persistence` |
| `packages/session/session-persistence-jsonl` | `@deepseek-ai/dsh-session-persistence-jsonl` |
| `packages/client/ui-trajectory` | `@deepseek-ai/dsh-client-ui-trajectory` |
| `packages/client/ui-conversation` | `@deepseek-ai/dsh-client-ui-conversation` (subset retained) |
| `packages/client/ui-renderer` | `@deepseek-ai/dsh-client-ui-renderer` (subset retained) |
| `packages/client/ui-theme` | `@deepseek-ai/dsh-client-ui-theme` (styles retained) |
| `packages/client/locale` | `@deepseek-ai/dsh-client-locale` (dictionaries retained) |
| `packages/test-support/client-runtime` | `@deepseek-ai/dsh-client-test-runtime` (translate helper retained) |

Referenced by the retained Event core and persistence sources. These are the
dependencies that the TypeScript decoupling (see `docs/event/tasks.md`,
section 3) replaces with local code:

| Upstream directory | Package |
| --- | --- |
| `vendor/cordis` | `@deepseek-ai/cordis` |
| `vendor/schemastery` | `@deepseek-ai/schemastery` |
| `packages/core/scope` | `@deepseek-ai/dsh-scope` |
| `packages/llm/llm` | `@deepseek-ai/dsh-llm` |
| `packages/runtime-diagnostics/invariants` | `@deepseek-ai/dsh-invariants` |
| `packages/typert/protocol` | `@deepseek-ai/dsh-typert-protocol` |
| `packages/typert/registry` | `@deepseek-ai/dsh-typert-registry` (upstream tests only) |
| `packages/util/brand` | `@deepseek-ai/dsh-brand` |
| `packages/util/timeout` | `@deepseek-ai/dsh-timeout` |
| `packages/util/values` | `@deepseek-ai/dsh-util-values` |

Referenced by the retained Trajectory UI closure. At build time these are
resolved from the npm registry at the pinned version and bundled into
`@perix/event-ui`; consumers never install them:

| Upstream directory | Package |
| --- | --- |
| `packages/api/session-controller` | `@deepseek-ai/dsh-api-session-controller` |
| `packages/api/workspace-controller` | `@deepseek-ai/dsh-api-workspace-controller` |
| `packages/attachment/attachment` | `@deepseek-ai/dsh-attachment` |
| `packages/client/store` | `@deepseek-ai/dsh-client-store` |
| `packages/client/ui-chat` | `@deepseek-ai/dsh-client-ui-chat` |
| `packages/client/ui-primitives` | `@deepseek-ai/dsh-client-ui-primitives` |
| `packages/client/ui-session` | `@deepseek-ai/dsh-client-ui-session` |
| `packages/client/ui-slots` | `@deepseek-ai/dsh-client-ui-slots` |
| `packages/compaction/compaction` | `@deepseek-ai/dsh-compaction` |
| `packages/core/agent` | `@deepseek-ai/dsh-agent` |
| `packages/core/tools` | `@deepseek-ai/dsh-tools` |
| `packages/interaction/commands` | `@deepseek-ai/dsh-commands` |
| `packages/llm/llm-retry` | `@deepseek-ai/dsh-llm-retry` |
| `packages/todo/tool-todo` | `@deepseek-ai/dsh-tool-todo` |

The snapshot also includes the upstream workspace manifests, lockfile, and
TypeScript base configurations needed to interpret those packages. It is not a
complete copy of the DeepSeek Harness repository, but every included file is
byte-for-byte identical to the pinned revision. `node_modules`, `lib`, and
`dist` directories are never included.

The runnable TypeScript extraction and its source mapping are documented in
`packages/event/typescript/README.md`.

The upstream MIT license is preserved both in `LICENSE` and
`upstream/LICENSE`.
