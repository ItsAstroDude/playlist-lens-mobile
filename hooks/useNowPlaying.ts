import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { api, ApiError } from '@/utils/api'
import { getScopeStatus, setScopeStatus, onScopeStatus, type ScopeStatus } from '@/utils/scopeStatus'

// ─── Live now-playing (v1.3 "Pulse") ─────────────────────────────────────────
// ONE module-level poller feeds every subscriber (the bottom bar and the home
// strip can't double-poll). Runs only while ≥1 component is mounted AND the app
// is foregrounded. A 403 means the token predates the v1.3 scopes → flip the
// shared scope status to 'missing' and pause until a reconnect sets 'ok'.

export interface NowPlayingItem {
  id:          string | null
  uri:         string | null
  name:        string
  duration_ms: number | null
  artists:     string[]
  album:       { name: string | null; images: Array<{ url: string }> }
}

export interface NowPlaying {
  is_playing:  boolean
  progress_ms: number | null
  type:        string
  item:        NowPlayingItem | null
  receivedAt:  number   // client clock when this poll landed — lets UIs tick progress between polls
}

const POLL_MS = 8000

// ── Singleton poll engine ──
let current: NowPlaying | null = null
const subs = new Set<(np: NowPlaying | null) => void>()
let timer: ReturnType<typeof setInterval> | null = null
let appActive = true

function notify() { subs.forEach(cb => cb(current)) }

async function poll() {
  if (!subs.size || !appActive || getScopeStatus() === 'missing') return
  try {
    const data = await api.get<Omit<NowPlaying, 'receivedAt'>>('/api/now-playing')
    setScopeStatus('ok')   // a 200 proves the token has the scope (no-op if already ok)
    current = { ...data, receivedAt: Date.now() }
    notify()
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      // Pre-v1.3 token — needs the one-time re-auth. Polling pauses; the scope
      // listener below resumes it once a reconnect sets 'ok'.
      setScopeStatus('missing')
      current = null
      notify()
    }
    // Other errors (network blip, backend cold start): keep the last data —
    // the next poll self-corrects, and the UI shouldn't flicker.
  }
}

function start() {
  if (timer) return
  poll()
  timer = setInterval(poll, POLL_MS)
}
function stop() {
  if (timer) { clearInterval(timer); timer = null }
}
function sync() {
  if (subs.size && appActive && getScopeStatus() !== 'missing') start()
  else stop()
}

/** Force an immediate poll — e.g. right after a transport control so the bar/sheet
 * reflect the new state without waiting for the next interval tick. */
export function pokeNowPlaying(): void { poll() }

// Module-level listeners — registered once, gated by sync() so they're inert
// while nothing is subscribed.
AppState.addEventListener('change', s => {
  appActive = s === 'active'
  sync()
})
onScopeStatus(s => {
  if (s === 'ok') { current = null; notify() }   // clear stale "missing" UI; poll refills
  sync()
})

// ── Hook ──
export function useNowPlaying() {
  const [np, setNp]         = useState<NowPlaying | null>(current)
  const [scopes, setScopes] = useState<ScopeStatus>(getScopeStatus())

  useEffect(() => {
    subs.add(setNp)
    setNp(current)
    const unsubScopes = onScopeStatus(setScopes)
    sync()
    return () => {
      subs.delete(setNp)
      unsubScopes()
      sync()
    }
  }, [])

  return { np, needsReconnect: scopes === 'missing' }
}
