import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import SessionStore, { Session, SessionId } from '@perix/event-sdk'
import JsonlSessionPersistence from '@perix/event-sdk/persistence-jsonl'
import { createUserMessage } from '@perix/event-sdk/messages'
import { Context } from '@perix/event-sdk/runtime'

const contexts: Context[] = []
const roots: string[] = []

async function persistentContext(root: string): Promise<Context> {
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

async function storageRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'perix-event-sdk-'))
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
  for (const context of contexts.splice(0)) await context.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('Perix Event JSONL persistence', () => {
  it('persists, lists, reads suffixes, and exposes the exact raw artifact', async () => {
    const root = await storageRoot()
    const context = await persistentContext(root)
    const session = context.sessions.create(SessionId('round-trip'), { meta: { cwd: '/workspace' } })
    appendClosedTurn(session, 'persist me')
    await context.sessions.flush(session)

    const loaded = await context.sessionPersistence.load(session.id)
    expect(loaded.events).toEqual(session.events)
    expect((await context.sessionPersistence.list()).map(header => header.id))
      .toContain(SessionId('round-trip'))
    expect((await context.sessionPersistence.readFrom(session.id, 1)).events.map(event => event.seq))
      .toEqual([1, 2])

    const raw = await context.sessionPersistence.readRaw(session.id)
    expect(raw?.filename).toBe('session.jsonl')
    expect(raw?.content.endsWith('\n')).toBe(true)
    expect(raw?.content).toContain('persist me')
    expect(await readFile(context.sessionPersistence.locate(session.header)!.path, 'utf8'))
      .toBe(raw?.content)
  })

  it('restores the same immutable Event history in a fresh runtime', async () => {
    const root = await storageRoot()
    const writer = await persistentContext(root)
    const original = writer.sessions.create(SessionId('restart'))
    appendClosedTurn(original, 'survive restart')
    await writer.sessions.flush(original)
    const expected = structuredClone(original.events)
    await writer.fiber.dispose()
    contexts.splice(contexts.indexOf(writer), 1)

    const reader = await persistentContext(root)
    const preparation = await reader.sessionPersistence.prepare(SessionId('restart'))
    const restored = preparation.session
    expect(restored.events.slice(0, expected.length)).toEqual(expected)
    expect(restored.events.at(-1)?.type).toBe('session/end-seed')
    expect(restored.events.every(event => Object.isFrozen(event))).toBe(true)
    expect(restored.deriveMessages()[0]?.content).toEqual([{ type: 'text', text: 'survive restart' }])
    preparation[Symbol.dispose]()
  })

  it('keeps concurrent session buffers isolated', async () => {
    const root = await storageRoot()
    const context = await persistentContext(root)
    const left = context.sessions.create(SessionId('left'))
    const right = context.sessions.create(SessionId('right'))
    appendClosedTurn(left, 'left-only')
    appendClosedTurn(right, 'right-only')
    await Promise.all([context.sessions.flush(left), context.sessions.flush(right)])

    const [leftLog, rightLog] = await Promise.all([
      context.sessionPersistence.load(left.id),
      context.sessionPersistence.load(right.id),
    ])
    expect(JSON.stringify(leftLog.events)).toContain('left-only')
    expect(JSON.stringify(leftLog.events)).not.toContain('right-only')
    expect(JSON.stringify(rightLog.events)).toContain('right-only')
    expect(JSON.stringify(rightLog.events)).not.toContain('left-only')
  })
})
