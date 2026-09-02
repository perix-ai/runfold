import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type {
  SessionProjectionMap,
  SessionSnapshot,
  UseProjection,
} from '@deepseek-ai/dsh-api-session-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {
  ConversationSnapshot,
  InputActions,
  InputState,
  MessageImageLoader,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionEvent, SessionId } from '@perix/event-sdk/session/types'
import { bindSnapshotSelector } from '../../../packages/client/ui-renderer/src/client/bind.ts'
import { makeTranslate } from '../../../packages/test-support/client-runtime/src/translate.ts'
import {
  en,
  zh,
} from '../../../packages/client/ui-trajectory/src/client/locales.ts'
import { en as commonEn } from '../../../packages/client/locale/src/locales/en.ts'
import { zh as commonZh } from '../../../packages/client/locale/src/locales/zh.ts'
import { TrajectoryView } from '../../../packages/client/ui-trajectory/src/client/TrajectoryView.tsx'
import { EventTrajectoryRuntime } from './trajectory-runtime.js'

export type EventImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

/** Public, provider-neutral image reference consumed by the trajectory renderer. */
export interface EventImageAttachmentRef {
  readonly attachmentId: string
  readonly mediaType: EventImageMediaType
  readonly bytes: number
  readonly width: number
  readonly height: number
  readonly name?: string
  readonly originalDimensions?: {
    readonly width: number
    readonly height: number
  }
}

export type EventImageLoader = ((attachment: EventImageAttachmentRef) => Promise<string>) & {
  peek?: (attachment: EventImageAttachmentRef) => string | undefined
}

export interface EventTrajectoryProps {
  readonly events: readonly SessionEvent[]
  readonly locale?: 'en' | 'zh'
  readonly hasMore?: boolean
  readonly loadOlder?: () => Promise<boolean>
  readonly loadImage?: EventImageLoader
}

function sessionSnapshot(hasMore: boolean): SessionSnapshot {
  return {
    sessionId: 'standalone-trajectory' as SessionId,
    queue: [],
    pendingSubmissions: [],
    running: false,
    subagent: null,
    removed: false,
    openState: 'open',
    openError: null,
    hasMore,
    loadingOlder: false,
    promptError: null,
    blank: false,
    lastAgentError: null,
    promptAttempted: true,
    awaitingFirstTurn: false,
  }
}

function emptyProjection<Key extends Extract<keyof SessionProjectionMap, string>>(
  key: Key,
): SessionProjectionMap[Key] | undefined
function emptyProjection<Key extends Extract<keyof SessionProjectionMap, string>, Selected>(
  key: Key,
  selector: (value: SessionProjectionMap[Key] | undefined) => Selected,
  eq?: (left: Selected, right: Selected) => boolean,
): Selected
function emptyProjection<Key extends Extract<keyof SessionProjectionMap, string>, Selected>(
  _key: Key,
  selector?: (value: SessionProjectionMap[Key] | undefined) => Selected,
): SessionProjectionMap[Key] | Selected | undefined {
  return selector === undefined ? undefined : selector(undefined)
}

const useProjection: UseProjection = emptyProjection

const inputActions: InputActions = {
  setDraft: () => {},
  addImages: () => false,
  removeImage: () => {},
  pruneImages: () => {},
  submit: () => {},
}

/** Perix host for the retained upstream Trajectory view over a SessionEvent log. */
export function EventTrajectory({
  events,
  locale = 'en',
  hasMore = false,
  loadOlder = () => Promise.resolve(false),
  loadImage = () => Promise.reject(new Error('no image loader configured')),
}: EventTrajectoryProps): ReactNode {
  const runtime = useMemo(
    () => new EventTrajectoryRuntime(events, hasMore),
    [events, hasMore],
  )
  const session = useMemo(
    () => createSnapshotStore(sessionSnapshot(hasMore)),
    [hasMore],
  )
  const duration = useMemo(() => createSnapshotStore(false), [])
  const conversation = useMemo(() => createSnapshotStore<ConversationSnapshot>({
    views: { get: () => undefined },
    activeTargets: new Set(['trajectory']),
  }), [])
  const input = useMemo(() => createSnapshotStore<InputState>({
    draft: '',
    imageIds: [],
    draftRev: 0,
    phase: 'plain',
    occurrences: [],
    queue: [],
  }), [])
  const useTrajectory = useMemo(() => bindSnapshotSelector(runtime), [runtime])
  const useSession = useMemo(() => bindSnapshotSelector(session), [session])
  const useDuration = useMemo(() => bindSnapshotSelector(duration), [duration])
  const useConversation = useMemo(() => bindSnapshotSelector(conversation), [conversation])
  const useInput = useMemo(() => bindSnapshotSelector(input), [input])
  const t = useMemo(
    () => locale === 'zh'
      ? makeTranslate(zh, commonZh)
      : makeTranslate(en, commonEn),
    [locale],
  )

  return (
    <TrajectoryView
      sessionId={'standalone-trajectory' as SessionId}
      useSessions={(() => undefined) as never}
      useSessionPendingInteraction={(() => undefined) as never}
      useWorkspaces={(() => undefined) as never}
      SessionProvider={({ children }) => <>{children}</>}
      useSession={useSession}
      useProjection={useProjection}
      useConversation={useConversation}
      useInput={useInput}
      inputActions={inputActions}
      useTrajectory={useTrajectory}
      useDuration={useDuration}
      loadOlder={loadOlder}
      loadImage={loadImage as MessageImageLoader}
      setActualDuration={value => { duration.set(value) }}
      viewRequest={null}
      openView={() => {}}
      completeViewRequest={() => {}}
      renderSlot={() => null}
      t={t}
    />
  )
}
