// ─── OAuth scope status (v1.3 "Pulse & Lively") ──────────────────────────────
// v1.3 added scopes (now-playing reads + playlist writes). Tokens from before
// that re-auth are read-only: scoped endpoints return 403, and the features
// show an inline "Reconnect Spotify" prompt instead of breaking.
//
//   'unknown' — not yet probed (fresh install, or pre-v1.3 token never tested)
//   'ok'      — token has the new scopes (fresh login, or a scoped call succeeded)
//   'missing' — a scoped call returned 403 → needs the one-time re-auth
//
// Persisted in MMKV so the prompt state survives relaunches; logout flushes it.

import { storage } from './cache'

export type ScopeStatus = 'unknown' | 'ok' | 'missing'

const KEY = 'auth.scopeStatus'

type Listener = (s: ScopeStatus) => void
const listeners = new Set<Listener>()

export function getScopeStatus(): ScopeStatus {
  return (storage.getString(KEY) as ScopeStatus) ?? 'unknown'
}

export function setScopeStatus(s: ScopeStatus): void {
  if (getScopeStatus() === s) return
  storage.set(KEY, s)
  listeners.forEach(cb => cb(s))
}

export function onScopeStatus(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
