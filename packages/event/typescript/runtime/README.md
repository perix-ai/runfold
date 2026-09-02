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
| `src/host.ts` | `@deepseek-ai/cordis` `Context`/`Service`, `@deepseek-ai/dsh-scope` carriers | `EventHost`: an event bus for the four `session/*` events (plus the `internal/dispatch` instrumentation hook), ownership scopes with reverse-order disposal, and `provide`/`get` composition slots. No plugin registry, no scope-filtered dispatch, no Typert |
| `src/create.ts` | DSH plugin composition (`ctx.plugin(SessionStore)` + a persistence plugin) | `createEventRuntime()`: one host, one Session store, an optional persistence backend, `restore(id)`, and `dispose()` |
| `src/ui-types.ts` | Session controller, client store, UI slots, locale, and attachment type outlets listed in the file header | Type-only contracts consumed by the standalone Trajectory host; fields are copied from the pinned source and host-bound declarations are reduced only to the members the retained UI reads |
| `src/event-types.ts` | Agent, tools, compaction, retry, commands, and todo event type outlets listed in the file header | The retained Trajectory event-map augmentations, with their module target changed to the public Perix Session types path |

Core and UI source imports under `../packages/` are rewritten only through the
per-file mappings enforced by `../../../../scripts/verify-upstream-identity.mjs`.
They resolve directly to these modules, the retained implementation, or the
public `@perix/event-sdk` type path. Original DSH module names remain only in
upstream tests and provenance text while R28 localizes the final two UI runtime
packages.

`EventHost` reproduces the one Cordis behavior the retained lifecycle relies
on: a service read through a scope (`scope.sessions`) is a proxy view whose
`ctx` is that scope, so a Session created through a child scope is owned by
the child and torn down with it. Views forward every other read and write to
the single underlying instance.

Behavior is locked by the retained upstream test suites, which run against
these modules through the same resolution (`../test-support/cordis-shim.ts`
adapts their `ctx.plugin` / `fiber.dispose` vocabulary onto host scopes), and
by `../tests/sdk/`.
