/** Pure reconciliation of host-owned failure state. Only acknowledgements persist. */
import type { NotificationAttention, NotificationProjectionValue } from '../contract.ts'

export interface AttentionRow {
  readonly sessionId: string
  readonly origin?: string
  readonly projectionValues?: { readonly notification?: NotificationProjectionValue }
}

export type AttentionAcknowledgements = Readonly<Record<string, number>>
export interface SessionAttention extends NotificationAttention {
  readonly sessionId: string
}

/** Sanitize untrusted local snapshot data without keeping host-derived state. */
export function parseAttentionAcknowledgements(value: unknown): AttentionAcknowledgements {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, turn]) =>
    typeof turn === 'number' && Number.isSafeInteger(turn) && turn >= 0))
}

/** Derive visible failures from the current rows, including historical/reloaded rows. */
export function reconcileAttention(
  rows: readonly AttentionRow[],
  acknowledgements: AttentionAcknowledgements,
): readonly SessionAttention[] {
  return rows.flatMap(row => {
    if (row.origin === 'subagent') return []
    const value = row.projectionValues?.notification
    // Old hosts have no retained attention; their last failure is still useful.
    const attention: NotificationAttention | null | undefined = value?.attention === undefined
      ? value && (value.reason === 'error' || value.reason === 'interrupted')
        ? { turn: value.turn, reason: value.reason, endedAt: value.endedAt ?? 0,
            message: value.message ?? value.body, ...(value.code === undefined ? {} : { code: value.code }) }
        : null
      : value.attention
    const acknowledged = Object.hasOwn(acknowledgements, row.sessionId) ? acknowledgements[row.sessionId]! : -1
    if (!attention || attention.turn <= acknowledged) return []
    return [{ sessionId: row.sessionId, ...attention }]
  })
}

/** Acknowledge one exact turn; later failures remain eligible. Never mutate input. */
export function acknowledgeAttention(
  acknowledgements: AttentionAcknowledgements,
  sessionId: string,
  turn: number,
): AttentionAcknowledgements {
  if (!Number.isSafeInteger(turn) || turn < 0) return acknowledgements
  const previous = Object.hasOwn(acknowledgements, sessionId) ? acknowledgements[sessionId]! : -1
  if (previous >= turn) return acknowledgements
  return { ...acknowledgements, [sessionId]: turn }
}
