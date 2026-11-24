import { useEffect, useId, useRef, useState } from 'react'

export interface AttentionInboxEntry {
  sessionId: string
  title: string
  reason: 'error' | 'interrupted'
  endedAt: number
  message: string
  code?: string
  turn: number
}

export interface AttentionInboxProps {
  wide: boolean
  /** All workspaces, already sorted newest first. */
  entries: readonly AttentionInboxEntry[]
  acknowledge(id: string, turn?: number): boolean | void
  openSession(id: string): void
  t: (key: any, params?: any) => string
}

/** Presentation only: reviewing and navigating are deliberately separate actions. */
export function AttentionInbox({ wide, entries, acknowledge, openSession, t }: AttentionInboxProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const [feedback, setFeedback] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const reviewed = useRef<string | null>(null)
  useEffect(() => {
    if (reviewed.current === null || !dialog.current?.open) return
    if (entries.some(entry => `${entry.sessionId}:${entry.turn}` === reviewed.current)) return
    reviewed.current = null
    ;(dialog.current.querySelector<HTMLButtonElement>('.dsh_notification_attentionSession') ?? dialog.current.querySelector<HTMLButtonElement>('.dsh_notification_attentionButton'))?.focus()
  }, [entries])
  const review = (entry: AttentionInboxEntry) => {
    reviewed.current = `${entry.sessionId}:${entry.turn}`
    try {
      if (acknowledge(entry.sessionId, entry.turn) === false) {
        setFeedback(t('attention.reviewFailed'))
        return
      }
      setAnnouncement(`${t('attention.reviewed')} ${entry.title.trim() || t('attention.sessionFallback', { id: entry.sessionId })}`)
    } catch { setFeedback(t('attention.reviewFailed')) }
  }
  const close = () => dialog.current?.close()
  const show = () => {
    setFeedback('')
    try {
      dialog.current?.showModal()
    } catch {
      setFeedback(t('attention.openFailed'))
    }
  }
  const open = (id: string) => {
    try {
      openSession(id)
      close()
    } catch {
      setFeedback(t('attention.openFailed'))
    }
  }
  const timestamp = (value: number) => {
    const date = new Date(value)
    if (value <= 0 || !Number.isFinite(date.getTime())) return t('attention.unknownTime')
    try { return date.toLocaleString() } catch { return t('attention.unknownTime') }
  }

  return <>
    <button type="button" className="dsh_notification_attentionTrigger" onClick={show}
      title={t('attention.trigger', { count: String(entries.length) })} aria-label={t('attention.trigger', { count: String(entries.length) })} aria-haspopup="dialog">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 3 2 21h20L12 3Z" strokeLinejoin="round" />
        <path d="M12 9v5m0 3v1" />
      </svg>
      {wide && <span className="dsh_notification_attentionLabel">{t('attention.title')}</span>}
      <span className="dsh_notification_attentionCount" aria-hidden="true">{entries.length}</span>
    </button>
    {feedback && !dialog.current?.open && <p className="dsh_notification_attentionFeedback" role="alert">{feedback}</p>}
    <dialog ref={dialog} className="dsh_notification_attentionDialog" aria-labelledby={headingId}>
      <header className="dsh_notification_attentionHeader">
        <h2 id={headingId}>{t('attention.title')}</h2>
        <button type="button" className="dsh_notification_attentionButton" onClick={close} autoFocus>{t('attention.close')}</button>
      </header>
      <p className="dsh_notification_attentionDescription">{t('attention.description')}</p>
      <p className="dsh_notification_attentionDescription" role="status">{announcement}</p>
      {feedback && <p className="dsh_notification_attentionFeedback" role="alert">{feedback}</p>}
      {entries.length === 0 ? <p className="dsh_notification_attentionEmpty">{t('attention.empty')}</p> :
        <ul className="dsh_notification_attentionList">{entries.map(entry => <li key={`${entry.sessionId}:${entry.turn}`} className="dsh_notification_attentionEntry">
          <button type="button" className="dsh_notification_attentionSession" onClick={() => open(entry.sessionId)}>{entry.title.trim() || t('attention.sessionFallback', { id: entry.sessionId })}</button>
          <div className="dsh_notification_attentionMeta"><span>{t(`attention.reason.${entry.reason}`)}</span><span>{timestamp(entry.endedAt)}</span></div>
          {entry.code && <code className="dsh_notification_attentionCode">{entry.code}</code>}
          <p className="dsh_notification_attentionMessage">{entry.reason === 'interrupted' ? t('attention.interruptedMessage') : entry.message || t('attention.noMessage')}</p>
          <button type="button" className="dsh_notification_attentionButton" onClick={() => review(entry)}>{t('attention.review')}</button>
        </li>)}</ul>}
    </dialog>
  </>
}
