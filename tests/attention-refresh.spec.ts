import { describe, expect, it } from 'vitest'
import { startAttentionRefresh } from '../src/client/attention-refresh.ts'

interface Row {
  origin?: string
  projectionValues?: { notification?: { attention?: unknown } }
}
function harness(rows: Record<string, Row>, refresh?: (id: string) => Promise<void>) {
  let state = { ids: Object.keys(rows), byId: rows }
  const listeners = new Set<() => void>()
  return {
    sessions: {
      list: {
        getSnapshot: () => state,
        subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
      },
      ...(refresh ? { refreshProjections: refresh } : {}),
    },
    update(next: Record<string, Row>) { state = { ids: Object.keys(next), byId: next }; listeners.forEach(fn => fn()) },
    listeners,
  }
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve() }

describe('startAttentionRefresh', () => {
  it('seeds absent and old-wire projections, but not current null or subagents', async () => {
    const calls: string[] = []
    const h = harness({ absent: {}, old: { projectionValues: { notification: {} } },
      current: { projectionValues: { notification: { attention: null } } },
      failure: { projectionValues: { notification: { attention: { turn: 1 } } } },
      child: { origin: 'subagent' } }, async id => { calls.push(id) })
    const stop = startAttentionRefresh(h.sessions)
    await settle()
    expect(calls).toEqual(['absent', 'old'])
    stop()
  })

  it('does not loop on stale results or synchronous list subscriber updates', async () => {
    const calls: string[] = []
    const h = harness({ stale: {} }, async id => { calls.push(id); h.update({ stale: {} }) })
    const stop = startAttentionRefresh(h.sessions)
    await settle()
    h.update({ stale: {}, added: {} })
    await settle()
    expect(calls).toEqual(['stale', 'added'])
    stop()
  })

  it('limits concurrency to four and drains the queue after reads settle', async () => {
    const calls: string[] = []
    const pending: Array<() => void> = []
    let active = 0
    let peak = 0
    const h = harness(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i), {}])), id => {
      calls.push(id); peak = Math.max(peak, ++active)
      return new Promise<void>(resolve => pending.push(() => { active--; resolve() }))
    })
    const stop = startAttentionRefresh(h.sessions)
    expect(calls).toHaveLength(4)
    while (pending.length) { pending.splice(0).forEach(done => done()); await settle() }
    expect(calls).toHaveLength(9)
    expect(peak).toBe(4)
    stop()
  })

  it('rechecks queued rows when another source hydrates or removes them', async () => {
    const calls: string[] = []
    const pending: Array<() => void> = []
    const h = harness(Object.fromEntries(Array.from({ length: 6 }, (_, i) => [String(i), {}])), id => {
      calls.push(id); return new Promise<void>(resolve => pending.push(resolve))
    })
    const stop = startAttentionRefresh(h.sessions)
    h.update({ '0': {}, '1': {}, '2': {}, '3': {}, '4': { projectionValues: { notification: { attention: null } } } })
    pending.forEach(done => done())
    await settle()
    expect(calls).toEqual(['0', '1', '2', '3'])
    stop()
  })

  it('disposes subscriptions and prevents queued or subsequent reads', async () => {
    const calls: string[] = []
    const pending: Array<() => void> = []
    const h = harness(Object.fromEntries(Array.from({ length: 6 }, (_, i) => [String(i), {}])), id => {
      calls.push(id); return new Promise<void>(resolve => pending.push(resolve))
    })
    const stop = startAttentionRefresh(h.sessions)
    stop(); stop()
    expect(h.listeners.size).toBe(0)
    pending.forEach(done => done())
    h.update({ later: {} })
    await settle()
    expect(calls).toHaveLength(4)
  })

  it('swallows rejections and synchronous throws, retries only when recreated', async () => {
    const calls: string[] = []
    const h = harness({ throwing: {}, rejecting: {}, ok: {} }, id => {
      calls.push(id)
      if (id === 'throwing') throw new Error('sync')
      return id === 'rejecting' ? Promise.reject(new Error('async')) : Promise.resolve()
    })
    const stop = startAttentionRefresh(h.sessions)
    await settle()
    h.update({ throwing: {}, rejecting: {}, ok: {} })
    await settle()
    expect(calls).toEqual(['throwing', 'rejecting', 'ok'])
    stop()
    const stopAgain = startAttentionRefresh(h.sessions)
    await settle()
    expect(calls).toHaveLength(6)
    stopAgain()
  })

  it('is harmless on hosts without the refresh API', () => {
    const h = harness({ old: {} })
    const stop = startAttentionRefresh(h.sessions)
    h.update({ newer: {} })
    stop()
    expect(h.listeners.size).toBe(0)
  })
})
