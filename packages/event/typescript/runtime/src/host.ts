/**
 * The Event host: the minimal lifecycle container the retained DeepSeek
 * Harness Event sources need from their original Cordis plugin platform.
 *
 * It provides exactly three things and nothing else:
 *
 * - an in-process event bus (`on` / `emit` / `parallel`) for the four
 *   `session/*` lifecycle events;
 * - ownership scopes: `effect()` registers disposers that run in reverse
 *   order when the scope is disposed, and `scope()` creates a child whose
 *   registrations are torn down with it;
 * - named composition slots (`provide` / `get`) through which the Session
 *   store and the persistence backend find each other.
 *
 * There is no plugin registry, no dependency injection, no scope-filtered
 * dispatch, and no type registry. A retained service reads `this.ctx` for the
 * scope that accessed it, exactly as Cordis services did, so a Session created
 * through a child scope is owned by that scope.
 */

/** A cleanup callback registered by an effect. */
export type Disposer = () => void | Promise<void>

/** A Cordis-compatible disposer for an effect whose setup may be asynchronous. */
export interface EffectDisposer extends PromiseLike<Disposer> {
  (): void | Promise<void>
}

/**
 * Accepted results of an effect body: nothing, one disposer, an iterable that
 * yields disposers as it runs, or a promise of a disposer.
 */
export type Effect =
  | void
  | Disposer
  | Iterable<Disposer | void>
  | PromiseLike<Disposer | void>

/** Diagnostics sink used by the retained sources for contained failures. */
export interface EventHostLogger {
  warn(message: string): void
  info(message: string): void
  error(error: unknown): void
}

/**
 * Lifecycle events dispatched through the host. Retained packages add their
 * events by augmenting this interface.
 */
export interface EventHostEvents {
  /**
   * Instrumentation hook fired before the listeners of any non-internal event
   * are resolved. A synchronous throw vetoes that dispatch.
   * @param mode - dispatch mode label (`emit`).
   * @param name - the event being dispatched.
   * @param args - the dispatch arguments after the event name.
   * @param thisArg - the listener `this`, when one was supplied.
   */
  'internal/dispatch'(mode: string, name: string, args: unknown[], thisArg: unknown): void
}

/**
 * Named services composed on the host. Retained packages add their slots by
 * augmenting this interface; every slot is read through the accessing scope.
 */
export interface EventHostServices {}

/** Options accepted by the root {@link EventHost}. */
export interface EventHostOptions {
  /** Diagnostics sink; defaults to the global console. */
  readonly logger?: EventHostLogger
}

type Listener = (...args: never[]) => unknown

interface Hook {
  readonly callback: Listener
}

type EventArgs<K extends keyof EventHostEvents> =
  EventHostEvents[K] extends (...args: infer A) => unknown ? A : never

/** Listener storage shared by every scope of one host tree. */
export class EventBus {
  private readonly hooks = new Map<string, Hook[]>()

  /**
   * Resolve the listeners for one dispatch. Mirrors the Cordis contract the
   * retained sources call: an object or function at `args[0]` is consumed as
   * the listener `this`, then the event name, and the remaining entries are
   * the listener arguments.
   * @param _type - dispatch mode label; kept for call-site compatibility.
   * @param args - dispatch arguments; consumed up to the event name.
   * @returns the callbacks bound to the dispatch `this`.
   */
  dispatch(type: string, args: unknown[]): Listener[] {
    const thisArg = typeof args[0] === 'object' || typeof args[0] === 'function' ? args.shift() : null
    const name = args.shift()
    if (typeof name !== 'string') throw new TypeError('event name must be a string')
    if (!name.startsWith('internal/')) {
      // Instrumentation hook: a throwing `internal/dispatch` listener vetoes the
      // dispatch before any listener is resolved, exactly as in Cordis.
      for (const hook of this.hooks.get('internal/dispatch') ?? []) {
        (hook.callback as (...a: unknown[]) => unknown)(type, name, args, thisArg)
      }
    }
    return (this.hooks.get(name) ?? []).map(hook => hook.callback.bind(thisArg) as Listener)
  }

  /** Register one hook and return its exact removal. */
  add(name: string, callback: Listener): () => void {
    const hooks = this.hooks.get(name) ?? []
    this.hooks.set(name, hooks)
    const hook: Hook = { callback }
    hooks.push(hook)
    return () => {
      const index = hooks.indexOf(hook)
      if (index >= 0) hooks.splice(index, 1)
    }
  }
}

