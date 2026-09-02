/**
 * Event-shape augmentations required by the retained Trajectory state machines.
 *
 * Copied from the following DeepSeek Harness type outlets at commit
 * dd6322d604e00eec1ba5e0c8541159906a21094a, with only imports and the
 * augmentation target changed to the standalone Event SDK:
 *
 * - packages/core/agent/src/types.ts
 * - packages/core/tools/src/types.ts
 * - packages/compaction/compaction/src/types.ts
 * - packages/llm/llm-retry/src/types.ts
 * - packages/interaction/commands/src/{brand,types}.ts
 * - packages/todo/tool-todo/src/types.ts
 */
import type { Branded } from './brand.ts'
import type {
  ContentBlock,
  LlmFailure,
  TokenUsage,
  ToolCallId,
  UserMessage,
} from './messages.ts'

export type CommandId = Branded<'CommandId'>
export type CompactionId = Branded<'CompactionId'>
export type RetryId = Branded<'RetryId'>

/** One of the two ordered pending-message lists owned by an agent. */
export type InboxTarget = 'next-turn' | 'next-step'

/** Payload recorded when one nested PTC Tool dispatch starts. */
export interface PtcDispatchStartEventData {
  rootCallId: ToolCallId
  parentCallId: ToolCallId
  subCallId: ToolCallId
  name: string
  arguments: unknown
}

/** Payload recorded when one nested PTC Tool dispatch settles. */
export interface PtcDispatchEventData extends PtcDispatchStartEventData {
  isError: boolean
  content: ContentBlock[]
}

/** Durable payload recorded before one provider-routed request retry wait. */
export type LlmRetryEventData =
  | {
    retryId: RetryId
    turn: number
    step: number
    provider: string
    mode: 'normal'
    policyKey: string
    retry: number
    maxRetries: number
    delayMs: number
    failure: LlmFailure
  }
  | {
    retryId: RetryId
    turn: number
    step: number
    provider: string
    mode: 'always'
    policyKey: string
    retry: number
    delayMs: number
    failure: LlmFailure
  }

/** Durable transition recorded after one retry delay completes. */
export interface LlmRetryStartedEventData {
  retryId: RetryId
  turn: number
  step: number
  retry: number
}

/** One entry in an agent's whole-list todo snapshot. */
export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface CommandSourceMap {
  user: { kind: 'user' }
}

export type CommandSource = CommandSourceMap[keyof CommandSourceMap]

declare module '@perix/event-sdk/session/types' {
  interface SessionEventMap {
    'agent/inbox/spliced': {
      target: InboxTarget
      start: number
      removedCount?: number
      inserted: UserMessage[]
      outcome?: 'canceled'
    }
    'tool/code-dispatch-start': PtcDispatchStartEventData
    'tool/code-dispatch': PtcDispatchEventData
    'compaction/start': {
      compactionId: CompactionId
      sourceCommandId?: CommandId
      turn: number | null
    }
    'compaction/summary': {
      compactionId: CompactionId
      sourceCommandId?: CommandId
      summary: ContentBlock[]
      shadowedRange: { start: number; end: number }
      shadowedSeqs: number[]
      shadowedTokenCount: number
      provider: string
      model: string
      maxTokens?: number
      usage?: TokenUsage
    } & (
      | { rawOutput: ContentBlock[]; llmStreamCall: true }
      | { rawOutput?: ContentBlock[]; llmStreamCall?: never }
    )
    'compaction/end': {
      compactionId: CompactionId
      sourceCommandId?: CommandId
      turn: number | null
      error?: string
    }
    'compaction/prune': {
      shadowedRange: { start: number; end: number }
      shadowedSeqs: number[]
      shadowedTokenCount: number
    }
    'llm/retry': LlmRetryEventData
    'llm/retry-started': LlmRetryStartedEventData
    'command/run': {
      commandId: CommandId
      name: string
      args?: string
      source: CommandSource
    }
    'command/done': {
      commandId: CommandId
      kind: 'success' | 'error'
      text?: string
      sourceEventSeq?: number
    }
    'todo/write': { todos: TodoItem[] }
  }
}
