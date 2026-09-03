import type { SessionEvent } from '@runfold/event/session/types'

const START_TIME = 1_725_000_000_000
const EVENTS_PER_TURN = 10

/** Build a deterministic, contiguous Event log accepted by the retained projection. */
export function eventLog(requestedEvents = 20): readonly SessionEvent[] {
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

  const bounded = Number.isSafeInteger(requestedEvents)
    ? Math.max(0, Math.min(requestedEvents, 100_000))
    : 0
  const turns = Math.max(2, Math.ceil(bounded / EVENTS_PER_TURN))

  for (let turn = 1; turn <= turns; turn++) {
    append('turn/start', { turn })
    append('user/message', {
      id: `runfold-user-${turn}`,
      role: 'user',
      content: [{ type: 'text', text: turn === 1 ? 'Inspect the Event boundary.' : `Continue pass ${turn}.` }],
      source: { kind: 'user' },
    }, { surfaceOp: 'append' })
    append('step/start', { turn, step: 1 })
    append('request/header', {
      reason: turn === 1 ? 'initial' : 'series',
      header: {
        config: { provider: 'runfold-test', model: 'event-test-model' },
        system: 'Exercise the Runfold Event system.',
        tools: [],
      },
    })
    const reasoning = append('assistant/chunk', {
      turn,
      step: 1,
      chunk: { type: 'reasoning-delta', index: 0, text: 'Checking the Event log.' },
    })
    const text = append('assistant/chunk', {
      turn,
      step: 1,
      chunk: { type: 'text-delta', index: 1, text: 'The Event boundary is intact.' },
    })
    append('assistant/chunk', {
      turn,
      step: 1,
      chunk: { type: 'usage', usage: { inputTokens: 100 + turn, outputTokens: 20, reasoningTokens: 8 } },
    })
    append('assistant/message', {
      turn,
      step: 1,
      message: {
        id: `runfold-assistant-${turn}`,
        role: 'assistant',
        content: [{ type: 'text', text: 'The Event boundary is intact.' }],
        source: { kind: 'model', provider: 'runfold-test', model: 'event-test-model' },
      },
      usage: { inputTokens: 100 + turn, outputTokens: 20, reasoningTokens: 8 },
    }, { surfaceOp: 'append', sourceEventSeqs: [reasoning, text] })
    append('step/end', { turn, step: 1 })
    append('turn/end', { turn, reason: { kind: 'completed' } })
  }

  return events.slice(0, bounded)
}

