/** Pure reconciliation of host-owned failure state. Only acknowledgements persist. */
import type { NotificationAttention, NotificationProjectionValue } from '../contract.ts';
export interface AttentionRow {
    readonly sessionId: string;
    readonly origin?: string;
    readonly projectionValues?: {
        readonly notification?: NotificationProjectionValue;
    };
}
export type AttentionAcknowledgements = Readonly<Record<string, number>>;
export interface SessionAttention extends NotificationAttention {
    readonly sessionId: string;
}
/** Sanitize untrusted local snapshot data without keeping host-derived state. */
export declare function parseAttentionAcknowledgements(value: unknown): AttentionAcknowledgements;
/** Derive visible failures from the current rows, including historical/reloaded rows. */
export declare function reconcileAttention(rows: readonly AttentionRow[], acknowledgements: AttentionAcknowledgements): readonly SessionAttention[];
/** Acknowledge one exact turn; later failures remain eligible. Never mutate input. */
export declare function acknowledgeAttention(acknowledgements: AttentionAcknowledgements, sessionId: string, turn: number): AttentionAcknowledgements;
