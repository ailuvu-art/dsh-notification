import { describe, expect, it } from 'vitest'
import { ATTENTION_STORAGE_KEY, createAttentionStore, loadAcknowledgements } from '../src/client/attention-store.ts'

describe('attention acknowledgements', () => {
  it('validates persisted values and survives malformed storage', () => {
    expect(loadAcknowledgements({ getItem: () => '{broken' })).toEqual({})
    expect(loadAcknowledgements({ getItem: () => '[1]' })).toEqual({})
    expect(loadAcknowledgements({ getItem: () => '{"ok":2,"bad":"3","neg":-1}' })).toEqual({ ok: 2 })
  })
  it('persists reviewed turn across reload without hiding later failures', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    const store = createAttentionStore(storage)
    store.acknowledge('session', 3)
    store.acknowledge('session', 2)
    expect(createAttentionStore(storage).getSnapshot()).toEqual({ session: 3 })
    expect(values.has(ATTENTION_STORAGE_KEY)).toBe(true)
  })
  it('merges reviews from separate tabs before saving and on storage sync', () => {
    let value: string | null = null
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next } }
    const a = createAttentionStore(storage)
    const b = createAttentionStore(storage)
    expect(a.acknowledge('x', 3)).toBe(true)
    b.acknowledge('y', 2)
    b.acknowledge('x', 1)
    a.sync()
    expect(a.getSnapshot()).toEqual({ x: 3, y: 2 })
    expect(createAttentionStore(storage).getSnapshot()).toEqual({ x: 3, y: 2 })
  })
  it('retains attention when browser storage is unavailable', () => {
    const store = createAttentionStore()
    expect(store.acknowledge('session', 1)).toBe(false)
    expect(store.getSnapshot()).toEqual({})
  })
  it('does not publish a review when persistence throws', () => {
    const store = createAttentionStore({ getItem: () => null, setItem: () => { throw new Error('quota') } })
    expect(store.acknowledge('session', 3)).toBe(false)
    expect(store.getSnapshot()).toEqual({})
  })
})
