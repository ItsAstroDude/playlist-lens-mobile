import { api, ApiError } from '@/utils/api'

/**
 * Up next (the half-folded C+D layouts): what Spotify plays after the current song,
 * from GET /api/playback/upnext (playlist-lens-web; Spotify's /me/player/queue, trimmed).
 *
 * Spotify's API can add to the queue but not take anything out, so "drop" is ours: a
 * dropped song is skipped the moment it starts (watchDropped, while the app is open).
 * "Play now" skips ahead to it. Pure helpers are tested.
 */
export interface UpNextTrack {
  id: string | null
  uri: string | null
  name: string
  duration_ms: number | null
  artists: string[]
  image: string | null
}

export type UpNextResult =
  | { ok: true; current: UpNextTrack | null; queue: UpNextTrack[] }
  | { ok: false; reason: 'server' | 'error' }

/** The server route is new: an older server answers 404, which reads as "update the server". */
export async function fetchUpNext(limit = 10): Promise<UpNextResult> {
  try {
    const r = await api.get<{ current: UpNextTrack | null; queue: UpNextTrack[] }>(`/api/playback/upnext?limit=${limit}`)
    return { ok: true, current: r.current ?? null, queue: Array.isArray(r.queue) ? r.queue : [] }
  } catch (err) {
    return { ok: false, reason: err instanceof ApiError && err.status === 404 ? 'server' : 'error' }
  }
}

// ── dropped songs (session) ──
const dropped = new Set<string>()
const subs = new Set<() => void>()
const emit = () => subs.forEach(cb => cb())

export function dropSong(id: string | null): void { if (id && !dropped.has(id)) { dropped.add(id); emit() } }
export function isDropped(id: string | null | undefined): boolean { return !!id && dropped.has(id) }
/** Called once the dropped song has been skipped (it won't be skipped again if it comes back). */
export function forgetDropped(id: string): void { if (dropped.delete(id)) emit() }
export function onDropped(cb: () => void): () => void { subs.add(cb); return () => { subs.delete(cb) } }
export function _resetDropped(): void { dropped.clear(); emit() }

/**
 * The cards still to decide on: every queued song not yet kept or dropped this time
 * round (`seen`). Order is Spotify's. A song dropped in an earlier round comes back as
 * a card — marked dropped — so "look at the queue again" can undo it (2.0.40: before,
 * a drop took the song out of the deck and the count for good).
 */
export function deckCards(queue: UpNextTrack[], seen: ReadonlySet<string>): UpNextTrack[] {
  return queue.filter(t => !!t.id && !seen.has(t.id))
}

/** The queue as it will actually play (dropped songs left out). */
export function visibleQueue(queue: UpNextTrack[]): UpNextTrack[] {
  return queue.filter(t => !isDropped(t.id))
}

/**
 * When each song starts, in ms from now: the current song's remaining time plus every
 * song before it that will really play (dropped ones are skipped, so they take ~no time).
 */
export function startsIn(queue: UpNextTrack[], remainingMs: number): number[] {
  const out: number[] = []
  let t = Math.max(0, remainingMs)
  for (const s of queue) {
    out.push(t)
    if (!isDropped(s.id)) t += Math.max(0, s.duration_ms ?? 0)
  }
  return out
}

/** How many skips reach this song from the current one (Spotify plays the queue in order). */
export function skipsTo(queue: UpNextTrack[], id: string): number {
  const i = queue.findIndex(t => t.id === id)
  return i < 0 ? 0 : i + 1
}

/** "in 2:12", "next" — for the row and the card. */
export function inLabel(ms: number): string {
  if (ms < 15_000) return 'next'
  const s = Math.round(ms / 1000)
  return `in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
