/**
 * Type-only contracts used by the standalone Trajectory extraction.
 *
 * The declarations below are copied from the named DeepSeek Harness sources
 * at commit dd6322d604e00eec1ba5e0c8541159906a21094a and narrowed only where
 * the original declaration lives inside a host/runtime module that cannot be
 * retained independently:
 *
 * - packages/api/session-controller/src/client/contract/{events,snapshot}.ts
 * - packages/api/session-controller/src/client/sessions/projection-store.ts
 * - packages/api/session-controller/src/types.ts (ChunkRowEvent)
 * - packages/client/store/src/contract.ts
 * - packages/client/ui-slots/src/index.ts (selected type-only declarations)
 */
import type { ReactNode } from 'react'
import type { Branded } from './brand.ts'
import type { ContentBlock, MessageId } from './messages.ts'
import type { ChunkRow } from '../../sdk/src/session-chunk-rows.ts'
import type { SessionEvent, SessionId } from '../../sdk/src/session-types.ts'
import type { CommonKey } from '../../packages/client/locale/src/locales/zh.ts'

/** Minimal observable snapshot source shared by controllers, stores, and render adapters. */
export interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(fn: () => void): () => void
}

/** Typed selector hook over a snapshot source. */
export type SnapshotSelectorHook<T> =
  <Selected>(selector: (snapshot: T) => Selected, equal?: (left: Selected, right: Selected) => boolean) => Selected

/** Alias used by the retained renderer binding. */
export type HostObservable<T> = ObservableSnapshot<T>

/** Event-shaped representation of one packed Assistant chunk row. */
export type ChunkRowEvent = {
  [Kind in ChunkRow['type']]: {
    readonly type: `chunkrow/${Kind}`
    readonly seq: number
    readonly time: number
    readonly data: Extract<ChunkRow, { readonly type: Kind }>['data']
  }
}[ChunkRow['type']]

/** Standard Session event or compact historical Assistant run. */
export type SessionEventLike = SessionEvent | ChunkRowEvent

/** Client history entry retaining its coarse transport discriminator. */
export type SessionEventLikeEntry =
  | { readonly type: 'event'; readonly event: SessionEvent }
  | { readonly type: 'chunks'; readonly event: ChunkRowEvent }

/** Scalar live entry accepted by append-only Client paths. */
export type SessionLiveEventEntry = Extract<SessionEventLikeEntry, { readonly type: 'event' }>

/** Client-minted prompt identity used to reconcile optimistic and durable messages. */
export type SessionRequestId = Branded<'session-request-id'>

/** One transient inbox occurrence from the authoritative queue snapshot. */
export interface QueuedMessage {
  readonly id: MessageId
  readonly messageId: MessageId
  readonly placement: 'queued' | 'steering' | 'context'
  readonly rpcId?: SessionRequestId
  readonly content: readonly ContentBlock[]
  readonly preview: string
  readonly text: string | null
}

/** One image displayed by a local submission echo before durable admission. */
export interface PendingSubmissionImage {
  readonly previewUrl: string
  readonly name?: string
  readonly width?: number
  readonly height?: number
}

/** Client surface selected when a local submission begins. */
export type PendingSubmissionPlacement = 'transcript' | 'queued' | 'steering'

/** One local prompt-submission echo before durable admission. */
export interface PendingSubmission {
  readonly requestId: SessionRequestId
  readonly placement: PendingSubmissionPlacement
  readonly time: number
  readonly text: string
  readonly images: readonly PendingSubmissionImage[]
}

/** History-open lifecycle of a Session event window. */
export type OpenState = 'cold' | 'loading' | 'open' | 'error'

/** Structural failure shape needed by the standalone read-only Session snapshot. */
export interface RemoteFailure {
  readonly code: string
  readonly message: string
  readonly details?: unknown
}

