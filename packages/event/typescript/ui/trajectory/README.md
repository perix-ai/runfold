# Perix Event UI

A standalone host for the unchanged DeepSeek Harness Trajectory implementation.
This is a browser-only React library; its public API is the `EventTrajectory`
component and its props. Projection runtime details remain internal.

It accepts `SessionEvent[]` from `@perix/event-sdk/session/types`, feeds them
through DSH's original conversation assembler and Trajectory projection, and
renders DSH's original `TrajectoryView`.
The host supplies only the services that normally come from the full DSH shell.

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

The public declaration contains no `@deepseek-ai/*` imports or `Dsh*` names.
Tests for projection, rendering, localization, pagination, replacement, and a
20,000-event history live in `../../tests/ui`.

Source provenance and the exact extraction boundary are documented in
`packages/event/typescript/README.md`. The untouched upstream reference
is stored separately under `third_party/deepseek-harness/upstream/`.
