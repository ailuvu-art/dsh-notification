/** Minimal sessions face; old hosts may not expose exact projection reads. */
export interface AttentionRefreshSessions<Id extends string = string> {
  readonly list: {
    getSnapshot(): {
      readonly ids: readonly Id[]
      readonly byId: Readonly<Partial<Record<Id, {
        readonly origin?: string
        readonly projectionValues?: {
          readonly notification?: { readonly attention?: unknown }
        }
      }>>>
    }
    subscribe(listener: () => void): () => void
  }
  refreshProjections?(id: Id): Promise<void>
}

/**
 * Hydrate cold catalog rows without retaining/opening their conversations.
 * Each eligible identity gets one attempt per lifecycle, including failures and
 * old-wire responses. Recreate after a connection reset to allow another pass.
 *
 * The host API caches ready exact reads: this cannot force a ready old-wire
 * value to recompute. A new host/manager generation must invalidate that cache.
 */
export function startAttentionRefresh<Id extends string>(sessions: AttentionRefreshSessions<Id>): () => void {
  const refresh = sessions.refreshProjections
  if (typeof refresh !== 'function') return () => {}
  const attempted = new Set<Id>()
  const queued = new Set<Id>()
  let active = 0
  let disposed = false

  const missingAttention = (id: Id): boolean => {
    const row = sessions.list.getSnapshot().byId[id]
    return row !== undefined && row.origin !== 'subagent'
      && row.projectionValues?.notification?.attention === undefined
  }

  const drain = (): void => {
    while (!disposed && active < 4 && queued.size > 0) {
      const id = queued.values().next().value!
      queued.delete(id)
      if (!missingAttention(id)) continue
      // Record before calling: refresh can synchronously publish list changes.
      attempted.add(id)
      active++
      let result: Promise<void>
      try {
        result = refresh.call(sessions, id)
      } catch {
        active--
        continue
      }
      void Promise.resolve(result).catch(() => {}).finally(() => {
        active--
        drain()
      })
    }
  }
  const scan = (): void => {
    if (disposed) return
    for (const id of sessions.list.getSnapshot().ids) {
      if (!attempted.has(id) && missingAttention(id)) queued.add(id)
    }
    drain()
  }
  const unsubscribe = sessions.list.subscribe(scan)
  scan()
  return () => {
    if (disposed) return
    disposed = true
    queued.clear()
    unsubscribe()
  }
}
