# DeepSeek Harness upstream snapshot

Upstream: `https://github.com/deepseek-ai/deepseek-harness`

Pinned revision: `dd6322d604e00eec1ba5e0c8541159906a21094a`
(`0.1.2-alpha.3`).

`upstream/` is a scoped, unmodified source snapshot exported directly from the
pinned Git commit. It is reference material only; production code does not
import from it.

The snapshot includes the complete upstream directories required to audit the
Event implementation and Trajectory dependency closure:

- `packages/core/session`
- `packages/session/session-persistence`
- `packages/session/session-persistence-jsonl`
- `packages/client/ui-trajectory`

- `packages/client/ui-conversation`
- `packages/client/ui-renderer`
- `packages/client/ui-theme`
- `packages/client/locale`
- `packages/test-support/client-runtime`

It also includes the upstream workspace manifests and TypeScript base
configurations needed to interpret those packages. This is not a complete copy
of the DeepSeek Harness repository; every included file is nevertheless
byte-for-byte identical to the pinned revision.

The runnable TypeScript extraction and its source mapping are documented in
`packages/event/typescript/README.md`.

The upstream MIT license is preserved both in `LICENSE` and
`upstream/LICENSE`.
