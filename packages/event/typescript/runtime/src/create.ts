/**
 * Composition root for the TypeScript Event SDK: one host, one Session store,
 * and an optional persistence backend, wired the way DeepSeek Harness wired
 * them through its plugin platform.
 */

import { EventHost, type EventHostLogger } from './host.ts'
import SessionStore, { type Session, type SessionId } from '../../packages/core/session/src/index.ts'
import type { SessionPersistence } from '../../packages/session/session-persistence/src/index.ts'

/** Options accepted by {@link createEventRuntime}. */
export interface EventRuntimeOptions {
  /** An existing root host to compose on; a new one is created otherwise. */
  readonly host?: EventHost
  /** Diagnostics sink for a newly created host. */
  readonly logger?: EventHostLogger
  /**
   * Persistence backend factory, invoked once with the host after the Session
   * store is published. Omit for an in-memory-only runtime.
   */
  readonly persistence?: (host: EventHost) => SessionPersistence
}

/** A composed Event runtime. */
export interface EventRuntime {
  /** The root host scope owning every registration below. */
  readonly host: EventHost
  /** The live Session store (`create`, `fork`, `flush`, `get`, `list`). */
  readonly sessions: SessionStore
  /** The configured persistence backend, when any. */
  readonly persistence: SessionPersistence | undefined
  /**
   * Restore one persisted Session and publish it live so later appends
   * continue its history. Equivalent to Python's `SessionStore.restore`.
   * @param id - the persisted session id.
   * @param signal - optional cancellation for the persistence read.
   * @returns the live restored Session.
   * @throws when no persistence is configured, the log is missing or invalid,
   *   or a live Session with that id already exists.
   */
  restore(id: SessionId, signal?: AbortSignal): Promise<Session>
  /** Flush every live Session, dispose every registration, and close the backend. */
  dispose(): Promise<void>
}

/**
 * Compose an Event runtime.
 * @param options - host, logger, and persistence choices.
 * @returns the composed runtime.
 */
export function createEventRuntime(options: EventRuntimeOptions = {}): EventRuntime {
  const host = options.host ?? new EventHost(options.logger === undefined ? {} : { logger: options.logger })
  const sessions = new SessionStore(host)
  const persistence = options.persistence?.(host)
  return {
    host,
    sessions,
    persistence,
    async restore(id, signal) {
      if (persistence === undefined) throw new Error('cannot restore without configured persistence')
      const preparation = await persistence.prepare(id, signal)
      try {
        const session = preparation.session
        host.effect(function* () {
          yield sessions.enter(session)
          sessions.announce(session)
        }, 'runtime.restore()')
        return session
      } finally {
        preparation[Symbol.dispose]()
      }
    },
    dispose: () => host.dispose(),
  }
}
