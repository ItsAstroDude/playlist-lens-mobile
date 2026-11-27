/**
 * Crash + error reporting (2.0) — to your own backend (`/api/errors`, stored in Neon).
 *
 * Errors are queued in MMKV first (a synchronous write, so even a fatal crash is
 * saved before the app dies) and sent on the next launch / foreground once you're
 * logged in. Nothing leaves the phone without a Spotify login, and only the error
 * itself is sent: message, stack, app version, update id, platform and screen.
 *
 * Sources: the global JS error handler (fatal + non-fatal), unhandled promise
 * rejections (release builds), the root error boundary, and explicit reportError()
 * calls.
 */
import { Platform } from 'react-native'
import * as Updates from 'expo-updates'
import { storage } from '@/utils/cache'
import { api, ApiError } from '@/utils/api'
import { appVersion } from '@/utils/version'
import { errorReportsEnabled } from '@/utils/settings'

const QUEUE_KEY  = 'errors.queue.v1'
const SENT_KEY   = 'errors.sent.v1'      // recent reports kept locally for the Errors screen
const MAX_QUEUE  = 50
const MAX_LOCAL  = 50

export interface ErrorReport {
  at:        string
  message:   string
  stack?:    string
  fatal?:    boolean
  version?:  string
  update?:   string
  platform?: string
  screen?:   string
}

let currentScreen: string | undefined
/** The router path, kept current by the root layout (sent with each report). */
export function setErrorScreen(path: string | undefined): void { currentScreen = path }

function read(key: string): ErrorReport[] {
  try { const raw = storage.getString(key); return raw ? JSON.parse(raw) as ErrorReport[] : [] } catch { return [] }
}
function write(key: string, list: ErrorReport[]): void {
  try { storage.set(key, JSON.stringify(list)) } catch {}
}

function toMessage(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: `${err.name}: ${err.message}`.slice(0, 2000), stack: err.stack?.slice(0, 8000) }
  try { return { message: String(typeof err === 'string' ? err : JSON.stringify(err)).slice(0, 2000) } }
  catch { return { message: 'Unknown error' } }
}

/** Queue an error report (synchronous, crash-safe). Never throws. */
export function reportError(err: unknown, opts?: { fatal?: boolean; screen?: string }): void {
  try {
    if (!errorReportsEnabled()) return     // switched off in Settings › About
    const { message, stack } = toMessage(err)
    // Expected, user-facing conditions aren't bugs: offline, logged out.
    if (err instanceof ApiError && (err.status === 401 || err.status === 0)) return
    if (/Network request failed/i.test(message)) return
    const q = read(QUEUE_KEY)
    q.push({
      at: new Date().toISOString(), message, stack,
      fatal: !!opts?.fatal,
      version: appVersion(),
      update: Updates.updateId ?? 'embedded',
      platform: `${Platform.OS} ${String(Platform.Version)}`,
      screen: opts?.screen ?? currentScreen,
    })
    write(QUEUE_KEY, q.slice(-MAX_QUEUE))
  } catch { /* reporting must never cause a crash */ }
}

/** Reports waiting to be sent. */
export function pendingErrors(): ErrorReport[] { return read(QUEUE_KEY) }
/** Reports sent recently from this phone (newest first). */
export function sentErrors(): ErrorReport[] { return read(SENT_KEY) }

let flushing = false
/** Send the queue. Keeps it on failure (offline, backend not deployed yet). */
export async function flushErrors(): Promise<number> {
  if (flushing || !errorReportsEnabled()) return 0
  const q = read(QUEUE_KEY)
  if (!q.length) return 0
  flushing = true
  try {
    const res = await api.post<{ saved: number }>('/api/errors', { errors: q })
    // Drop exactly what we sent; anything queued meanwhile stays.
    const now = read(QUEUE_KEY)
    write(QUEUE_KEY, now.slice(q.length))
    write(SENT_KEY, [...q.reverse(), ...read(SENT_KEY)].slice(0, MAX_LOCAL))
    return res.saved ?? q.length
  } catch {
    return 0
  } finally {
    flushing = false
  }
}

/** Forget reports that haven't been sent yet (used when reporting is switched off). */
export function dropPendingErrors(): void { write(QUEUE_KEY, []) }

/** Fetch this account's reports from the backend (newest first). */
export async function fetchErrors(limit = 100): Promise<ErrorReport[]> {
  const res = await api.get<{ items: ErrorReport[] }>(`/api/errors?limit=${limit}`)
  return res.items ?? []
}
/** Clear this account's reports on the backend and on the phone. */
export async function clearErrors(): Promise<void> {
  await api.delete('/api/errors')
  write(SENT_KEY, [])
  write(QUEUE_KEY, [])
}

let installed = false
/** Hook the global handlers. Call once, as early as possible. */
export function installErrorReporting(): void {
  if (installed) return
  installed = true
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void }
    HermesInternal?: { enablePromiseRejectionTracker?: (o: { allRejections: boolean; onUnhandled: (id: number, e: unknown) => void }) => void }
  }
  const eu = g.ErrorUtils
  if (eu) {
    const prev = eu.getGlobalHandler()
    eu.setGlobalHandler((e, fatal) => {
      reportError(e, { fatal })
      prev(e, fatal)          // keep React Native's own behaviour (red box in dev, crash in release)
    })
  }
  // Release only: in development React Native's own tracker feeds the dev warnings.
  if (!__DEV__) {
    try {
      g.HermesInternal?.enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled: (_id, e) => reportError(e),
      })
    } catch {}
  }
}
