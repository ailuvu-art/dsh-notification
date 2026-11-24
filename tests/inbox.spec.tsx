// @vitest-environment jsdom
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AttentionInbox, type AttentionInboxProps } from '../src/client/AttentionInbox.tsx'
import { en, fmt, type NotificationKey } from '../src/client/locales.ts'

globalThis.IS_REACT_ACT_ENVIRONMENT = false
const t = (key: NotificationKey, params?: Record<string, string>) => fmt(en[key], params)
let root: Root
let container: HTMLDivElement
let previousFocus: HTMLElement | null
const entries = [{ sessionId: 's1', turn: 7, title: 'Fix build', reason: 'error' as const, endedAt: 1234, message: 'Build failed', code: 'BUILD' }]
function mount(overrides: Partial<AttentionInboxProps> = {}) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const props = { wide: true, entries, acknowledge: vi.fn(), openSession: vi.fn(), t, ...overrides }
  flushSync(() => root.render(<AttentionInbox {...props} />))
  return props
}
function button(text: string) {
  return Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(text))!
}
function click(element: HTMLElement) { flushSync(() => element.click()) }
function show() { const trigger = container.querySelector('button')!; trigger.focus(); click(trigger) }
function dialog() { return container.querySelector('dialog')! }
beforeEach(() => {
  // jsdom has no modal top layer. Mock the browser's native focus/close contract,
  // rather than adding a second focus trap to the component.
  if (!HTMLDialogElement.prototype.showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, writable: true, value() {} })
  if (!HTMLDialogElement.prototype.close) Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, writable: true, value() {} })
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
    previousFocus = document.activeElement as HTMLElement
    this.open = true
    this.querySelector<HTMLElement>('button')?.focus()
  })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
    previousFocus?.focus()
  })
})
afterEach(() => { root?.unmount(); container?.remove(); vi.restoreAllMocks() })

describe('AttentionInbox', () => {
  it('opens a native labelled dialog and navigating never acknowledges', () => {
    const props = mount()
    show()
    expect(dialog().open).toBe(true)
    expect(document.activeElement).toBe(button('Close'))
    expect(document.getElementById(dialog().getAttribute('aria-labelledby')!)?.textContent).toBe('Needs attention')
    expect(dialog().textContent).toContain('BUILD')
    expect(dialog().textContent).toContain('Build failed')
    click(button('Fix build'))
    expect(props.openSession).toHaveBeenCalledWith('s1')
    expect(props.acknowledge).not.toHaveBeenCalled()
    expect(dialog().open).toBe(false)
    expect(document.activeElement).toBe(container.querySelector('button'))
  })
  it('marks the exact turn reviewed with the separate action', () => {
    const props = mount()
    show()
    click(button('Mark reviewed'))
    expect(props.acknowledge).toHaveBeenCalledWith('s1', 7)
    expect(props.openSession).not.toHaveBeenCalled()
    expect(dialog().open).toBe(true)
  })
  it('announces review removal and restores focus to a remaining control', () => {
    const props = mount()
    show()
    button('Mark reviewed').focus()
    click(button('Mark reviewed'))
    flushSync(() => root.render(<AttentionInbox {...props} entries={[]} />))
    expect(document.activeElement).toBe(button('Close'))
    expect(dialog().querySelector('[role="status"]')?.textContent).toContain(en['attention.reviewed'])
  })
  it('reports review persistence failure without navigating or clearing', () => {
    const props = mount({ acknowledge: vi.fn(() => false) })
    show()
    click(button('Mark reviewed'))
    expect(dialog().querySelector('[role="alert"]')?.textContent).toBe(en['attention.reviewFailed'])
    expect(dialog().textContent).toContain('Fix build')
    expect(props.openSession).not.toHaveBeenCalled()
  })
  it('keeps a compact zero-count trigger and displays an empty state', () => {
    mount({ entries: [], wide: false })
    expect(container.querySelector('button')?.textContent).toBe('0')
    show()
    expect(dialog().textContent).toContain('No tasks need attention.')
  })
  it('closes without acknowledging and permits native Escape cancellation', () => {
    const props = mount()
    show()
    click(button('Close'))
    expect(dialog().open).toBe(false)
    show()
    const cancel = new Event('cancel', { cancelable: true })
    expect(dialog().dispatchEvent(cancel)).toBe(true)
    // Browser default action for uncancelled Escape.
    dialog().close()
    expect(document.activeElement).toBe(container.querySelector('button'))
    expect(props.acknowledge).not.toHaveBeenCalled()
  })
  it('retains an entry and shows localized feedback if navigation throws', () => {
    const props = mount({ openSession: () => { throw new Error('gone') } })
    show()
    click(button('Fix build'))
    expect(dialog().open).toBe(true)
    expect(dialog().querySelector('[role="alert"]')?.textContent).toBe(en['attention.openFailed'])
    expect(props.acknowledge).not.toHaveBeenCalled()
  })
  it('shows feedback outside the dialog if showModal fails', () => {
    mount()
    vi.mocked(HTMLDialogElement.prototype.showModal).mockImplementation(() => { throw new Error('unsupported') })
    show()
    expect(container.querySelector(':scope > [role="alert"]')?.textContent).toBe(en['attention.openFailed'])
  })
  it('preserves supplied order, provides fallback titles and guards invalid dates', () => {
    mount({ entries: [{ ...entries[0], sessionId: 'new', title: '', endedAt: NaN }, { ...entries[0], sessionId: 'old' }] })
    show()
    expect(Array.from(dialog().querySelectorAll('li')).map(item => item.querySelector('button')?.textContent)).toEqual(['Session new', 'Fix build'])
    expect(dialog().textContent).toContain('Unknown time')
  })
})
