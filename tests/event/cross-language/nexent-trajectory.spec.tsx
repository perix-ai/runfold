import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEventRuntime, SessionId } from '@runfold/event'
import type { EventRuntime, SessionEvent, SessionHeader } from '@runfold/event'
import JsonlSessionPersistence from '@runfold/event/persistence-jsonl'
import { EventTrajectory } from '@runfold/trajectory-ui'

const fixtureRoot = resolve(import.meta.dirname, 'fixtures/nexent-r33')
const projectDirectory = '--workspace-nexent-acceptance--'
const roots: string[] = []
const runtimes: EventRuntime[] = []

interface Fixture {
  readonly header: SessionHeader
  readonly events: readonly SessionEvent[]
}

async function readFixture(sessionId: string): Promise<Fixture> {
  const content = await readFile(
    join(fixtureRoot, projectDirectory, sessionId, 'session.jsonl'),
    'utf8',
  )
  const [header, ...events] = content.trimEnd().split('\n')
  const { type: headerType, ...meta } = JSON.parse(header!) as SessionHeader & {
    type: string
  }
  if (headerType !== 'session') throw new Error('Nexent fixture lacks a Session header')
  return {
    header: meta as SessionHeader,
    events: events.map(line => JSON.parse(line) as SessionEvent),
  }
}

async function installedFixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'runfold-event-nexent-r33-'))
  roots.push(root)
  await cp(
    join(fixtureRoot, projectDirectory),
    join(root, projectDirectory),
    { recursive: true },
  )
  return root
}

function eventRuntime(root: string): EventRuntime {
  const runtime = createEventRuntime({
    persistence: host => new JsonlSessionPersistence(host, {
      root,
      compression: 'none',
      writeBatchMaxDelayMs: 1,
    }),
  })
  runtimes.push(runtime)
  return runtime
}

afterEach(async () => {
  cleanup()
  for (const runtime of runtimes.splice(0)) await runtime.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('Nexent Python Event trajectory acceptance', () => {
  it('restores, projects, and renders the real parent and fork through public TypeScript APIs', async () => {
    const parentFixture = await readFixture('nexent-real')
    const childFixture = await readFixture('nexent-real-fork')
    const runtime = eventRuntime(await installedFixtureRoot())

    const storedParent = await runtime.persistence!.load(SessionId('nexent-real'))
    expect(storedParent.meta).toEqual(parentFixture.header)
    expect(storedParent.events).toEqual(parentFixture.events)

    const parent = await runtime.restore(SessionId('nexent-real'))
    expect(parent.firstLiveSeq).toBe(21)
    expect(parent.events.slice(0, parentFixture.events.length)).toEqual(parentFixture.events)
    expect(parent.events.map(event => event.seq)).toEqual(
      parent.events.map((_, index) => index),
    )
    expect(
      parent.events
        .filter(event => event.type === 'session/end-seed')
        .map(event => event.seq),
    ).toEqual([13, 21])
    expect(parent.requestHeader()).toEqual({
      config: {
        provider: 'nexent-acceptance',
        model: 'deterministic-event-model',
      },
      system: '[Nexent system prompt omitted from sanitized acceptance fixture]',
    })
    expect(parent.surface.nodes).toEqual([1, 4, 10, 15, 18])
    const messages = parent.deriveMessages()
    expect(messages.map(message => message.role)).toEqual([
      'user',
      'assistant',
      'user',
      'user',
      'assistant',
    ])
    expect(JSON.stringify(messages)).toContain('The result remains five.')

    const rootCall = parent.events.find(event => event.type === 'tool/call')
    expect(rootCall?.data).toMatchObject({
      name: 'python_interpreter',
      arguments: "value = add(a=2, b=3)\nfinal_answer(value)",
    })
    const rootCallId = (rootCall?.data as { callId: string }).callId
    const dispatches = parent.events
      .filter(event => event.type === 'tool/code-dispatch')
      .map(event => event.data as {
        name: string
        rootCallId: string
        parentCallId: string
        isError: boolean
      })
    expect(dispatches.map(dispatch => dispatch.name)).toEqual(['add', 'final_answer'])
    expect(dispatches.every(dispatch =>
      dispatch.rootCallId === rootCallId
      && dispatch.parentCallId === rootCallId
      && dispatch.isError === false,
    )).toBe(true)

    const parentView = render(<EventTrajectory events={parent.events} locale="en" />)
    expect(screen.getByRole('toolbar', { name: 'Trajectory toolbar' })).toBeTruthy()
    expect(screen.getByText('Turn 1')).toBeTruthy()
    expect(screen.getByText('Turn 2')).toBeTruthy()
    expect(screen.getByText(/Add two and three/)).toBeTruthy()
    expect(screen.getAllByText('The result remains five.').length).toBeGreaterThan(0)
    parentView.unmount()

    const storedChild = await runtime.persistence!.load(SessionId('nexent-real-fork'))
    expect(storedChild.meta).toEqual(childFixture.header)
    expect(storedChild.events).toEqual(childFixture.events)

    const child = await runtime.restore(SessionId('nexent-real-fork'))
    expect(child.header).toMatchObject({
      id: SessionId('nexent-real-fork'),
      cwd: '/workspace/nexent-acceptance',
      parentSession: SessionId('nexent-real'),
      seedLength: 21,
    })
    expect(child.firstLiveSeq).toBe(29)
    expect(child.events.slice(0, child.header.seedLength)).toEqual(parentFixture.events)
    expect(child.events.slice(0, childFixture.events.length)).toEqual(childFixture.events)
    expect(child.events.at(-1)).toMatchObject({
      type: 'session/end-seed',
      seq: 29,
      data: {},
    })
    expect(child.events.map(event => event.seq)).toEqual(
      child.events.map((_, index) => index),
    )

    render(<EventTrajectory events={child.events} locale="en" />)
    expect(screen.getByText('Turn 3')).toBeTruthy()
    expect(screen.getByText(/Continue from the fork/)).toBeTruthy()
    expect(
      screen.getAllByText('The fork continued independently.').length,
    ).toBeGreaterThan(0)
  })
})
