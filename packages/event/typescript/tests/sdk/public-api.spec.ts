import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import SessionStore, { createEventRuntime, KNOWN_SESSION_EVENT_TYPES, Session, SessionId } from '@runfold/event'
import SessionStoreFromSession from '@runfold/event/session'
import JsonlSessionPersistence from '@runfold/event/persistence-jsonl'
import SessionPersistence from '@runfold/event/persistence'
import { EventHost } from '@runfold/event/runtime'
import { createAssistantMessage, createUserMessage } from '@runfold/event/messages'
import * as chunkRows from '@runfold/event/session/chunk-rows'
import * as surface from '@runfold/event/session/surface'

describe('@runfold/event public contract', () => {
  it('exposes every documented entry point under the Runfold namespace', async () => {
    const manifest = JSON.parse(await readFile(new URL('../../sdk/package.json', import.meta.url), 'utf8')) as {
      name: string
      exports: Record<string, unknown>
    }

    expect(manifest.name).toBe('@runfold/event')
    expect(Object.keys(manifest.exports).sort()).toEqual([
      '.',
      './messages',
      './persistence',
      './persistence-jsonl',
      './runtime',
      './session',
      './session/chunk-rows',
      './session/surface',
      './session/types',
    ])
  })

  it('keeps the root and subpath identities consistent', () => {
    expect(SessionStore).toBe(SessionStoreFromSession)
    expect(typeof Session.create).toBe('function')
    expect(SessionId('public-id')).toBe('public-id')
    expect(Object.keys(chunkRows).length).toBeGreaterThan(0)
    expect(Object.keys(surface).length).toBeGreaterThan(0)
  })

  it('provides all construction primitives without requiring consumer DSH imports', async () => {
    expect(typeof EventHost).toBe('function')
    const runtime = createEventRuntime()
    expect(runtime.sessions).toBeInstanceOf(SessionStore)
    expect(runtime.host.get('sessions')).toBeDefined()
    expect(runtime.persistence).toBeUndefined()
    await expect(runtime.restore(SessionId('nothing'))).rejects.toThrow(/without configured persistence/)
    await runtime.dispose()
    expect(runtime.host.get('sessions')).toBeUndefined()
    expect(typeof SessionPersistence).toBe('function')
    expect(typeof JsonlSessionPersistence).toBe('function')
    expect(createUserMessage({
      content: [{ type: 'text', text: 'hello' }],
      source: { kind: 'user' },
    }).role).toBe('user')
    expect(createAssistantMessage({
      content: [{ type: 'text', text: 'hello' }],
      source: { provider: 'runfold-test', model: 'event-test-model' },
    }).role).toBe('assistant')
  })

  it('exposes exactly the shared known Event type vocabulary', async () => {
    const shared = JSON.parse(await readFile(
      new URL('../../../../../conformance/event/v0/cases/known-event-types.json', import.meta.url),
      'utf8',
    )) as { types: string[] }

    expect([...KNOWN_SESSION_EVENT_TYPES].sort()).toEqual(shared.types)
  })
})
