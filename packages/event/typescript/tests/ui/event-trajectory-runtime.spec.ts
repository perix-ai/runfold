import { describe, expect, it, vi } from 'vitest'
import { EventTrajectoryRuntime } from '../../ui/trajectory/src/trajectory-runtime.js'
import { eventLog } from '../fixtures/event-log.js'

describe('Runfold Event trajectory projection runtime', () => {
  it('projects user, assistant, request, and location state', () => {
    const snapshot = new EventTrajectoryRuntime(eventLog()).getSnapshot()

    expect(snapshot.eventNodes.some(node => node.kind === 'user')).toBe(true)
    expect(snapshot.eventNodes.some(node => node.kind === 'assistant')).toBe(true)
    expect(snapshot.requests).toHaveLength(2)
    expect(snapshot.eventLocations.size).toBeGreaterThan(0)
  })

  it('publishes incremental snapshots and supports complete replacement', () => {
    const events = eventLog()
    const runtime = new EventTrajectoryRuntime()
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)

    for (const event of events) runtime.append(event)
    const appended = runtime.getSnapshot()
    expect(listener).toHaveBeenCalled()
    expect(appended.eventNodes.some(node => node.kind === 'assistant')).toBe(true)

    runtime.replace(events.slice(0, 10), true)
    expect(runtime.getSnapshot().requests).toHaveLength(1)
    unsubscribe()
    const calls = listener.mock.calls.length
    runtime.replace(events)
    expect(listener).toHaveBeenCalledTimes(calls)
  })

  it('projects a 20,000-event history through the retained implementation', () => {
    const events = eventLog(20_000)
    const snapshot = new EventTrajectoryRuntime(events).getSnapshot()

    expect(events).toHaveLength(20_000)
    expect(snapshot.eventNodes.length).toBeGreaterThan(1_000)
    expect(snapshot.requests).toHaveLength(2_000)
  }, 30_000)
})