const INACTIVE_MESSAGE = 'cannot create effect on inactive context'

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function'
}

/** Per-scope mutable state kept as own properties so child scopes never share it. */
interface ScopeState {
  parent: EventHost | undefined
  active: boolean
  disposables: Array<() => void | Promise<void>>
  disposal: void | Promise<void>
  bound: WeakMap<object, object>
}

const scopeStates = new WeakMap<EventHost, ScopeState>()

function stateOf(host: EventHost): ScopeState {
  const state = scopeStates.get(host)
  if (state === undefined) throw new Error('EventHost scope is not initialized')
  return state
}

/** Run disposers in reverse registration order, chaining asynchronous ones. */
function runReversed(disposers: Array<() => void | Promise<void>>): void | Promise<void> {
  let task: void | Promise<void> = undefined
  for (const disposer of disposers.splice(0).reverse()) {
    if (task !== undefined) {
      task = task.then(() => disposer())
    } else {
      const result = disposer()
      if (isPromiseLike(result)) task = result
    }
  }
  return task
}

// oxlint-disable-next-line typescript/no-empty-object-type -- merged with the augmentable services map.
export interface EventHost extends EventHostServices {}

/**
 * One ownership scope of an Event host tree. The root is constructed
 * directly; children come from {@link scope}. Every scope shares the root's
 * event bus, logger, and services, and owns its own disposers.
 */
export class EventHost {
  /** Diagnostics sink shared by the whole host tree. */
  readonly logger: EventHostLogger
  /** Listener storage shared by the whole host tree. */
  readonly events: EventBus

  constructor(options: EventHostOptions = {}) {
    this.logger = options.logger ?? {
      warn: message => { console.warn(message) },
      info: message => { console.info(message) },
      error: error => { console.error(error) },
    }
    this.events = new EventBus()
    scopeStates.set(this, { parent: undefined, active: true, disposables: [], disposal: undefined, bound: new WeakMap() })
  }

  /** Whether this scope can still register effects. */
  get active(): boolean {
    return stateOf(this).active
  }

  private assertActive(): void {
    if (!stateOf(this).active) throw new Error(INACTIVE_MESSAGE)
  }

