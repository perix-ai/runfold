/**
 * Test-only stand-in for the pinned DeepSeek Harness Cordis host, imported by
 * retained Event and persistence tests through identity-checked local
 * specifiers. It adds the plugin-loading vocabulary those tests use
 * (`ctx.plugin`, `fiber.dispose`) on top of the Runfold {@link EventHost} scopes
 * and nothing else. It is never built or published.
 */

import { EventHost } from '../runtime/src/host.ts'

/** The subset of a Cordis fiber the retained tests touch. */
export interface Fiber extends PromiseLike<Fiber> {
  readonly ctx: Context
  dispose(): Promise<void>
  await(): Promise<void>
}

type PluginConstructor = new (ctx: Context, config?: unknown) => object
type PluginFunction = (ctx: Context, config?: unknown) => unknown
type PluginObject = { apply(ctx: Context, config?: unknown): unknown }
type Plugin = PluginConstructor | PluginFunction | PluginObject

function isClass(value: unknown): value is PluginConstructor {
  return typeof value === 'function' && /^class[\s{]/.test(Function.prototype.toString.call(value))
}

export class Context extends EventHost {
  /** Cordis-style handle to this scope's own lifetime. */
  get fiber(): Fiber {
    return makeFiber(this, Promise.resolve())
  }

  /**
   * Load a plugin in a child scope. Class plugins are constructed with the
   * scope and config, function and `apply` plugins are invoked with them; a
   * returned disposer is owned by the child scope.
   */
  plugin(plugin: Plugin, config?: unknown): Fiber {
    const child = this.scope()
    let loaded: Promise<void>
    try {
      let result: unknown
      if (isClass(plugin)) {
        result = new plugin(child, config)
      } else if (typeof plugin === 'function') {
        result = plugin(child, config)
      } else {
        result = plugin.apply(child, config)
      }
      if (typeof result === 'function') {
        child.effect(() => result as () => void, 'plugin disposer')
        loaded = Promise.resolve()
      } else if (typeof result === 'object' && result !== null && 'then' in result) {
        loaded = Promise.resolve(result as PromiseLike<unknown>).then((value) => {
          if (typeof value === 'function') child.effect(() => value as () => void, 'plugin disposer')
        })
      } else {
        loaded = Promise.resolve()
      }
    } catch (error: unknown) {
      // Cordis records a synchronous apply failure on the fiber; awaiting it rejects.
      const disposal = Promise.resolve(child.dispose())
      loaded = disposal.then(() => { throw error })
      loaded.catch(() => {})
      return makeFiber(child, loaded)
    }
    return makeFiber(child, loaded)
  }
}

function makeFiber(ctx: Context, loaded: Promise<void>): Fiber {
  // The awaited value must not be thenable, or promise resolution would
  // re-enter `then` forever; hand out a plain handle with the same methods.
  const handle = {
    ctx,
    dispose: () => ctx.dispose(),
    await: () => loaded,
  }
  const fiber: Fiber = {
    ...handle,
    then: (onFulfilled, onRejected) => loaded.then(() => handle as unknown as Fiber).then(onFulfilled, onRejected),
  }
  return fiber
}

export default Context
