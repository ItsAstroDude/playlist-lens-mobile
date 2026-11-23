/**
 * App-wide on-brand dialogs + toasts — the drop-in replacement for the stock OS
 * `Alert.alert` (v1.6 polish). Same tiny pub/sub pattern as overlayEvents: any
 * screen calls `showDialog()` / `showToast()`, and the root-mounted DialogHost
 * renders them above the whole navigator in the Liquid Lens look.
 *
 * Dialogs queue FIFO — a second request while one is open waits its turn instead
 * of clobbering the first. Toasts replace each other (newest wins).
 */

import type { IconName } from '@/components/ui/Icon'

export interface DialogOptions {
  title:         string
  message:       string
  glyph?:        IconName
  /** Primary button label. Defaults to "OK". */
  confirmLabel?: string
  /** Secondary button label. Omit (or pass null) for a single-button info dialog. */
  cancelLabel?:  string | null
  destructive?:  boolean
  /** Optional middle choice (e.g. "Keep tracking"). Cancel, backdrop and back still mean cancel. */
  altLabel?:     string
  onConfirm?:    () => void
  onCancel?:     () => void
  onAlt?:        () => void
}

export interface ToastOptions {
  message: string
  glyph?:  IconName
  /** How long it stays up, ms. Defaults to 2600. */
  duration?: number
}

type DialogCb = (d: DialogOptions | null) => void
type ToastCb  = (t: ToastOptions) => void

const dialogSubs: DialogCb[] = []
const toastSubs:  ToastCb[]  = []

let queue: DialogOptions[] = []

function publish(): void {
  const head = queue[0] ?? null
  dialogSubs.forEach(c => c(head))
}

/** Show an on-brand dialog. Queued behind any dialog that's already open. */
export function showDialog(opts: DialogOptions): void {
  queue.push(opts)
  if (queue.length === 1) publish()
}

/** Convenience: a two-button confirm (Cancel + confirmLabel) that runs `onConfirm`. */
export function confirmDialog(opts: Omit<DialogOptions, 'cancelLabel'> & { cancelLabel?: string }): void {
  showDialog({ cancelLabel: 'Cancel', ...opts })
}

/**
 * Resolve the open dialog. Called by the host — runs the matching callback AFTER
 * the dialog leaves the queue, so a callback that opens another dialog works.
 */
export function resolveDialog(choice: boolean | 'alt'): void {
  const head = queue.shift()
  publish()
  if (!head) return
  if (choice === 'alt') head.onAlt?.()
  else if (choice) head.onConfirm?.()
  else head.onCancel?.()
}

export function onDialog(cb: DialogCb): () => void {
  dialogSubs.push(cb)
  cb(queue[0] ?? null)   // late subscriber catches up with whatever is open
  return () => { const i = dialogSubs.indexOf(cb); if (i >= 0) dialogSubs.splice(i, 1) }
}

/** Show a brief, non-blocking confirmation pill. */
export function showToast(message: string, glyph?: IconName, duration?: number): void {
  const t: ToastOptions = { message, glyph, duration }
  // A screen can take toasts over (Lenses: they drop out of the header's cover button).
  if (toastSink) { toastSink(t); return }
  toastSubs.forEach(c => c(t))
}

/**
 * While set, toasts go here instead of the top pill (the drop card on Lenses claims them
 * while that screen is in front). Returns a release function; only the current claimer
 * releases.
 */
let toastSink: ToastCb | null = null
export function claimToasts(cb: ToastCb): () => void {
  toastSink = cb
  return () => { if (toastSink === cb) toastSink = null }
}

export function onToast(cb: ToastCb): () => void {
  toastSubs.push(cb)
  return () => { const i = toastSubs.indexOf(cb); if (i >= 0) toastSubs.splice(i, 1) }
}

/** Test-only: drop any queued dialogs. */
export function _resetDialogs(): void { queue = []; publish() }
