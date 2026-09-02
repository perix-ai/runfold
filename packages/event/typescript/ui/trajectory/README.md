# Perix Event UI

A standalone host for the unchanged DeepSeek Harness Trajectory implementation.
This is a browser-only React library; its public API is the `EventTrajectory`
component and its props. Projection runtime details remain internal.

It accepts `SessionEvent[]` from `@perix/event-sdk/session/types`, feeds them
through DSH's original conversation assembler and Trajectory projection, and
renders DSH's original `TrajectoryView`.
The host supplies only the services that normally come from the full DSH shell.
Its store, Tooltip, JsonTree, Markdown/KaTeX/Shiki pipeline, and selected icons
are the exact runtime import closure copied from the same pinned DSH source;
no DSH registry package is installed or bundled.

```bash
npm install
npm run dev:event-ui
```

Add `?events=20000` to the demo URL to exercise a long event history.

Applications render `EventTrajectory` with Perix Event values:

```tsx
import { EventTrajectory } from '@perix/event-ui'
import type { SessionEvent } from '@perix/event-sdk/session/types'
import '@perix/event-ui/style.css'

export function Trajectory({ events }: { events: readonly SessionEvent[] }) {
  return <EventTrajectory events={events} locale="zh" />
}
```

## Known limitations of the standalone host

The complete DSH Conversation shell provides capabilities outside the retained
`TrajectoryView`'s Event-derived data path. The standalone component omits
those shell contracts, so the following capabilities are intentionally
unavailable here:

| Upstream prop / service | Standalone behavior | Effect |
| --- | --- | --- |
| `useSessions`, `useWorkspaces`, `useSessionPendingInteraction` | not part of the standalone component contract | no session list, workspace, or pending-interaction affordances |
| `renderSlot` | returns `null` | no shell-registered slot content inside the view |
| `viewRequest`, `openView`, `completeViewRequest` | `null` / no-op | no cross-view navigation |
| `inputActions`, `useInput` | not part of the standalone component contract | the component does not host a composer |
| `useProjection` | not part of the standalone component contract | no non-Trajectory projections |
| Session snapshot identity | fixed `standalone-trajectory` internally | one session per component instance |

Everything the projection derives from the Event log itself (turns, steps,
tool calls, chunks, compaction, request headers, search, timeline, pagination)
is unchanged.

The public declaration contains no `@deepseek-ai/*` imports or `Dsh*` names.
Tests for projection, rendering, localization, pagination, replacement, and a
20,000-event history live in `../../tests/ui`, alongside the port of the
upstream view test cases that do not need the DSH shell. The retained store and
selected UI-primitives add 182 upstream cases and 48 DOM compatibility fixtures.

Source provenance and the exact extraction boundary are documented in
`packages/event/typescript/README.md`. The untouched upstream reference
is stored separately under `third_party/deepseek-harness/upstream/`.
