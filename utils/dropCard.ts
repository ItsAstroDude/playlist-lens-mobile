import type { IconName } from '@/components/ui/Icon'

/**
 * The drop card's news (components/nowplaying/DropCard): what it says when something
 * happens (a toast, a new song), and the "lately" list it shows when opened. Session
 * only; pure and tested.
 */
export interface DropNews {
  id: number
  kind: 'toast' | 'song'
  title: string
  /** Second line (the song's artist, a toast's detail). */
  sub?: string
  glyph?: IconName
  /** Cover art for song news. */
  art?: string | null
  at: number
}

export const LATELY_MAX = 4

let seq = 0
let lately: DropNews[] = []
let current: DropNews | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach(cb => cb())

/** Say something: it becomes the current news and leads the lately list. */
export function pushNews(n: Omit<DropNews, 'id' | 'at'>, now = Date.now()): DropNews {
  const item: DropNews = { ...n, id: ++seq, at: now }
  current = item
  // The same song twice in a row (a re-poll) isn't news twice.
  const head = lately[0]
  if (!(head && head.kind === item.kind && head.title === item.title && head.sub === item.sub)) {
    lately = [item, ...lately].slice(0, LATELY_MAX)
  }
  emit()
  return item
}

/** The news has been shown; the card goes back into the button. */
export function clearNews(id?: number): void {
  if (!current || (id !== undefined && current.id !== id)) return
  current = null
  emit()
}

export function currentNews(): DropNews | null { return current }
export function latelyNews(): DropNews[] { return lately }

export function onDropNews(cb: () => void): () => void {
  subs.add(cb)
  return () => { subs.delete(cb) }
}

/** "now", "4 min", "2 h" — how long ago, for the lately list. */
export function agoLabel(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.round(m / 60)} h`
}

/** Test-only. */
export function _resetDropNews(): void { lately = []; current = null; seq = 0; emit() }
