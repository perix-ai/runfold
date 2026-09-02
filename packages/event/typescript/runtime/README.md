# Perix Event runtime modules

Perix-authored TypeScript that replaces the DeepSeek Harness host and utility
packages the retained Event sources import. Nothing here is upstream source;
each file states what it was copied or reduced from and why.

| Module | Replaces | Content |
| --- | --- | --- |
| `src/brand.ts` | `@deepseek-ai/dsh-brand` | `Branded`, `brandString` — verbatim |
| `src/values.ts` | `@deepseek-ai/dsh-util-values` | JSON snapshot, equality, and deep-freeze helpers — verbatim body |
| `src/timeout.ts` | `@deepseek-ai/dsh-timeout` | `MAX_TIMER_DELAY_MS` — the one constant persistence uses |
| `src/messages.ts` | `@deepseek-ai/dsh-llm` (`.`, `/brand`, `/types`), `ImageAttachmentRef` from `@deepseek-ai/dsh-attachment` | Ids, content blocks, message shapes and constructors, stream chunks, `LlmCallConfig`, `callConfigEquals` — copied types and functions; no LLM runtime |

The retained sources under `../packages/` keep their upstream `@deepseek-ai/*`
import specifiers. Build and test configuration resolves those specifiers to
these modules, so the published `@perix/event-sdk` bundles this directory and
depends on none of the replaced packages.

Behavior is locked by the retained upstream test suites, which run against
these modules through the same resolution, and by `../tests/sdk/messages.spec.ts`.
