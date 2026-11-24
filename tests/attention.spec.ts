import { describe, expect, it } from 'vitest'
import type { NotificationAttention } from '../src/contract.ts'
import { acknowledgeAttention, parseAttentionAcknowledgements, reconcileAttention, type AttentionRow } from '../src/client/attention.ts'

const failure: NotificationAttention = { turn: 2, reason: 'error', endedAt: 123, message: 'offline', code: 'UNKNOWN' }
function row(attention: NotificationAttention | null = failure, turn = 2, reason = 'error'): AttentionRow {
  return { sessionId: 'session', projectionValues: { notification: { turn, reason, body: '', tools: [], attention } } }
}

describe('persistent attention reconciliation', () => {
  it('shows historical failures immediately and again on reload until acknowledged', () => {
    expect(reconcileAttention([row()], {})).toEqual([{ sessionId: 'session', ...failure }])
    const acknowledged = acknowledgeAttention({}, 'session', 2)
    const reloaded = parseAttentionAcknowledgements(JSON.parse(JSON.stringify(acknowledged)))
    expect(reloaded).toEqual({ session: 2 })
    expect(reconcileAttention([row()], reloaded)).toEqual([])
  })

  it('acknowledges one turn without suppressing a newer failure', () => {
    const original = Object.freeze({ session: 2 })
    expect(reconcileAttention([row({ ...failure, turn: 3 })], original)).toHaveLength(1)
    const next = acknowledgeAttention(original, 'session', 3)
    expect(original).toEqual({ session: 2 })
    expect(next).toEqual({ session: 3 })
    expect(acknowledgeAttention(next, 'session', 2)).toBe(next)
  })

  it('uses retained host attention after aborted/blocked turns and clears on success', () => {
    expect(reconcileAttention([row(failure, 3, 'aborted')], {})).toHaveLength(1)
    expect(reconcileAttention([row(failure, 4, 'blocked')], {})).toHaveLength(1)
    expect(reconcileAttention([row(null, 5, 'completed')], {})).toEqual([])
    expect(reconcileAttention([], {})).toEqual([])
  })

  it('handles legacy rows and excludes subagents', () => {
    const legacy = { sessionId: 'legacy', projectionValues: { notification: {
      turn: 1, reason: 'error', body: 'legacy failure', tools: [],
    } } }
    expect(reconcileAttention([legacy], {})).toEqual([{ sessionId: 'legacy', turn: 1, reason: 'error', endedAt: 0, message: 'legacy failure' }])
    expect(reconcileAttention([{ ...row(), origin: 'subagent' }, { sessionId: 'empty' }], {})).toEqual([])
  })

  it('persists only valid acknowledgement turns, handling prototype-like ids safely', () => {
    expect(parseAttentionAcknowledgements(null)).toEqual({})
    expect(parseAttentionAcknowledgements([])).toEqual({})
    expect(parseAttentionAcknowledgements({ valid: 1, negative: -1, fraction: 1.5, text: '2', infinite: Infinity })).toEqual({ valid: 1 })
    const ack = acknowledgeAttention({}, '__proto__', 2)
    expect(Object.hasOwn(ack, '__proto__')).toBe(true)
    expect(ack['__proto__']).toBe(2)
    expect(acknowledgeAttention(ack, 'bad', NaN)).toBe(ack)
  })
})
