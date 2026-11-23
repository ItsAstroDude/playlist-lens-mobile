import { AppState } from 'react-native'
import { api, ApiError } from '@/utils/api'
import { storage, deleteCache, CacheKeys } from '@/utils/cache'
import { setScopeStatus } from '@/utils/scopeStatus'
import { showToast } from '@/utils/dialog'

/**
 * The outbox (2.0.36, "instant like Instagram"): changes to your Spotify that the app
 * shows as done the moment you make them, then sends in the background — retrying with
 * growing waits, across restarts (saved in MMKV), until they land. Like a like on
 * Instagram: the heart is red at once; the server hears about it when it can.
 *
 * Only for things that can wait. Playback and the queue stay real-time (utils/playback).
 */
export type OutboxJob =
  | { kind: 'create'; name: string; uris: string[]; description: string }
  | { kind: 'trim'; playlistId: string; backupName: string; cutUris: string[]; backedUp?: boolean }

interface Entry { id: string; job: OutboxJob; tries: number; nextAt: number }

const KEY = 'outbox.v1'
/** Waits between tries: 2 s, 5 s, 15 s, 1 min, then every 5 min. */
export const BACKOFF_MS = [2_000, 5_000, 15_000, 60_000, 300_000]
export function nextDelay(tries: number): number {
  return BACKOFF_MS[Math.min(Math.max(tries, 1), BACKOFF_MS.length) - 1]
}

function load(): Entry[] {
  try { const v = JSON.parse(storage.getString(KEY) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function save(list: Entry[]): void { storage.set(KEY, JSON.stringify(list)) }

/** How many changes are still waiting to reach Spotify (Labs / tests). */
export function pendingCount(): number { return load().length }

/** Queue a change and start sending it. Returns at once. */
export function enqueue(job: OutboxJob, now = Date.now()): void {
  const list = load()
  list.push({ id: `${now}-${Math.random().toString(36).slice(2, 8)}`, job, tries: 0, nextAt: now })
  save(list)
  kick()
}

/** One job, one step at a time; a trim remembers that its backup is done. */
async function send(e: Entry): Promise<void> {
  const j = e.job
  if (j.kind === 'create') {
    await api.post('/api/playlist/create', { name: j.name, uris: j.uris, description: j.description })
    deleteCache(CacheKeys.playlists)
    return
  }
  if (!j.backedUp) {
    await api.post(`/api/playlist/${j.playlistId}/duplicate`, { name: j.backupName })
    j.backedUp = true
    const list = load(); const i = list.findIndex(x => x.id === e.id)
    if (i >= 0) { list[i].job = j; save(list) }
  }
  await api.post(`/api/playlist/${j.playlistId}/remove`, { uris: j.cutUris })
  deleteCache(CacheKeys.playlistAnalysis(j.playlistId))
  deleteCache(CacheKeys.playlists)
}

let running = false
let timer: ReturnType<typeof setTimeout> | null = null

/** Send whatever is due; schedule the next try for the rest. Safe to call any time. */
export async function kick(now = () => Date.now()): Promise<void> {
  if (running) return
  running = true
  if (timer) { clearTimeout(timer); timer = null }
  try {
    for (;;) {
      const list = load()
      const due = list.find(e => e.nextAt <= now())
      if (!due) break
      try {
        await send(due)
        save(load().filter(e => e.id !== due.id))
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0
        if (status === 403) {
          // An old sign-in without the playlist scopes: it can't land until a reconnect.
          setScopeStatus('missing')
          showToast('Reconnect Spotify to finish saving your playlist', 'sync')
        }
        const rest = load()
        const i = rest.findIndex(e => e.id === due.id)
        if (i >= 0) {
          rest[i].tries += 1
          rest[i].nextAt = now() + nextDelay(rest[i].tries)
          // Say so once, after a few failed tries; it keeps trying quietly after that.
          if (rest[i].tries === 3 && status !== 403) showToast('Still saving to Spotify… will keep trying', 'cloud-upload-outline')
          save(rest)
        }
        break
      }
    }
  } finally {
    running = false
    const left = load()
    if (left.length) {
      const wait = Math.max(500, Math.min(...left.map(e => e.nextAt)) - now())
      timer = setTimeout(() => { kick() }, wait)
    }
  }
}

/** Call once at start-up: resend anything left from last time, and again on return. */
let started = false
export function startOutbox(): void {
  if (started) return
  started = true
  kick()
  AppState.addEventListener('change', s => { if (s === 'active') kick() })
}

/** Test-only. */
export function _resetOutbox(): void { storage.remove(KEY); running = false; if (timer) clearTimeout(timer); timer = null }
