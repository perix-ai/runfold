import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createEventRuntime, interruptedTurnClosers, Session, SessionId } from '@perix/event-sdk'
import type { EventRuntime } from '@perix/event-sdk'
import JsonlSessionPersistence, { type JsonlCompression } from '@perix/event-sdk/persistence-jsonl'
import { createUserMessage } from '@perix/event-sdk/messages'
import { EventTrajectory } from '@perix/event-ui'

const repositoryRoot = resolve(import.meta.dirname, '../../..')
const pythonSource = join(repositoryRoot, 'packages/event/python/src')
const roots: string[] = []
const runtimes: EventRuntime[] = []

async function storageRoot(label: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `perix-event-${label}-`))
  roots.push(root)
  return root
}

function eventContext(root: string, compression: JsonlCompression): EventRuntime {
  const runtime = createEventRuntime({
    persistence: host => new JsonlSessionPersistence(host, {
      root,
      compression,
      writeBatchMaxDelayMs: 1,
    }),
  })
  runtimes.push(runtime)
  return runtime
}

function runPython(source: string, ...args: string[]): string {
  return execFileSync('python3', ['-c', source, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PYTHONPATH: pythonSource,
    },
  }).trim()
}

afterEach(async () => {
  cleanup()
  for (const runtime of runtimes.splice(0)) {
    await runtime.dispose()
  }
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('TypeScript and Python Event conformance', () => {
  it('returns the same result for every shared valid and invalid Session case', async () => {
    const cases = JSON.parse(await readFile(
      join(repositoryRoot, 'conformance/event/v0/cases/session-validation.json'),
      'utf8',
    )) as Array<{
      name: string
      accepted: boolean
      header: { id: string }
      events: unknown[]
    }>

    for (const testCase of cases) {
      let accepted = true
      try {
        Session.fromRestore(
          SessionId(testCase.header.id),
          structuredClone(testCase.events) as never,
          structuredClone(testCase.header) as never,
        )
      } catch {
        accepted = false
      }
      expect(accepted, testCase.name).toBe(testCase.accepted)
    }
  })

  it('produces the exact shared interrupted-turn repair result', async () => {
    const testCase = JSON.parse(await readFile(
      join(repositoryRoot, 'conformance/event/v0/cases/repair.json'),
      'utf8',
    )) as { events: unknown[]; expected: unknown[] }

    expect(interruptedTurnClosers(testCase.events as never)).toEqual(testCase.expected)
  })

  it('projects the same shared packed JSONL fixture', async () => {
    const root = await storageRoot('fixture')
    const fixture = join(repositoryRoot, 'conformance/event/v0/fixtures/session.jsonl')
    const expected = JSON.parse(await readFile(
      join(repositoryRoot, 'conformance/event/v0/fixtures/session.expected.json'),
      'utf8',
    )) as { eventCount: number; surface: number[]; messages: unknown[] }
    const targetDir = join(root, '--workspace--', 'conformance-v0')
    await mkdir(targetDir, { recursive: true })
    await copyFile(fixture, join(targetDir, 'session.jsonl'))

    const context = eventContext(root, 'none')
    const loaded = await context.persistence!.load(SessionId('conformance-v0'))
    const session = Session.fromRestore(
      SessionId('conformance-v0'),
      structuredClone(loaded.events),
      structuredClone(loaded.meta),
    )

    expect(loaded.events).toHaveLength(expected.eventCount)
    expect(session.surface.nodes).toEqual(expected.surface)
    expect(session.deriveMessages()).toEqual(expected.messages)
    expect((loaded.events[7] as { sourceEventSeqs?: number[] })?.sourceEventSeqs).toEqual([4, 5, 6])
  })

  for (const compression of ['none', 'zstd'] as const) {
    it(`reads, resumes, appends, and forks both directions with ${compression}`, async () => {
      const root = await storageRoot(`cross-${compression}`)
      runPython(`
import sys
from perix_event import JsonlSessionPersistence, SessionStore

root, compression = sys.argv[1], sys.argv[2]
persistence = JsonlSessionPersistence(root, compression=compression)
store = SessionStore(persistence)
session = store.create('python-writer', meta={'cwd': '/workspace'})
session.append('turn/start', {'turn': 1})
session.append('user/message', {
    'id': 'python-user-1',
    'role': 'user',
    'content': [{'type': 'text', 'text': 'python to typescript'}],
    'source': {'kind': 'user'},
}, surface_op='append')
session.append('turn/end', {'turn': 1, 'reason': {'kind': 'completed'}})
store.close()
`, root, compression)

      const reader = eventContext(root, compression)
      const pythonLog = await reader.persistence!.load(SessionId('python-writer'))
      expect(pythonLog.events[1]?.data).toMatchObject({
        id: 'python-user-1',
        content: [{ type: 'text', text: 'python to typescript' }],
      })
      render(React.createElement(EventTrajectory, {
        events: pythonLog.events,
        locale: 'en',
      }))
      expect(screen.getByText('python to typescript')).toBeTruthy()

      const resumedPython = reader.sessions.create(SessionId('python-writer'), {
        seed: pythonLog.events,
        meta: {
          createdAt: pythonLog.meta.createdAt,
          ...(pythonLog.meta.cwd === undefined ? {} : { cwd: pythonLog.meta.cwd }),
        },
      })
      await reader.sessions.flush(resumedPython)
      resumedPython.append('turn/start', { turn: 2 })
      resumedPython.append('user/message', createUserMessage({
        content: [{ type: 'text', text: 'typescript resumed python' }],
        source: { kind: 'user' },
      }), { surfaceOp: 'append' })
      resumedPython.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
      await reader.sessions.flush(resumedPython)
      const typescriptChild = reader.sessions.fork(
        resumedPython,
        undefined,
        SessionId('typescript-child'),
      )
      await reader.sessions.flush(typescriptChild)

      const typescript = reader.sessions.create(SessionId('typescript-writer'), {
        meta: { cwd: '/workspace' },
      })
      typescript.append('turn/start', { turn: 1 })
      typescript.append('user/message', createUserMessage({
        content: [{ type: 'text', text: 'typescript to python' }],
        source: { kind: 'user' },
      }), { surfaceOp: 'append' })
      typescript.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      await reader.sessions.flush(typescript)
      await reader.dispose()
      runtimes.splice(runtimes.indexOf(reader), 1)

      const result = JSON.parse(runPython(`
import json
import sys
from perix_event import JsonlSessionPersistence, SessionStore

root, compression = sys.argv[1], sys.argv[2]
persistence = JsonlSessionPersistence(root, compression=compression)
inspection = persistence.load('typescript-writer')
typescript_child = persistence.load('typescript-child')
store = SessionStore(persistence)
session = store.resume('typescript-writer')
session.append('turn/start', {'turn': 2})
session.append('user/message', {
    'id': 'python-user-2',
    'role': 'user',
    'content': [{'type': 'text', 'text': 'python resumed typescript'}],
    'source': {'kind': 'user'},
}, surface_op='append')
session.append('turn/end', {'turn': 2, 'reason': {'kind': 'completed'}})
child = store.fork(session, child_session_id='python-child')
store.close()
print(json.dumps({
    'loaded': len(inspection.events),
    'childEvents': len(persistence.load('python-child').events),
    'parent': persistence.load('python-child').meta['parentSession'],
    'typescriptChildParent': typescript_child.meta['parentSession'],
    'typescriptChildHasResume': 'typescript resumed python' in json.dumps(typescript_child.events),
}))
`, root, compression)) as {
        loaded: number
        childEvents: number
        parent: string
        typescriptChildParent: string
        typescriptChildHasResume: boolean
      }
      expect(result).toMatchObject({ loaded: 3, parent: 'typescript-writer' })
      expect(result.childEvents).toBeGreaterThan(result.loaded)
      expect(result.typescriptChildParent).toBe('python-writer')
      expect(result.typescriptChildHasResume).toBe(true)

      const finalReader = eventContext(root, compression)
      const child = await finalReader.persistence!.load(SessionId('python-child'))
      expect(child.meta.parentSession).toBe(SessionId('typescript-writer'))
      expect(JSON.stringify(child.events)).toContain('python resumed typescript')
    })
  }
})
