import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { api, ApiError } from '@/utils/api'
import { getScopeStatus, setScopeStatus, onScopeStatus, type ScopeStatus } from '@/utils/scopeStatus'

// ─── Live now-playing (v1.3 "Pulse") ─────────────────────────────────────────
// Polls the backend's trimmed currently-playing proxy while the app is
// foregrounded. A 403 means the token predates the v1.3 scopes → flip the
// shared scope status to 'missing' and stop polling until a reconnect fixes it.

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

export function useNowPlaying() {
  const [np, setNp]         = useState<NowPlaying | null>(null)
  const [scopes, setScopes] = useState<ScopeStatus>(getScopeStatus())
  const timer  = useRef<ReturnType<typeof setInterval> | null>(null)
  const active = useRef(true)   // mounted + app foregrounded

  const poll = useCallback(async () => {
    if (!active.current || getScopeStatus() === 'missing') return
    try {
      const data = await api.get<Omit<NowPlaying, 'receivedAt'>>('/api/now-playing')
      if (!active.current) return
      setScopeStatus('ok')   // a 200 proves the token has the scope (no-op if already ok)
      setNp({ ...data, receivedAt: Date.now() })
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Pre-v1.3 token — needs the one-time re-auth. Polling pauses; the
        // scope listener below restarts it once a reconnect sets 'ok'.
        setScopeStatus('missing')
        setNp(null)
      }
      // Other errors (network blip, backend cold start): keep the last data —
      // the next poll self-corrects, and the bar shouldn't flicker.
    }
  }, [])

  useEffect(() => {
    const start = () => {
      if (timer.current) return
      poll()
      timer.current = setInterval(poll, POLL_MS)
    }
    const stop = () => {
      if (timer.current) { clearInterval(timer.current); timer.current = null }
    }

    start()

    // Pause in background — no point burning battery/quota off-screen.
    const sub = AppState.addEventListener('change', s => {
      active.current = s === 'active'
      if (s === 'active') start()
      else stop()
    })

    // React to scope changes: reconnect ('ok') resumes the poll immediately.
    const unsubScopes = onScopeStatus(s => {
      setScopes(s)
      if (s === 'ok') { setNp(null); start() }
      else if (s === 'missing') stop()
    })

    return () => {
      active.current = false
      stop()
      sub.remove()
      unsubScopes()
    }
  }, [poll])

  return { np, needsReconnect: scopes === 'missing' }
}
