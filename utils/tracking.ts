/**
 * Listening tracking — app side of the server tracker (v1.8, web repo tracking.py).
 *
 * The server saves every enrolled user's plays hourly (Spotify forgets anything
 * past the last 50). The app opts in/out and syncs those saved plays into the
 * local play buffer, so recaps — and the Wrapped revamp — see every play, not
 * just what happened to be in the 50-play window when the app was opened.
 */
import * as SecureStore from 'expo-secure-store'
import { api } from '@/utils/api'
import { storage, SecureKeys } from '@/utils/cache'
import { appendToBuffer, loadBuffer, saveBuffer } from '@/utils/recents'
import type { StreamRow } from '@/utils/wrapped'

const ENROLLED_KEY = 'tracking_enrolled'
const CURSOR_KEY   = 'tracking_cursor'      // newest played_at already synced
const LAST_SYNC_KEY = 'tracking_last_sync'
const TAIL_KEY      = 'tracking_tail'        // newest synced play, re-estimated next sync

export interface TrackingStatus {
  available: boolean
  enrolled:  boolean
  status?:   'active' | 'paused' | 'error'
  enrolled_at?:    string
  last_polled_at?: string | null
  plays?:      number
  first_play?: string | null
  last_play?:  string | null
  gaps?:       number
}

export interface TrackedPlay {
  played_at:   string
  uri:         string | null
  name:        string | null
  artists:     string[]
  album:       string | null
  image:       string | null
  duration_ms: number | null
}

// ─── Local flags ────────────────────────────────────────────────────────────
export function trackingEnrolled(): boolean { return storage.getBoolean(ENROLLED_KEY) ?? false }
function setEnrolled(v: boolean): void { v ? storage.set(ENROLLED_KEY, true) : storage.remove(ENROLLED_KEY) }
export function lastTrackingSync(): number { return storage.getNumber(LAST_SYNC_KEY) ?? 0 }

// ─── Listen-time estimate ───────────────────────────────────────────────────
const MIN_LISTEN = 30_000          // Spotify only logs a play after ~30s
const SESSION_BREAK = 10 * 60_000  // a gap this much longer than the track = they stopped

/**
 * Spotify's history has no listen duration, so counting full track length makes
 * every skip look like a full listen. Estimate it from the gap to the NEXT play:
 * a track skipped after 40s is followed by a play ~40s later. Capped at the track
 * length, floored at 30s; the last play (or one followed by a long pause) counts
 * as the full track. Input must be sorted oldest → newest.
 */
export function estimateListenMs(plays: Pick<TrackedPlay, 'played_at' | 'duration_ms'>[]): number[] {
  return plays.map((p, i) => {
    const dur = p.duration_ms ?? 0
    const next = plays[i + 1]
    if (!dur) return 0
    if (!next) return dur
    const gap = Date.parse(next.played_at) - Date.parse(p.played_at)
    if (!Number.isFinite(gap) || gap <= 0 || gap > dur + SESSION_BREAK) return dur
    return Math.max(MIN_LISTEN, Math.min(dur, gap))
  })
}

/** Server plays → the buffer's row shape (same as the Spotify export's). */
export function toStreamRows(plays: TrackedPlay[]): StreamRow[] {
  const ms = estimateListenMs(plays)
  return plays.map((p, i) => ({
    ts:        p.played_at,
    ms_played: ms[i],
    master_metadata_track_name:        p.name,
    master_metadata_album_artist_name: p.artists?.[0] ?? null,
    master_metadata_album_album_name:  p.album,
    spotify_track_uri:                 p.uri,
  }))
}

// ─── Server calls ───────────────────────────────────────────────────────────
export async function fetchTrackingStatus(): Promise<TrackingStatus> {
  const s = await api.get<TrackingStatus>('/api/tracking/status')
  // Keep the local flag honest (e.g. after a reinstall, or opting out on another device).
  if (s.available) setEnrolled(!!s.enrolled)
  return s
}

/** Opt in: hand the server our refresh token (stored encrypted there) + first sync. */
export async function enrollTracking(): Promise<{ backfilled: number; synced: number }> {
  const rt = await SecureStore.getItemAsync(SecureKeys.refreshToken)
  if (!rt) throw new Error('No Spotify session — log in again first.')
  const res = await api.post<{ enrolled: boolean; backfilled: number; refresh_token?: string | null }>(
    '/api/tracking/enroll', { refresh_token: rt },
  )
  // Spotify may rotate the token on the server's exchange — keep the newest one.
  if (res.refresh_token) await SecureStore.setItemAsync(SecureKeys.refreshToken, res.refresh_token)
  setEnrolled(true)
  const synced = await syncTrackedPlays()
  return { backfilled: res.backfilled, synced }
}

/** Opt out: the server deletes the token AND every saved play. Local stats stay. */
export async function unenrollTracking(): Promise<void> {
  await api.delete('/api/tracking')
  setEnrolled(false)
  storage.remove(CURSOR_KEY)
  storage.remove(TAIL_KEY)
}

function loadTail(): TrackedPlay | null {
  const raw = storage.getString(TAIL_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as TrackedPlay } catch { return null }
}

/**
 * Pull every play the server saved since our cursor into the local buffer.
 * A play's listen-time estimate needs its successor, so the newest synced play
 * (the "tail", counted as a full listen for now) is re-estimated together with
 * the next batch and overwritten in the buffer.
 */
export async function syncTrackedPlays(): Promise<number> {
  let cursor = storage.getString(CURSOR_KEY) ?? ''
  let tail = loadTail()
  let total = 0
  for (let page = 0; page < 20; page++) {          // 20 × 5000 plays — far beyond a real backlog
    const q = cursor ? `?after=${encodeURIComponent(cursor)}` : ''
    const res = await api.get<{ items: TrackedPlay[]; more: boolean }>(`/api/tracking/plays${q}`)
    const items = res.items ?? []
    if (!items.length) break
    const batch = tail ? [tail, ...items] : items
    saveBuffer(appendToBuffer(loadBuffer(), toStreamRows(batch), { replace: true }))
    total += items.length
    tail = items[items.length - 1]
    cursor = tail.played_at
    storage.set(CURSOR_KEY, cursor)
    storage.set(TAIL_KEY, JSON.stringify(tail))
    if (!res.more) break
  }
  storage.set(LAST_SYNC_KEY, Date.now())
  return total
}
