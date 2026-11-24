import { createSnapshotStore } from './snapshot-store.ts'
import { acknowledgeAttention, parseAttentionAcknowledgements, type AttentionAcknowledgements } from './attention.ts'

export const ATTENTION_STORAGE_KEY = 'dsh-notification.attention.v1'

/** Only acknowledgements are browser-local; failures are reconstructed from Host projections. */
export function loadAcknowledgements(storage?: Pick<Storage, 'getItem'>): AttentionAcknowledgements {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(ATTENTION_STORAGE_KEY) ?? '{}')
    return parseAttentionAcknowledgements(raw)
  } catch { return {} }
}

export function createAttentionStore(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  const store = createSnapshotStore<AttentionAcknowledgements>(loadAcknowledgements(storage))
  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    sync(): void {
      const merged = { ...store.getSnapshot() }
      for (const [id, turn] of Object.entries(loadAcknowledgements(storage))) {
        Object.defineProperty(merged, id, { value: Math.max(Object.hasOwn(merged, id) ? merged[id]! : -1, turn), enumerable: true, configurable: true, writable: true })
      }
      store.set(merged)
    },
    acknowledge(sessionId: string, turn: number): boolean {
      const merged = { ...store.getSnapshot() }
      for (const [id, saved] of Object.entries(loadAcknowledgements(storage))) {
        Object.defineProperty(merged, id, { value: Math.max(Object.hasOwn(merged, id) ? merged[id]! : -1, saved), enumerable: true, configurable: true, writable: true })
      }
      const next = acknowledgeAttention(merged, sessionId, turn)
      try {
        if (!storage) return false
        storage.setItem(ATTENTION_STORAGE_KEY, JSON.stringify(next))
        store.set(next)
        return true
      } catch { return false }
    },
  }
}
