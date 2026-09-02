# @perix/event-sdk

The installable TypeScript boundary for the unchanged DeepSeek Harness Event,
persistence, and JSONL persistence implementations retained in this repository.

The package contains no Event business logic. Its modules expose the
corresponding DSH package surfaces while the build bundles the retained local
DSH Event source—not registry copies—into the published package:

- `@perix/event-sdk` and `@perix/event-sdk/session`
- `@perix/event-sdk/session/types`
- `@perix/event-sdk/session/chunk-rows`
- `@perix/event-sdk/session/surface`
- `@perix/event-sdk/persistence`
- `@perix/event-sdk/persistence-jsonl`
- `@perix/event-sdk/runtime` for the runtime `Context` and service primitives
- `@perix/event-sdk/messages` for Event-compatible message constructors and
  value types

The upstream `*/invariant` companion modules are Cordis diagnostic plugins,
not Event behavior, and are intentionally not exported.

Consumers can therefore construct and host the Event system using only
`@perix/*` import specifiers. Names from the upstream implementation remain
internal provenance and transitive implementation details. Generated SDK
artifacts also translate the retained Session, persistence, and
type-symbol identities to their matching `@perix/event-sdk/*` paths.

The package's own tests live in `../tests/sdk`; the complete cross-package and
packed-consumer matrix is documented in the parent `TESTING.md`.

The exact DSH source mapping and local-change policy are documented in the
parent `README.md`.