/** Direct parent/child address exposed by a subagent Session snapshot. */
export interface SubagentAddress {
  readonly parentSessionId: SessionId
  readonly childSessionId: SessionId
  readonly mode: 'one-shot' | 'continuable'
}

/** Send/stop failure surfaced by Session consumers. */
export interface PromptError {
  readonly op: 'send' | 'stop'
  readonly error: RemoteFailure
}

/** Immutable Session lifecycle and control snapshot. */
export interface SessionSnapshot {
  readonly sessionId: SessionId
  readonly queue: readonly QueuedMessage[]
  readonly pendingSubmissions: readonly PendingSubmission[]
  readonly running: boolean
  readonly subagent: {
    readonly address: SubagentAddress
    readonly parentAvailable?: boolean
  } | null
  readonly removed: boolean
  readonly openState: OpenState
  readonly openError: RemoteFailure | null
  readonly hasMore: boolean
  readonly loadingOlder: boolean
  readonly promptError: PromptError | null
  readonly blank: boolean
  readonly lastAgentError: string | null
  readonly promptAttempted: boolean
  readonly awaitingFirstTurn: boolean
}

/** Merge-extensible host projection table; standalone Trajectory installs none. */
export interface SessionProjectionMap {}

/** Key-addressed projection reader delivered through the Session standard kit. */
export type UseProjection = {
  <Key extends Extract<keyof SessionProjectionMap, string>>(
    key: Key,
  ): SessionProjectionMap[Key] | undefined
  <Key extends Extract<keyof SessionProjectionMap, string>, Selected>(
    key: Key,
    selector: (value: SessionProjectionMap[Key] | undefined) => Selected,
    equal?: (left: Selected, right: Selected) => boolean,
  ): Selected
}

/** Slot contract table. Owners extend it through declaration merging. */
export interface SlotMap {}

/** Locale namespace table. Dictionary owners extend it through declaration merging. */
export interface LocaleNamespaceMap {
  /** Shared vocabulary rendered by Trajectory's primitive components. */
  common: CommonKey
}

/** Translate a dictionary key with optional template parameters. */
export type Translate<Key extends string = string> =
  (key: Key, params?: Record<string, unknown>) => string

type CommonKeyOf = LocaleNamespaceMap extends { common: infer Common }
  ? Common & string
  : never

type LocaleKeysOf<Namespace extends keyof LocaleNamespaceMap & string> =
  (LocaleNamespaceMap[Namespace] & string) | CommonKeyOf

/** Namespace-addressed translate function. */
export type TranslateNS<Namespace extends keyof LocaleNamespaceMap & string> =
  Translate<LocaleKeysOf<Namespace>>

/** Locale share of composed component props. */
export type PropsLocale<Namespace> = Namespace extends keyof LocaleNamespaceMap & string
  ? { t: TranslateNS<Namespace> }
  : object

/** Framework standard kit delivered to a strict Session slot. */
export interface SessionStandardProps {}

type OwnerOf<Key extends keyof SlotMap & string> =
  SlotMap[Key] extends { owner: infer Owner extends object } ? Owner : object

/** Child-slot render share used by the standalone single-slot Trajectory view. */
export type PropsRenderSlots<Keys extends keyof SlotMap & string> = {
  renderSlot<Key extends Keys>(
    key: Key,
    owner: OwnerOf<Key>,
    options?: { fallback?: ReactNode },
  ): ReactNode
  readonly __renders?: ((key: Keys) => void) | undefined
}

type HookSources = Record<string, HostObservable<unknown>>

type PropsHooks<Sources extends HookSources> = {
  [Name in keyof Sources & string as `use${Capitalize<Name>}`]:
  SnapshotSelectorHook<Sources[Name] extends HostObservable<infer Value> ? Value : never>
}

/** Component-side view of an injected face with observable hooks bound to selectors. */
export type InjectFace<Face extends object> =
  Face extends { hooks: infer Sources extends HookSources }
    ? Omit<Face, 'hooks'> & PropsHooks<Sources>
    : Face
