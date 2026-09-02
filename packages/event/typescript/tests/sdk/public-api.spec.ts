import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import SessionStore, { Session, SessionId } from '@perix/event-sdk'
import SessionStoreFromSession from '@perix/event-sdk/session'
import JsonlSessionPersistence from '@perix/event-sdk/persistence-jsonl'
import SessionPersistence from '@perix/event-sdk/persistence'
import { Context } from '@perix/event-sdk/runtime'
import { createAssistantMessage, createUserMessage } from '@perix/event-sdk/messages'
import * as chunkRows from '@perix/event-sdk/session/chunk-rows'
import * as persistenceInvariant from '@perix/event-sdk/persistence/invariant'
import * as jsonlInvariant from '@perix/event-sdk/persistence-jsonl/invariant'
import * as sessionInvariant from '@perix/event-sdk/session/invariant'
import * as surface from '@perix/event-sdk/session/surface'

describe('@perix/event-sdk public contract', () => {
  it('exposes every documented entry point under the Perix namespace', async () => {
    const manifest = JSON.parse(await readFile(new URL('../../sdk/package.json', import.meta.url), 'utf8')) as {
      name: string
      exports: Record<string, unknown>
    }

    expect(manifest.name).toBe('@perix/event-sdk')
    expect(Object.keys(manifest.exports).sort()).toEqual([
      '.',
      './messages',
      './persistence',
      './persistence-jsonl',
      './persistence-jsonl/invariant',
      './persistence/invariant',
      './runtime',
      './session',
      './session/chunk-rows',
      './session/invariant',
      './session/surface',
      './session/types',
    ])
  })

  it('keeps the root and subpath identities consistent', () => {
    expect(SessionStore).toBe(SessionStoreFromSession)
    expect(typeof Session.create).toBe('function')
    expect(SessionId('public-id')).toBe('public-id')
    expect(Object.keys(chunkRows).length).toBeGreaterThan(0)
    expect(Object.keys(sessionInvariant).length).toBeGreaterThan(0)
    expect(Object.keys(surface).length).toBeGreaterThan(0)
    expect(Object.keys(persistenceInvariant).length).toBeGreaterThan(0)
    expect(Object.keys(jsonlInvariant).length).toBeGreaterThan(0)
  })

  it('provides all construction primitives without requiring consumer DSH imports', () => {
    expect(typeof Context).toBe('function')
    expect(typeof SessionPersistence).toBe('function')
    expect(typeof JsonlSessionPersistence).toBe('function')
    expect(createUserMessage({
      content: [{ type: 'text', text: 'hello' }],
      source: { kind: 'user' },
    }).role).toBe('user')
    expect(createAssistantMessage({
      content: [{ type: 'text', text: 'hello' }],
      source: { provider: 'perix-test', model: 'event-test-model' },
    }).role).toBe('assistant')
  })
})
