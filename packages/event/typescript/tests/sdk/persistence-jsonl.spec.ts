import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createEventRuntime, Session, SessionId } from '@runfold/event'
import type { EventRuntime } from '@runfold/event'
import JsonlSessionPersistence from '@runfold/event/persistence-jsonl'
import { createUserMessage } from '@runfold/event/messages'

const runtimes: EventRuntime[] = []
const roots: string[] = []

function persistentContext(root: string): EventRuntime {
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

async function storageRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'runfold-event-sdk-'))
  roots.push(root)
  return root
}

function appendClosedTurn(session: Session, text: string): void {
  session.append('turn/start', { turn: 1 })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
}

afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('Runfold Event JSONL persistence', () => {
  it('persists, lists, reads suffixes, and exposes the exact raw artifact', async () => {
    const root = await storageRoot()
    const context = persistentContext(root)
    const session = context.sessions.create(SessionId('round-trip'), { meta: { cwd: '/workspace' } })
    appendClosedTurn(session, 'persist me')
    await context.sessions.flush(session)

    const loaded = await context.persistence!.load(session.id)
    expect(loaded.events).toEqual(session.events)
    expect((await context.persistence!.list()).map(header => header.id))
      .toContain(SessionId('round-trip'))
    expect((await context.persistence!.readFrom(session.id, 1)).events.map(event => event.seq))
      .toEqual([1, 2])

    const raw = await context.persistence!.readRaw(session.id)
    expect(raw?.filename).toBe('session.jsonl')
    expect(raw?.content.endsWith('\n')).toBe(true)
    expect(raw?.content).toContain('persist me')
    expect(await readFile(context.persistence!.locate(session.header)!.path, 'utf8'))
      .toBe(raw?.content)
  })

  it('restores the same immutable Event history in a fresh runtime', async () => {
    const root = await storageRoot()
    const writer = persistentContext(root)
    const original = writer.sessions.create(SessionId('restart'))
    appendClosedTurn(original, 'survive restart')
    await writer.sessions.flush(original)
    const expected = structuredClone(original.events)
    await writer.dispose()
    runtimes.splice(runtimes.indexOf(writer), 1)

    const reader = persistentContext(root)
    const restored = await reader.restore(SessionId('restart'))
    expect(restored.events.slice(0, expected.length)).toEqual(expected)
    expect(restored.events.at(-1)?.type).toBe('session/end-seed')
    expect(restored.events.every(event => Object.isFrozen(event))).toBe(true)
    expect(restored.deriveMessages()[0]?.content).toEqual([{ type: 'text', text: 'survive restart' }])
    expect(reader.sessions.get(SessionId('restart'))).toBe(restored)
    await expect(reader.restore(SessionId('restart'))).rejects.toThrow(/live|already exists/)

    restored.append('turn/start', { turn: 2 })
    restored.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
    await reader.sessions.flush(restored)
    await reader.dispose()
    runtimes.splice(runtimes.indexOf(reader), 1)

    const verifier = persistentContext(root)
    const reloaded = await verifier.persistence!.load(SessionId('restart'))
    expect(reloaded.events.map(event => event.seq)).toEqual(restored.events.map(event => event.seq))
    expect(reloaded.events.at(-1)?.type).toBe('turn/end')
  })

  it('keeps concurrent session buffers isolated', async () => {
    const root = await storageRoot()
    const context = persistentContext(root)
    const left = context.sessions.create(SessionId('left'))
    const right = context.sessions.create(SessionId('right'))
    appendClosedTurn(left, 'left-only')
    appendClosedTurn(right, 'right-only')
    await Promise.all([context.sessions.flush(left), context.sessions.flush(right)])

    const [leftLog, rightLog] = await Promise.all([
      context.persistence!.load(left.id),
      context.persistence!.load(right.id),
    ])
    expect(JSON.stringify(leftLog.events)).toContain('left-only')
    expect(JSON.stringify(leftLog.events)).not.toContain('right-only')
    expect(JSON.stringify(rightLog.events)).toContain('right-only')
    expect(JSON.stringify(rightLog.events)).not.toContain('left-only')
  })
})
