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
- `@perix/event-sdk/runtime` for `EventHost` (ownership scopes, lifecycle
  events, composition slots); the root entry also exports
  `createEventRuntime()` (Perix-owned; see `../runtime/README.md`)
- `@perix/event-sdk/messages` for Event-compatible message constructors and
  value types (Perix-owned; see `../runtime/README.md`)

The upstream `*/invariant` companion modules are Cordis diagnostic plugins,
not Event behavior, and are intentionally not exported.

Consumers can therefore construct and host the Event system using only
`@perix/*` import specifiers:

```ts
import { createEventRuntime, SessionId } from '@perix/event-sdk'
import JsonlSessionPersistence from '@perix/event-sdk/persistence-jsonl'
import { createUserMessage } from '@perix/event-sdk/messages'

const runtime = createEventRuntime({
  persistence: host => new JsonlSessionPersistence(host, { root: './sessions', compression: 'none' }),
})
const session = runtime.sessions.create(SessionId('example'), { meta: { cwd: process.cwd() } })
session.append('user/message', createUserMessage({
  content: [{ type: 'text', text: 'hello' }],
  source: { kind: 'user' },
}), { surfaceOp: 'append' })
await runtime.sessions.flush(session)
const restored = await runtime.restore(SessionId('example'))
await runtime.dispose()
``` Names from the upstream implementation remain
internal provenance only: the published JavaScript mentions no DSH package,
the declarations reference none, and the package depends on none.

The package's own tests live in `../tests/sdk`; the complete cross-package and
packed-consumer matrix is documented in the parent `TESTING.md`.

The exact DSH source mapping and local-change policy are documented in the
parent `README.md`.