  /**
   * Register a cleanup-aware effect on this scope.
   *
   * `execute` runs immediately. The disposers it returns or yields run in
   * reverse order either when the returned disposer is called or when this
   * scope is disposed, whichever comes first. A body that throws after
   * yielding some disposers has those disposers run before the error
   * propagates.
   * @param execute - the effect body; see {@link Effect} for accepted shapes.
   * @param _label - diagnostic label; accepted for call-site compatibility.
   * @returns a single-shot disposer for everything the body registered.
   */
  effect(execute: (this: this) => Effect, _label?: string): EffectDisposer {
    this.assertActive()
    const state = stateOf(this)
    const collected: Array<() => void | Promise<void>> = []
    let disposing = false
    let disposalTask: void | Promise<void>

    const collect = (value: unknown): void => {
      if (typeof value === 'function') collected.push(value as Disposer)
      else if (value !== undefined && value !== null) throw new TypeError('Invalid effect')
    }
    const disposeCollected = (): void | Promise<void> => {
      if (disposing) return disposalTask
      disposing = true
      return disposalTask = runReversed(collected)
    }

    let setupTask: void | Promise<void> = undefined
    let executing = true
    let resolveSetup: (() => void) | undefined
    let rejectSetup: ((reason: unknown) => void) | undefined
    let setupBarrier: Promise<void> | undefined
    let effectActive = true
    let inFlight: void | Promise<void>
    let linked = true

    const waitForSetup = (): Promise<void> => {
      setupBarrier ??= new Promise<void>((resolve, reject) => {
        resolveSetup = resolve
        rejectSetup = reject
      })
      return setupBarrier
    }
    const disposeAfter = (setup: PromiseLike<void>): Promise<void> => {
      return Promise.resolve(setup).then(
        () => disposeCollected(),
        async (reason: unknown) => {
          await disposeCollected()
          throw reason
        },
      )
    }
    const removeWrapper = (): void => {
      if (!linked) return
      linked = false
      const index = state.disposables.indexOf(wrapper)
      if (index >= 0) state.disposables.splice(index, 1)
    }
    const finalizeDisposal = (callback: () => void | Promise<void>): void | Promise<void> => {
      let result: void | Promise<void>
      try {
        result = callback()
      } catch (error: unknown) {
        removeWrapper()
        throw error
      }
      if (isPromiseLike(result)) {
        const pending = Promise.resolve(result).finally(() => {
          removeWrapper()
          if (inFlight === pending) inFlight = undefined
        })
        return inFlight = pending
      }
      removeWrapper()
      return result
    }

    const wrapper = (() => {
      if (!effectActive) return inFlight ?? disposalTask
      effectActive = false
      return finalizeDisposal(() => {
        if (executing) return disposeAfter(waitForSetup())
        return setupTask !== undefined ? disposeAfter(setupTask) : disposeCollected()
      })
    }) as EffectDisposer

    // Visible to a reentrant scope disposal before the body runs.
    state.disposables.push(wrapper)
    try {
      const result = execute.call(this)
      if (typeof result === 'function') {
        collect(result)
      } else if (result === undefined || result === null) {
        // nothing to collect
      } else if (typeof result !== 'object') {
        throw new TypeError('Invalid effect')
      } else if (isPromiseLike(result)) {
        setupTask = Promise.resolve(result).then(collect)
      } else if (Symbol.iterator in result) {
        const iterator = (result as Iterable<Disposer | void>)[Symbol.iterator]()
        while (true) {
          const item = iterator.next()
          collect(item.value)
          if (item.done) break
        }
      } else {
        throw new TypeError('Invalid effect')
      }
    } catch (error: unknown) {
      executing = false
      effectActive = false
      let cleanup: void | Promise<void>
      try {
        cleanup = finalizeDisposal(disposeCollected)
      } finally {
        rejectSetup?.(error)
      }
      if (isPromiseLike(cleanup)) Promise.resolve(cleanup).catch((reason: unknown) => { this.logger.error(reason) })
      throw error
    }

    executing = false
    if (setupBarrier !== undefined) {
      Promise.resolve(setupTask).then(resolveSetup, rejectSetup)
    }

    // Match the fixed upstream fiber: asynchronous setup failure is handled
    // immediately, cleans up anything already collected, and remains visible
    // through the public effect disposer without becoming an unhandled
    // rejection.
    if (setupTask !== undefined) {
      setupTask.catch(() => {
        if (!effectActive) return disposeCollected()
        return finalizeDisposal(disposeCollected)
      }).catch((error: unknown) => { this.logger.error(error) })
    }

    const disposeAsync = (): void | Promise<void> => {
      if (!effectActive) return
      effectActive = false
      return finalizeDisposal(disposeCollected)
    }
    wrapper.then = (onFulfilled, onRejected) => {
      return Promise.resolve(setupTask)
        .then(() => disposeAsync)
        .then(onFulfilled, onRejected)
    }
    return wrapper
  }

  /**
   * Listen for one lifecycle event. The listener is removed by the returned
   * disposer or when this scope is disposed.
   * @param name - the event name.
   * @param listener - called with the dispatch arguments.
   * @returns the listener's single-shot removal.
   */
  on<K extends keyof EventHostEvents>(name: K, listener: EventHostEvents[K] & Listener): () => void | Promise<void> {
    this.assertActive()
    const remove = this.events.add(name, listener)
    return this.effect(() => remove, `ctx.on(${JSON.stringify(name)})`)
  }

  /**
   * Dispatch synchronously without awaiting returned promises. An object at
   * the first position is used as the listener `this`.
   */
  emit<K extends keyof EventHostEvents>(name: K, ...args: EventArgs<K>): void
  emit<K extends keyof EventHostEvents>(thisArg: object, name: K, ...args: EventArgs<K>): void
  emit(...args: unknown[]): void {
    for (const callback of this.events.dispatch('emit', args)) (callback as (...a: unknown[]) => unknown)(...args)
  }

  /**
   * Dispatch and await every listener together; the first failures are
   * collected into one `AggregateError`.
   */
  parallel<K extends keyof EventHostEvents>(name: K, ...args: EventArgs<K>): Promise<void>
  parallel<K extends keyof EventHostEvents>(thisArg: object, name: K, ...args: EventArgs<K>): Promise<void>
  async parallel(...args: unknown[]): Promise<void> {
    const callbacks = this.events.dispatch('emit', args)
    const results = await Promise.allSettled(callbacks.map(async callback => (callback as (...a: unknown[]) => unknown)(...args)))
    const errors = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (errors.length > 0) throw new AggregateError(errors.map(error => error.reason))
  }

