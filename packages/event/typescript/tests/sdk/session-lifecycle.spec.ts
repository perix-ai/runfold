import { afterEach, describe, expect, it } from 'vitest'
import SessionStore, {
  Session,
  SessionForkError,
  SessionId,
} from '@perix/event-sdk'
import type { SessionEvent } from '@perix/event-sdk/session/types'
import { Context } from '@perix/event-sdk/runtime'
import { createAssistantMessage, createUserMessage } from '@perix/event-sdk/messages'

const contexts: Context[] = []

async function eventContext(): Promise<Context> {
  const context = new Context()
  contexts.push(context)
  await context.plugin(SessionStore)
  return context
}

function appendTurn(session: Session, turn = 1): void {
  session.append('turn/start', { turn })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: `question-${turn}` }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('step/start', { turn, step: 1 })
  session.append('request/header', {
    reason: 'initial',
    header: { config: { provider: 'perix-test', model: 'event-test-model' } },
  })
  session.append('assistant/message', {
    turn,
    step: 1,
    message: createAssistantMessage({
      content: [{ type: 'text', text: `answer-${turn}` }],
      source: { provider: 'perix-test', model: 'event-test-model' },
    }),
  }, { surfaceOp: 'append', sourceEventSeqs: [] })
  session.append('step/end', { turn, step: 1 })
  session.append('turn/end', { turn, reason: { kind: 'completed' } })
}

afterEach(async () => {
  for (const context of contexts.splice(0)) await context.fiber.dispose()
})

describe('Perix Event session lifecycle', () => {
  it('records contiguous immutable events and derives model history', async () => {
    const context = await eventContext()
    const session = context.sessions.create(SessionId('lifecycle'), { meta: { cwd: '/workspace' } })
    appendTurn(session)

    expect(session.events.map(event => event.seq)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(session.events.every(event => Object.isFrozen(event))).toBe(true)
    expect(session.deriveMessages().map(message => message.role)).toEqual(['user', 'assistant'])
    expect(session.requestHeader()?.config).toEqual({
      provider: 'perix-test',
      model: 'event-test-model',
    })
  })

  it('takes a detached snapshot and rejects non-JSON data atomically', () => {
    const session = Session.create(SessionId('immutability'))
    const input = {
      content: [{ type: 'text' as const, text: 'before' }],
      source: { kind: 'user' as const },
    }
    const event = session.append('user/message', createUserMessage(input), { surfaceOp: 'append' })
    input.content[0]!.text = 'after'

    expect(event.data.content).toEqual([{ type: 'text', text: 'before' }])
    const before = session.events
    expect(() => session.append('turn/start', { turn: Number.NaN }))
      .toThrow(/non-JSON-serializable/)
    expect(session.events).toBe(before)
  })

  it('forks only stable boundaries and records lineage', async () => {
    const context = await eventContext()
    const parent = context.sessions.create(SessionId('parent'), { meta: { cwd: '/workspace' } })
    appendTurn(parent)

    const child = context.sessions.fork(parent, undefined, SessionId('child'))
    expect(child.events.slice(0, -1)).toEqual(parent.events)
    expect(child.header).toMatchObject({
      id: SessionId('child'),
      parentSession: SessionId('parent'),
      seedLength: parent.events.length,
      cwd: '/workspace',
    })
    expect(child.events.at(-1)?.type).toBe('session/end-seed')

    const open = context.sessions.create(SessionId('open'))
    open.append('turn/start', { turn: 1 })
    expect(() => context.sessions.fork(open, 0, SessionId('invalid-child')))
      .toThrow(new SessionForkError(
        'fork boundary 0 in session "open" ends inside open turn 1',
        'OPEN_TURN',
      ))
  })

  it('replays an exported Event log without changing its durable prefix', () => {
    const source = Session.create(SessionId('source'))
    appendTurn(source)
    const exported = structuredClone(source.events) as SessionEvent[]
    const replay = Session.create(SessionId('replay'), exported)

    expect(replay.events.slice(0, exported.length)).toEqual(source.events)
    expect(replay.events.at(-1)?.type).toBe('session/end-seed')
    expect(replay.deriveMessages()).toEqual(source.deriveMessages())
  })
})
