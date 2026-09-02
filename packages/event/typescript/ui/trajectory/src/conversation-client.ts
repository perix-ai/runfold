/**
 * Standalone ESM surface for the exact upstream conversation pieces used by
 * Trajectory. The upstream published `client.js` targets its browser ModuleLoader,
 * so the extraction re-exports the unchanged source modules directly.
 */
import type { ReactNode } from 'react'
import type {
  ConversationNodeDefinition,
  ConversationViewDefinition,
} from '../../../packages/client/ui-conversation/src/client/contract/conversation.ts'
import type {
  ConversationPromptSnapshot,
  RequestPromptInspector,
} from '../../../packages/client/ui-conversation/src/client/contract/request-inspection.ts'
import type { ImageAttachmentRef } from '../../../runtime/src/messages.ts'
import type {
  SessionSnapshot,
  SessionStandardProps,
  SnapshotSelectorHook,
} from '../../../runtime/src/ui-types.ts'

export { ConversationNodeAssembler } from '../../../packages/client/ui-conversation/src/client/conversation/assembler.ts'
export { inspectRequestPrompt } from '../../../packages/client/ui-conversation/src/client/contract/request-inspection.ts'

export type {
  ContextProvenanceView,
  ContextRole,
  KnownContextForm,
} from '../../../packages/client/ui-conversation/src/client/contract/context-provenance.ts'
export type {
  ConversationLocation,
  ConversationMatch,
  ConversationNodeContext,
  ConversationNodeDefinition,
  ConversationPreviousContext,
  ConversationViewBuilder,
  ConversationViewDefinition,
  ConversationViewNode,
} from '../../../packages/client/ui-conversation/src/client/contract/conversation.ts'
export type {
  AssistantBlock,
  AssistantMessageNode,
  AssistantRequestConfig,
  ContextMessageNode,
  ConversationNode,
  PartialAssistant,
  RunningToolCall,
  SteeringMessageNode,
  ToolCallBlock,
  ToolResultNode,
  UserMessageNode,
} from '../../../packages/client/ui-conversation/src/client/contract/records.ts'
export type {
  ConversationPromptSnapshot,
  RequestInspectionSnapshot,
  RequestPromptChange,
  RequestPromptInspector,
  RequestView,
} from '../../../packages/client/ui-conversation/src/client/contract/request-inspection.ts'

/** Merge-extensible target snapshot table used by the standalone view shell. */
export interface ConversationViewSnapshotMap {}

/** Latest target snapshots and shell-level activity. */
export interface ConversationSnapshot {
  readonly views: {
    get<Target extends Extract<keyof ConversationViewSnapshotMap, string>>(
      target: Target,
    ): ConversationViewSnapshotMap[Target] | undefined
  }
  readonly activeTargets: ReadonlySet<string>
}

/** Durable image loader with an optional synchronous cache read. */
export type MessageImageLoader = ((attachment: ImageAttachmentRef) => Promise<string>) & {
  peek?: (attachment: ImageAttachmentRef) => string | undefined
}

/** Durable attachment or in-flight submission preview, matching the upstream slot contract. */
export type MessageImageSource =
  | { readonly attachment: ImageAttachmentRef }
  | {
    readonly preview: {
      readonly url: string
      readonly name?: string
      readonly width?: number
      readonly height?: number
    }
  }

/** One image group supplied to the optional Trajectory image slot. */
export interface MessageImagesOwnerProps {
  readonly images: readonly MessageImageSource[]
  readonly loadImage: MessageImageLoader
  readonly align: 'start' | 'end'
}

/** Slot-backed renderer used without importing an attachment implementation. */
export type RenderMessageImages =
  (owner: Omit<MessageImagesOwnerProps, 'loadImage'>) => ReactNode

/** Focus request addressed to one Conversation view. */
export interface ConversationViewRequest {
  readonly view: string
  readonly focus: string
}

/** Exact Conversation-owner props consumed by the retained Trajectory view. */
export interface ConvViewProps extends SessionStandardProps {
  readonly useSession: SnapshotSelectorHook<SessionSnapshot>
  readonly viewRequest: ConversationViewRequest | null
  readonly openView: (view: string, focus: string) => void
  readonly completeViewRequest: () => void
}

/** Minimal registration seam used by the retained Trajectory definitions. */
export interface TrajectoryRegistrationContext {
  readonly uiConversation: {
    readonly events: {
      register(definition: ConversationNodeDefinition): (() => void) | void
    }
    readonly views: {
      register(definition: ConversationViewDefinition): (() => void) | void
    }
    readonly inspectRequestPrompt: RequestPromptInspector
  }
}

/** Upstream-local name retained so definition files require only a specifier rewrite. */
export type Context = TrajectoryRegistrationContext
