/**
 * App-wide on-brand dialogs + toasts — the drop-in replacement for the stock OS
 * `Alert.alert` (v1.6 polish). Same tiny pub/sub pattern as overlayEvents: any
 * screen calls `showDialog()` / `showToast()`, and the root-mounted DialogHost
 * renders them above the whole navigator in the Liquid Lens look.
 *
 * Dialogs queue FIFO — a second request while one is open waits its turn instead
 * of clobbering the first. Toasts replace each other (newest wins).
 */

export interface DialogOptions {
  title:         string
  message:       string
  glyph?:        string
  /** Primary button label. Defaults to "OK". */
  confirmLabel?: string
  /** Secondary button label. Omit (or pass null) for a single-button info dialog. */
  cancelLabel?:  string | null
  destructive?:  boolean
  onConfirm?:    () => void
  onCancel?:     () => void
}

export interface ToastOptions {
  message: string
  glyph?:  string
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
export function resolveDialog(confirmed: boolean): void {
  const head = queue.shift()
  publish()
  if (!head) return
  if (confirmed) head.onConfirm?.()
  else head.onCancel?.()
}

export function onDialog(cb: DialogCb): () => void {
  dialogSubs.push(cb)
  cb(queue[0] ?? null)   // late subscriber catches up with whatever is open
  return () => { const i = dialogSubs.indexOf(cb); if (i >= 0) dialogSubs.splice(i, 1) }
}

/** Show a brief, non-blocking confirmation pill. */
export function showToast(message: string, glyph?: string, duration?: number): void {
  const t: ToastOptions = { message, glyph, duration }
  toastSubs.forEach(c => c(t))
}

export function onToast(cb: ToastCb): () => void {
  toastSubs.push(cb)
  return () => { const i = toastSubs.indexOf(cb); if (i >= 0) toastSubs.splice(i, 1) }
}

/** Test-only: drop any queued dialogs. */
export function _resetDialogs(): void { queue = []; publish() }
