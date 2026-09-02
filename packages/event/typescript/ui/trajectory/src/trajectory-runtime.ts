import type { Context } from '@deepseek-ai/cordis'
import type {
  SessionEventLikeEntry,
  SessionLiveEventEntry,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {
  ConversationNodeDefinition,
  ConversationViewDefinition,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionEvent } from '@perix/event-sdk/session/types'
import {
  ConversationNodeAssembler,
  inspectRequestPrompt,
} from './conversation-client.js'
import { registerTrajectoryAssistantDefinition } from '../../../packages/client/ui-trajectory/src/client/trajectory-assistant-definition.ts'
import { registerTrajectoryCompactionDefinitions } from '../../../packages/client/ui-trajectory/src/client/trajectory-compaction-definition.ts'
import type { TrajectorySnapshot } from '../../../packages/client/ui-trajectory/src/client/trajectory-contract.ts'
import { registerTrajectoryMessageDefinitions } from '../../../packages/client/ui-trajectory/src/client/trajectory-message-definitions.ts'
import { registerTrajectoryRequestHeaderDefinition } from '../../../packages/client/ui-trajectory/src/client/trajectory-request-header-definition.ts'
import {
  EMPTY_TRAJECTORY_SNAPSHOT,
  trajectoryViewDefinition,
} from '../../../packages/client/ui-trajectory/src/client/trajectory-snapshot-builder.ts'
import { registerTrajectoryToolDefinition } from '../../../packages/client/ui-trajectory/src/client/trajectory-tool-definition.ts'

const definitions: ConversationNodeDefinition[] = []
const registrationContext = {
  uiConversation: {
    events: {
      register: (definition: ConversationNodeDefinition) => {
        definitions.push(definition)
        return () => {}
      },
    },
    inspectRequestPrompt,
  },
} as unknown as Context

registerTrajectoryMessageDefinitions(registrationContext)
registerTrajectoryRequestHeaderDefinition(registrationContext)
registerTrajectoryAssistantDefinition(registrationContext)
registerTrajectoryToolDefinition(registrationContext)
registerTrajectoryCompactionDefinitions(registrationContext)

class EventDefinitions {
  entries(): readonly ConversationNodeDefinition[] {
    return definitions
  }

  fallbackEntry(): undefined {
    return undefined
  }
}

class ViewDefinitions {
  entries(): readonly ConversationViewDefinition[] {
    return [trajectoryViewDefinition]
  }
}

function liveEntry(event: SessionEvent): SessionLiveEventEntry {
  return { type: 'event', event }
}

function historyEntry(event: SessionEvent): SessionEventLikeEntry {
  return liveEntry(event)
}

/** Standalone observable around the retained Conversation assembler. */
export class EventTrajectoryRuntime implements ObservableSnapshot<TrajectorySnapshot> {
  private assembler = new ConversationNodeAssembler(
    new EventDefinitions(),
    new ViewDefinitions(),
  )

  private snapshot = EMPTY_TRAJECTORY_SNAPSHOT
  private readonly listeners = new Set<() => void>()

  constructor(events: readonly SessionEvent[] = [], hasMore = false) {
    this.replace(events, hasMore)
  }

  getSnapshot = (): TrajectorySnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  replace(events: readonly SessionEvent[], hasMore = false): void {
    this.assembler = new ConversationNodeAssembler(
      new EventDefinitions(),
      new ViewDefinitions(),
    )
    this.assembler.replaceWindow(events.map(historyEntry), hasMore)
    this.assembler.activateTarget('trajectory')
    this.publish()
  }

  append(event: SessionEvent): void {
    this.assembler.append(liveEntry(event))
    this.assembler.flush()
    this.publish()
  }

  private publish(): void {
    const next = this.assembler.snapshot('trajectory') as TrajectorySnapshot | undefined
      ?? EMPTY_TRAJECTORY_SNAPSHOT
    if (next === this.snapshot) return
    this.snapshot = next
    for (const listener of [...this.listeners]) listener()
  }
}
