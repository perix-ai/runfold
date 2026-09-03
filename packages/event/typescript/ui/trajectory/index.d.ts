import type { SessionEvent } from '@runfold/event/session/types'
import type { ReactNode } from 'react'

export type EventImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

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

export declare function EventTrajectory(props: EventTrajectoryProps): ReactNode
