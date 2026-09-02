import type { SessionEvent } from '@perix/event-sdk/session/types'

const START_TIME = 1_725_000_000_000
const EVENTS_PER_TURN = 10

export function demoEvents(requestedEvents = 0): readonly SessionEvent[] {
  const events: SessionEvent[] = []
  const append = (
    type: string,
    data: unknown,
    extra: Record<string, unknown> = {},
  ): number => {
    const seq = events.length
    events.push({
      type,
      seq,
      time: START_TIME + seq * 85,
      data,
      ...extra,
    } as SessionEvent)
    return seq
  }

  const requested = Number.isSafeInteger(requestedEvents)
    ? Math.max(0, Math.min(requestedEvents, 100_000))
    : 0
  const turns = Math.max(2, Math.ceil(requested / EVENTS_PER_TURN))

  for (let turn = 1; turn <= turns; turn++) {
    append('turn/start', { turn })
    append('user/message', {
      id: `user-${turn}`,
      role: 'user',
      content: [{
        type: 'text',
        text: turn === 1
          ? 'Inspect the repository and report risky boundaries.'
          : `Continue the repository inspection for pass ${turn}.`,
      }],
      source: { kind: 'user' },
    }, { surfaceOp: 'append' })
    append('step/start', { turn, step: 1 })
    append('request/header', {
      reason: turn === 1 ? 'initial' : 'series',
      header: {
        config: { provider: 'perix-test', model: 'event-test-model' },
        system: 'You are a careful repository engineer.',
        tools: [{
          name: 'search',
          description: 'Search repository text.',
          parameters: { type: 'object', properties: { query: { type: 'string' } } },
        }],
      },
    })
    const reasoning = append('assistant/chunk', {
      turn,
      step: 1,
      chunk: {
        type: 'reasoning-delta',
        index: 0,
        text: 'I will inspect the event path first.',
      },
    })
    const text = append('assistant/chunk', {
      turn,
      step: 1,
      chunk: {
        type: 'text-delta',
        index: 1,
        text: 'The event and persistence boundaries are separated.',
      },
    })
    append('assistant/chunk', {
      turn,
      step: 1,
      chunk: {
        type: 'usage',
        usage: { inputTokens: 420 + turn, outputTokens: 72, reasoningTokens: 28 },
      },
    })
    append('assistant/message', {
      turn,
      step: 1,
      message: {
        id: `assistant-${turn}`,
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'The event and persistence boundaries are separated.',
        }],
        source: { kind: 'model', provider: 'perix-test', model: 'event-test-model' },
      },
      usage: { inputTokens: 420 + turn, outputTokens: 72, reasoningTokens: 28 },
    }, { surfaceOp: 'append', sourceEventSeqs: [reasoning, text] })
    append('step/end', { turn, step: 1 })
    append('turn/end', { turn, reason: { kind: 'completed' } })
  }

  return events.slice(0, requested > 0 ? requested : events.length)
}
