import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import SessionStore, { SessionId } from '@perix/event-sdk'
import JsonlSessionPersistence from '@perix/event-sdk/persistence-jsonl'
import { Context } from '@perix/event-sdk/runtime'
import { EventTrajectory } from '@perix/event-ui'
import { eventLog } from '../fixtures/event-log.js'

const contexts: Context[] = []
const roots: string[] = []

async function runtime(root: string): Promise<Context> {
  const context = new Context()
  contexts.push(context)
  await context.plugin(SessionStore)
  await context.plugin(JsonlSessionPersistence, {
    root,
    compression: 'none',
    writeBatchMaxDelayMs: 1,
  })
  return context
}

afterEach(async () => {
  cleanup()
  for (const context of contexts.splice(0)) await context.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('complete Perix Event system', () => {
  it('moves one log through SDK validation, fork, JSONL, restart, and UI projection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'perix-event-system-'))
    roots.push(root)
    const writer = await runtime(root)
    const parent = writer.sessions.create(SessionId('system-parent'), {
      seed: eventLog(20),
      meta: { cwd: '/workspace' },
    })
    const child = writer.sessions.fork(parent, undefined, SessionId('system-child'))
    await writer.sessions.flush(child)
    const durableEvents = structuredClone(child.events)
    await writer.fiber.dispose()
    contexts.splice(contexts.indexOf(writer), 1)

    const reader = await runtime(root)
    const restored = await reader.sessionPersistence.load(SessionId('system-child'))
    expect(restored.events).toEqual(durableEvents)
    expect(restored.meta).toMatchObject({
      id: SessionId('system-child'),
      parentSession: SessionId('system-parent'),
      seedLength: parent.events.length,
    })

    render(<EventTrajectory events={restored.events} locale="en" />)
    expect(screen.getByRole('toolbar', { name: 'Trajectory toolbar' })).toBeTruthy()
    expect(screen.getByText('Turn 1')).toBeTruthy()
    expect(screen.getByText('Turn 2')).toBeTruthy()
    expect(screen.getByText('Inspect the Event boundary.')).toBeTruthy()
  })
})
