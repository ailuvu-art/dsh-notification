/** Minimal sessions face; old hosts may not expose exact projection reads. */
export interface AttentionRefreshSessions<Id extends string = string> {
    readonly list: {
        getSnapshot(): {
            readonly ids: readonly Id[];
            readonly byId: Readonly<Partial<Record<Id, {
                readonly origin?: string;
                readonly projectionValues?: {
                    readonly notification?: {
                        readonly attention?: unknown;
                    };
                };
            }>>>;
        };
        subscribe(listener: () => void): () => void;
    };
    refreshProjections?(id: Id): Promise<void>;
}
/**
 * Hydrate cold catalog rows without retaining/opening their conversations.
 * Each eligible identity gets one attempt per lifecycle, including failures and
 * old-wire responses. Recreate after a connection reset to allow another pass.
 *
 * The host API caches ready exact reads: this cannot force a ready old-wire
 * value to recompute. A new host/manager generation must invalidate that cache.
 */
export declare function startAttentionRefresh<Id extends string>(sessions: AttentionRefreshSessions<Id>): () => void;
