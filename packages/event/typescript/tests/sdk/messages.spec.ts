import { describe, expect, it } from 'vitest'
import {
  callConfigEquals,
  createAssistantMessage,
  createMessage,
  createToolResultMessage,
  createUserMessage,
  freezeMessage,
  MessageId,
  ToolCallId,
} from '@perix/event-sdk/messages'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('@perix/event-sdk/messages', () => {
  it('mints v4 identities and freezes a detached copy', () => {
    const input = { content: [{ type: 'text' as const, text: 'before' }], source: { kind: 'user' as const } }
    const message = createUserMessage(input)
    input.content[0]!.text = 'after'

    expect(message.id).toMatch(UUID)
    expect(message.role).toBe('user')
    expect(message.content).toEqual([{ type: 'text', text: 'before' }])
    expect(Object.isFrozen(message)).toBe(true)
    expect(Object.isFrozen(message.content[0])).toBe(true)
    expect(createUserMessage(input).id).not.toBe(message.id)
  })

  it('fixes the assistant and tool-result envelopes', () => {
    const assistant = createAssistantMessage({
      content: [{ type: 'text', text: 'answer' }],
      source: { provider: 'perix-test', model: 'event-test-model' },
    })
    expect(assistant.role).toBe('assistant')
    expect(assistant.source).toEqual({ kind: 'model', provider: 'perix-test', model: 'event-test-model' })

    const callId = ToolCallId('call-1')
    const result = createToolResultMessage({ callId, content: [{ type: 'text', text: 'ok' }], isError: false })
    expect(result.role).toBe('user')
    expect(result.source).toEqual({ kind: 'tool', callId: 'call-1' })
    expect(result.content).toEqual([{
      type: 'tool-result',
      toolCallId: 'call-1',
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    }])
  })

  it('keeps an existing identity through freezeMessage and createMessage', () => {
    const kept = freezeMessage({ id: MessageId('m-1'), role: 'system', content: [], source: { kind: 'user' } })
    expect(kept.id).toBe('m-1')
    expect(Object.isFrozen(kept)).toBe(true)
    const minted = createMessage({ role: 'system', content: [], source: { kind: 'plugin', plugin: 'p' } })
    expect(minted.id).toMatch(UUID)
  })

  it('compares call configs field-wise including stop lists', () => {
    const base = { provider: 'p', model: 'm', stop: ['a', 'b'] }
    expect(callConfigEquals(base, { ...base, stop: ['a', 'b'] })).toBe(true)
    expect(callConfigEquals(base, { ...base, stop: ['a'] })).toBe(false)
    expect(callConfigEquals(base, { provider: 'p', model: 'm' })).toBe(false)
    expect(callConfigEquals({ provider: 'p', model: 'm' }, { provider: 'p', model: 'm', temperature: 0 })).toBe(false)
  })
})
