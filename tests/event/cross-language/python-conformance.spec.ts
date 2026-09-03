import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createEventRuntime, interruptedTurnClosers, Session, SessionId } from '@runfold/event'
import type { EventRuntime } from '@runfold/event'
import JsonlSessionPersistence, { type JsonlCompression } from '@runfold/event/persistence-jsonl'
import { createUserMessage } from '@runfold/event/messages'
import { EventTrajectory } from '@runfold/trajectory-ui'

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

  it('preserves DSH seed boundaries across repeated cross-language restores', async () => {
    const root = await storageRoot('seed-boundaries')
    runPython(`
import sys
from perix_event import JsonlSessionPersistence, SessionStore

persistence = JsonlSessionPersistence(sys.argv[1], compression='none')
store = SessionStore(persistence)
session = store.create('segments', meta={'cwd': '/workspace'})
session.append('turn/start', {'turn': 1})
session.append('turn/end', {'turn': 1, 'reason': {'kind': 'completed'}})
store.close()
`, root)

    const firstRuntime = eventContext(root, 'none')
    const first = await firstRuntime.restore(SessionId('segments'))
    expect(first.events.filter(event => event.type === 'session/end-seed').map(event => event.seq))
      .toEqual([2])
    first.append('turn/start', { turn: 2 })
    first.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
    await firstRuntime.sessions.flush(first)
    await firstRuntime.dispose()
    runtimes.splice(runtimes.indexOf(firstRuntime), 1)

    const pythonRestore = JSON.parse(runPython(`
import json
import sys
from perix_event import JsonlSessionPersistence, SessionStore

persistence = JsonlSessionPersistence(sys.argv[1], compression='none')
before = persistence.load('segments')
store = SessionStore(persistence)
session = store.restore('segments')
result = {
    'prefixPreserved': list(session.events[:len(before.events)]) == list(before.events),
    'markers': [event['seq'] for event in session.events if event['type'] == 'session/end-seed'],
    'seqsContiguous': [event['seq'] for event in session.events] == list(range(len(session.events))),
}
store.close()
print(json.dumps(result))
`, root)) as { prefixPreserved: boolean; markers: number[]; seqsContiguous: boolean }
    expect(pythonRestore).toEqual({
      prefixPreserved: true,
      markers: [2, 5],
      seqsContiguous: true,
    })

    const terminalRuntime = eventContext(root, 'none')
    const terminal = await terminalRuntime.restore(SessionId('segments'))
    expect(terminal.events).toHaveLength(6)
    expect(terminal.events.filter(event => event.type === 'session/end-seed').map(event => event.seq))
      .toEqual([2, 5])
    terminal.append('turn/start', { turn: 3 })
    terminal.append('turn/end', { turn: 3, reason: { kind: 'completed' } })
    await terminalRuntime.sessions.flush(terminal)
    await terminalRuntime.dispose()
    runtimes.splice(runtimes.indexOf(terminalRuntime), 1)

    const finalRestore = JSON.parse(runPython(`
import json
import sys
from perix_event import JsonlSessionPersistence, SessionStore

persistence = JsonlSessionPersistence(sys.argv[1], compression='none')
before = persistence.load('segments')
store = SessionStore(persistence)
session = store.resume('segments')
print(json.dumps({
    'prefixPreserved': list(session.events[:len(before.events)]) == list(before.events),
    'markers': [event['seq'] for event in session.events if event['type'] == 'session/end-seed'],
    'seqsContiguous': [event['seq'] for event in session.events] == list(range(len(session.events))),
}))
store.close()
`, root)) as { prefixPreserved: boolean; markers: number[]; seqsContiguous: boolean }
    expect(finalRestore).toEqual({
      prefixPreserved: true,
      markers: [2, 5, 8],
      seqsContiguous: true,
    })
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
      const originalPythonHeader = structuredClone(pythonLog.meta)
      const originalPythonEvents = structuredClone(pythonLog.events)
      expect(pythonLog.events[1]?.data).toMatchObject({
        id: 'python-user-1',
        content: [{ type: 'text', text: 'python to typescript' }],
      })
      render(React.createElement(EventTrajectory, {
        events: pythonLog.events,
        locale: 'en',
      }))
      expect(screen.getByText('python to typescript')).toBeTruthy()

      const resumedPython = await reader.restore(SessionId('python-writer'))
      expect(reader.sessions.get(SessionId('python-writer'))).toBe(resumedPython)
      expect(resumedPython.header).toEqual(originalPythonHeader)
      expect(resumedPython.events.slice(0, originalPythonEvents.length)).toEqual(originalPythonEvents)
      expect(resumedPython.events).toHaveLength(originalPythonEvents.length + 1)
      expect(resumedPython.events.at(-1)).toMatchObject({
        type: 'session/end-seed',
        seq: originalPythonEvents.length,
        data: {},
      })
      expect(resumedPython.events.filter(event => event.type === 'session/end-seed')).toHaveLength(1)
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
      expect(resumedPython.events.map(event => event.seq))
        .toEqual(resumedPython.events.map((_, index) => index))
      expect(typescriptChild.header).toMatchObject({
        parentSession: SessionId('python-writer'),
        seedLength: resumedPython.events.length,
        cwd: '/workspace',
      })
      expect(typescriptChild.events.slice(0, resumedPython.events.length)).toEqual(resumedPython.events)
      expect(typescriptChild.events.at(-1)?.type).toBe('session/end-seed')
      expect(typescriptChild.events.map(event => event.seq))
        .toEqual(typescriptChild.events.map((_, index) => index))

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
python_parent_inspection = persistence.load('python-writer')
typescript_child_inspection = persistence.load('typescript-child')
typescript_writer_inspection = persistence.load('typescript-writer')
store = SessionStore(persistence)
python_parent = store.restore('python-writer')
typescript_child = store.resume('typescript-child')
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
python_child = persistence.load('python-child')
print(json.dumps({
    'loaded': len(typescript_writer_inspection.events),
    'childEvents': len(python_child.events),
    'parent': python_child.meta['parentSession'],
    'pythonParentHeaderPreserved': python_parent.header == python_parent_inspection.meta,
    'pythonParentPrefixPreserved': list(python_parent.events[:len(python_parent_inspection.events)]) == list(python_parent_inspection.events),
    'pythonParentAddedEndSeed': len(python_parent.events) == len(python_parent_inspection.events) + 1 and python_parent.events[-1]['type'] == 'session/end-seed',
    'pythonParentSeqsContiguous': [event['seq'] for event in python_parent.events] == list(range(len(python_parent.events))),
    'pythonParentHasResume': 'typescript resumed python' in json.dumps(python_parent.events),
    'pythonParentFirstLiveSeq': python_parent.first_live_seq,
    'typescriptChildParent': typescript_child.header['parentSession'],
    'typescriptChildSeedLength': typescript_child.header['seedLength'],
    'typescriptChildPrefixMatches': list(typescript_child.events[:typescript_child.header['seedLength']]) == list(python_parent_inspection.events),
    'typescriptChildResumeStable': len(typescript_child.events) == len(typescript_child_inspection.events),
    'typescriptChildSeqsContiguous': [event['seq'] for event in typescript_child.events] == list(range(len(typescript_child.events))),
    'typescriptChildHasResume': 'typescript resumed python' in json.dumps(typescript_child.events),
    'typescriptChildFirstLiveSeq': typescript_child.first_live_seq,
}))
`, root, compression)) as {
        loaded: number
        childEvents: number
        parent: string
        pythonParentHeaderPreserved: boolean
        pythonParentPrefixPreserved: boolean
        pythonParentAddedEndSeed: boolean
        pythonParentSeqsContiguous: boolean
        pythonParentHasResume: boolean
        pythonParentFirstLiveSeq: number
        typescriptChildParent: string
        typescriptChildSeedLength: number
        typescriptChildPrefixMatches: boolean
        typescriptChildResumeStable: boolean
        typescriptChildSeqsContiguous: boolean
        typescriptChildHasResume: boolean
        typescriptChildFirstLiveSeq: number
      }
      expect(result).toEqual({
        loaded: 3,
        childEvents: 8,
        parent: 'typescript-writer',
        pythonParentHeaderPreserved: true,
        pythonParentPrefixPreserved: true,
        pythonParentAddedEndSeed: true,
        pythonParentSeqsContiguous: true,
        pythonParentHasResume: true,
        pythonParentFirstLiveSeq: 7,
        typescriptChildParent: 'python-writer',
        typescriptChildSeedLength: 7,
        typescriptChildPrefixMatches: true,
        typescriptChildResumeStable: true,
        typescriptChildSeqsContiguous: true,
        typescriptChildHasResume: true,
        typescriptChildFirstLiveSeq: 8,
      })

      const finalReader = eventContext(root, compression)
      const child = await finalReader.restore(SessionId('python-child'))
      expect(child.header.parentSession).toBe(SessionId('typescript-writer'))
      expect(child.events.map(event => event.seq)).toEqual(child.events.map((_, index) => index))
      expect(JSON.stringify(child.events)).toContain('python resumed typescript')
    })
  }
})