  /**
   * Publish one service under `name` for the whole host tree until this scope
   * is disposed or the returned disposer runs. Reads through any scope return
   * the service bound to that scope.
   * @param name - the composition slot.
   * @param service - the instance to publish.
   * @returns the single-shot removal.
   */
  provide<K extends keyof EventHostServices & string>(name: K, service: NonNullable<EventHostServices[K]>): () => void | Promise<void> {
    return this.effect(() => {
      const root = this.root
      if (Object.prototype.hasOwnProperty.call(root, name)) {
        throw new Error(`service "${name}" has been registered`)
      }
      Object.defineProperty(root, name, {
        configurable: true,
        enumerable: true,
        get(this: EventHost) {
          return this.bind(service as object)
        },
      })
      return () => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- unprovide the exact slot.
        delete (root as unknown as Record<string, unknown>)[name]
      }
    }, `ctx.provide(${JSON.stringify(name)})`)
  }

  /**
   * Read one composition slot, or `undefined` when nothing is provided.
   * @param name - the composition slot.
   * @returns the service bound to this scope, when provided.
   */
  get<K extends keyof EventHostServices & string>(name: K): EventHostServices[K] | undefined {
    return (this as unknown as Record<string, unknown>)[name] as EventHostServices[K] | undefined
  }

  /**
   * Create a child scope. It shares this host's bus, logger, and services;
   * its own effects run when it is disposed, and it is disposed before this
   * scope's earlier registrations when this scope is disposed.
   * @returns the child scope.
   */
  scope(): this {
    this.assertActive()
    const child: this = Object.create(this)
    scopeStates.set(child, { parent: this, active: true, disposables: [], disposal: undefined, bound: new WeakMap() })
    const detach = this.effect(() => () => child.disposeOwn(), 'ctx.scope()')
    Object.defineProperty(child, 'disposeParentLink', { value: detach, configurable: true })
    return child
  }

  /** Dispose this scope: run its effects in reverse and unlink it from its parent. */
  dispose(): Promise<void> {
    const link = (this as { disposeParentLink?: () => void | Promise<void> }).disposeParentLink
    if (link !== undefined) return Promise.resolve(link())
    return this.disposeOwn()
  }

  /**
   * Run this scope's effects in reverse registration order. Like a Cordis
   * fiber unload, a failing disposer is reported through the logger and never
   * prevents the remaining disposers from running.
   */
  private disposeOwn(): Promise<void> {
    const state = stateOf(this)
    if (!state.active) return Promise.resolve(state.disposal)
    state.active = false
    const disposal = (async () => {
      for (const disposer of state.disposables.splice(0).reverse()) {
        try {
          await disposer()
        } catch (error: unknown) {
          this.logger.error(error)
        }
      }
    })()
    state.disposal = disposal
    return disposal
  }

  /** The root scope owning the shared services. */
  private get root(): EventHost {
    let cursor: EventHost = this
    for (let parent = stateOf(cursor).parent; parent !== undefined; parent = stateOf(cursor).parent) cursor = parent
    return cursor
  }

  /**
   * A view of `service` whose `ctx` is this scope, cached per scope. Like a
   * Cordis traceable service, the view is a proxy over the one underlying
   * instance: reads of `ctx` answer with this scope, every other read and
   * every write goes to the instance itself.
   */
  private bind(service: object): object {
    if (Object.prototype.hasOwnProperty.call(service, 'ctx') && (service as { ctx?: unknown }).ctx === this) return service
    const cache = stateOf(this).bound
    let bound = cache.get(service)
    if (bound === undefined) {
      const scope = this
      bound = new Proxy(service, {
        get(target, property, receiver) {
          if (property === 'ctx') return scope
          return Reflect.get(target, property, receiver)
        },
        set(target, property, value) {
          if (property === 'ctx') return false
          return Reflect.set(target, property, value)
        },
        defineProperty(target, property, descriptor) {
          return Reflect.defineProperty(target, property, descriptor)
        },
        deleteProperty(target, property) {
          return Reflect.deleteProperty(target, property)
        },
      })
      cache.set(service, bound)
    }
    return bound
  }
}
