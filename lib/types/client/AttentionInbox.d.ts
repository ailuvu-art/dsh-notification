export interface AttentionInboxEntry {
    sessionId: string;
    title: string;
    reason: 'error' | 'interrupted';
    endedAt: number;
    message: string;
    code?: string;
    turn: number;
}
export interface AttentionInboxProps {
    wide: boolean;
    /** All workspaces, already sorted newest first. */
    entries: readonly AttentionInboxEntry[];
    acknowledge(id: string, turn?: number): boolean | void;
    openSession(id: string): void;
    t: (key: any, params?: any) => string;
}
/** Presentation only: reviewing and navigating are deliberately separate actions. */
export declare function AttentionInbox({ wide, entries, acknowledge, openSession, t }: AttentionInboxProps): import("react").JSX.Element;
