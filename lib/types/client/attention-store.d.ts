import { type AttentionAcknowledgements } from './attention.ts';
export declare const ATTENTION_STORAGE_KEY = "dsh-notification.attention.v1";
/** Only acknowledgements are browser-local; failures are reconstructed from Host projections. */
export declare function loadAcknowledgements(storage?: Pick<Storage, 'getItem'>): AttentionAcknowledgements;
export declare function createAttentionStore(storage?: Pick<Storage, 'getItem' | 'setItem'>): {
    getSnapshot: () => Readonly<Record<string, number>>;
    subscribe: (fn: () => void) => () => void;
    sync(): void;
    acknowledge(sessionId: string, turn: number): boolean;
};
