import { setImmediate as waitForImmediate } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  EventHost,
  type Disposer,
  type EventHostLogger,
} from '../../runtime/src/host.ts'

declare module '../../runtime/src/host.ts' {
  interface EventHostEvents {
    'test/event'(value: number): void | Promise<void>
  }

  interface EventHostServices {
    probe: ProbeService
  }
}

class ProbeService {
  declare ctx: EventHost
  value = 0

  context(): EventHost {
    return this.ctx
  }
}

interface HostFixture {
  host: EventHost
  errors: unknown[]
}

function createHost(): HostFixture {
  const errors: unknown[] = []
  const logger: EventHostLogger = {
    warn: vi.fn(),
    info: vi.fn(),
    error: error => { errors.push(error) },
  }
  return { host: new EventHost({ logger }), errors }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('EventHost event dispatch', () => {
  it('preserves instrumentation and listener order and binds the carrier', async () => {
    const { host } = createHost()
    const calls: string[] = []
    const carrier = { id: 'carrier' }
    let dispatchArgs: unknown[] | undefined
    let dispatchThis: unknown
    let listenerThis: unknown

    host.on('internal/dispatch', (mode, name, args, thisArg) => {
      calls.push(`dispatch:${mode}:${name}`)
      dispatchArgs = args
      dispatchThis = thisArg
    })
    host.on('test/event', function (this: unknown, value) {
      calls.push(`first:${value}`)
      listenerThis = this
    })
    host.on('test/event', value => { calls.push(`second:${value}`) })

    host.emit(carrier, 'test/event', 7)

    expect(calls).toEqual(['dispatch:emit:test/event', 'first:7', 'second:7'])
    expect(dispatchArgs).toEqual([7])
    expect(dispatchThis).toBe(carrier)
    expect(listenerThis).toBe(carrier)
    await host.dispose()
  })

  it('lets instrumentation veto emit and stops emit at the first listener error', async () => {
    const fixture = createHost()
    const veto = new Error('dispatch veto')
    const listener = vi.fn()
    fixture.host.on('internal/dispatch', () => { throw veto })
    fixture.host.on('test/event', listener)

    expect(() => fixture.host.emit('test/event', 1)).toThrow(veto)
    expect(listener).not.toHaveBeenCalled()
    await fixture.host.dispose()

    const second = createHost()
    const listenerFailure = new Error('listener failed')
    const later = vi.fn()
    second.host.on('test/event', () => { throw listenerFailure })
    second.host.on('test/event', later)

    expect(() => second.host.emit('test/event', 2)).toThrow(listenerFailure)
    expect(later).not.toHaveBeenCalled()
    await second.host.dispose()
  })

  it('runs parallel listeners together and aggregates every failure in listener order', async () => {
    const { host } = createHost()
    const carrier = { id: 'parallel-carrier' }
    const calls: string[] = []
    const first = new Error('first')
    const second = new Error('second')

    host.on('test/event', async function (this: unknown, value) {
      await Promise.resolve()
      calls.push(`one:${value}:${this === carrier}`)
      throw first
    })
    host.on('test/event', function (this: unknown, value) {
      calls.push(`two:${value}:${this === carrier}`)
      throw second
    })

    let failure: unknown
    try {
      await host.parallel(carrier, 'test/event', 3)
    } catch (error: unknown) {
      failure = error
    }
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([first, second])
    expect(calls).toEqual(['two:3:true', 'one:3:true'])
    await host.dispose()
  })
})

describe('EventHost effects', () => {
  it('runs yielded disposers once in reverse order across sync and async cleanup', async () => {
    const { host } = createHost()
    const calls: string[] = []
    const release = host.effect(function* () {
      yield () => { calls.push('sync') }
      yield async () => {
        await Promise.resolve()
        calls.push('async')
      }
    })

    await release()
    await release()
    await host.dispose()

    expect(calls).toEqual(['async', 'sync'])
  })

  it('logs a failed effect cleanup without blocking independent effects', async () => {
    const { host, errors } = createHost()
    const calls: string[] = []
    const failure = new Error('cleanup failed')

    host.effect(() => () => { calls.push('first') })
    host.effect(() => async () => {
      calls.push('failing')
      throw failure
    })
    host.effect(() => async () => {
      await Promise.resolve()
      calls.push('last')
    })

    await host.dispose()

    expect(calls).toEqual(['last', 'failing', 'first'])
    expect(errors).toEqual([failure])
  })

  it('cleans both early and returned disposers when setup reentrantly disposes its owner', async () => {
    const { host } = createHost()
    const calls: string[] = []
    let disposal!: Promise<void>

    host.effect(function* () {
      yield () => { calls.push('early') }
      disposal = this.dispose()
      return () => { calls.push('returned') }
    })

    await disposal
    await host.dispose()

    expect(calls).toEqual(['returned', 'early'])
  })

  it('waits for a resolving Promise effect during concurrent owner disposal', async () => {
    const { host } = createHost()
    const setup = deferred<Disposer>()
    const cleanup = vi.fn()
    host.effect(() => setup.promise)

    const first = host.dispose()
    const second = host.dispose()
    setup.resolve(cleanup)
    await Promise.all([first, second])

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('handles a rejected Promise effect and exposes the setup failure through its disposer', async () => {
    const { host } = createHost()
    const failure = new Error('setup failed')
    const setup = deferred<Disposer>()
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason) }
    process.on('unhandledRejection', onUnhandled)

    try {
      const release = host.effect(() => setup.promise)
      setup.reject(failure)
      await waitForImmediate()

      expect(unhandled).toEqual([])
      await expect(Promise.resolve(release())).rejects.toBe(failure)
    } finally {
      process.off('unhandledRejection', onUnhandled)
      await host.dispose()
    }
  })

  it('reports a rejected Promise effect once during concurrent owner disposal', async () => {
    const { host, errors } = createHost()
    const failure = new Error('concurrent setup failed')
    const setup = deferred<Disposer>()
    host.effect(() => setup.promise)

    const first = host.dispose()
    const second = host.dispose()
    setup.reject(failure)
    await Promise.all([first, second])

    expect(errors).toEqual([failure])
  })
})

describe('EventHost scopes and services', () => {
  it('supports child release, parent cascade, and repeated concurrent disposal', async () => {
    const { host } = createHost()
    const calls: string[] = []
    const released = host.scope()
    const releaseGate = deferred<void>()
    released.effect(() => async () => {
      await releaseGate.promise
      calls.push('released-child')
    })

    const firstRelease = released.dispose()
    let secondSettled = false
    const secondRelease = released.dispose().then(() => { secondSettled = true })
    await Promise.resolve()
    expect(secondSettled).toBe(false)
    releaseGate.resolve(undefined)
    await Promise.all([firstRelease, secondRelease])
    await released.dispose()
    expect(released.active).toBe(false)
    expect(host.active).toBe(true)
    expect(calls).toEqual(['released-child'])

    host.effect(() => () => { calls.push('root-before') })
    const cascaded = host.scope()
    cascaded.effect(() => () => { calls.push('cascaded-child') })
    host.effect(() => () => { calls.push('root-after') })

    await Promise.all([host.dispose(), host.dispose()])
    expect(calls).toEqual([
      'released-child',
      'root-after',
      'cascaded-child',
      'root-before',
    ])
    expect(host.active).toBe(false)
    expect(cascaded.active).toBe(false)
    expect(() => host.effect(() => undefined)).toThrow(/inactive context/)
  })

  it('rejects duplicate services, unprovides exactly once, and binds ctx per scope', async () => {
    const { host } = createHost()
    const service = new ProbeService()
    const release = host.provide('probe', service)
    const child = host.scope()

    const rootView = host.get('probe')
    const childView = child.get('probe')
    expect(rootView).toBeDefined()
    expect(childView).toBeDefined()
    expect(rootView).not.toBe(childView)
    expect(rootView?.context()).toBe(host)
    expect(childView?.context()).toBe(child)
    expect(child.get('probe')).toBe(childView)

    rootView!.value = 4
    expect(service.value).toBe(4)
    expect(childView?.value).toBe(4)
    expect(() => host.provide('probe', new ProbeService())).toThrow(/has been registered/)
    expect(host.get('probe')).toBe(rootView)

    await release()
    await release()
    expect(host.get('probe')).toBeUndefined()
    expect(child.get('probe')).toBeUndefined()
    await host.dispose()
  })
})
