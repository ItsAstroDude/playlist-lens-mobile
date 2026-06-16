/**
 * Playback control client (v1.5 "Custom Queues").
 *
 * playlist.lens is a REMOTE, not a player: the Web API can only drive an
 * already-running Spotify Connect device, and every call here needs Spotify
 * Premium. So the flow is — detect a device (3 states), then start an ordered
 * queue with PUT /me/player/play (≤100 URIs), appending the rest one-by-one.
 *
 * IMPORTANT: a missing-scope 403 here is tracked with a DEDICATED flag, NOT the
 * global utils/scopeStatus — that one also gates the now-playing poll, and a
 * token can have v1.3's now-playing scope while lacking v1.5's playback scopes.
 */
import { api, ApiError } from '@/utils/api'
import { storage } from '@/utils/cache'
import type { SpotifyUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────────
export interface PlaybackDevice {
  id:             string | null
  name:           string
  type:           string
  is_active:      boolean
  is_restricted:  boolean
  volume_percent: number | null
}

export type DeviceTarget =
  | { kind: 'active'; device: PlaybackDevice }   // something's playing → just fire
  | { kind: 'idle';   device: PlaybackDevice }   // present but inactive → transfer + start
  | { kind: 'none' }                              // Spotify closed → must wake it first

export type PlaybackErrorKind = 'scope' | 'premium' | 'noDevice' | 'other'

const PLAY_BATCH = 100   // /play accepts up to 100 URIs in one body
const MAX_QUEUE  = 200   // cap total appended so we don't fire hundreds of /queue calls

// ─── Dedicated scope flag (mirrors utils/recents auto-pull flag) ──────────────
const PB_SCOPE_KEY = 'playback_scope_missing'

export function setPlaybackScopeMissing(missing: boolean): void {
  if (missing) storage.set(PB_SCOPE_KEY, true)
  else storage.remove(PB_SCOPE_KEY)
}
export function playbackScopeMissing(): boolean {
  return storage.getBoolean(PB_SCOPE_KEY) ?? false
}

// ─── Pure helpers (unit-tested) ───────────────────────────────────────────────

/**
 * Choose where the queue should start. Restricted devices (some Cast targets) and
 * id-less entries can't be driven by the Web API, so they're filtered out first.
 */
export function pickTarget(devices: PlaybackDevice[]): DeviceTarget {
  const controllable = devices.filter(d => d.id && !d.is_restricted)
  const active = controllable.find(d => d.is_active)
  if (active) return { kind: 'active', device: active }
  if (controllable.length) return { kind: 'idle', device: controllable[0] }
  return { kind: 'none' }
}

/** Keep only spotify:track: URIs (mirrors the backend whitelist). */
export function trackUrisOnly(uris: string[]): string[] {
  return uris.filter(u => typeof u === 'string' && u.startsWith('spotify:track:'))
}

/** Deterministic in-place-free Fisher–Yates (so a shuffled queue is fixed once started). */
export function orderUris(uris: string[], shuffle: boolean): string[] {
  const out = trackUrisOnly(uris)
  if (!shuffle) return out
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Map a thrown error to a UI-actionable kind. 401s never reach here (api.ts handles them). */
export function classifyPlaybackError(err: unknown): PlaybackErrorKind {
  if (!(err instanceof ApiError)) return 'other'
  const msg = (err.message || '').toLowerCase()
  if (err.status === 403) return msg.includes('premium') ? 'premium' : 'scope'
  if (err.status === 404) return 'noDevice'   // NO_ACTIVE_DEVICE / device gone
  return 'other'
}

// ─── Network ──────────────────────────────────────────────────────────────────

/** List Connect devices. Toggles the scope flag based on the outcome. */
export async function fetchDevices(): Promise<PlaybackDevice[]> {
  try {
    const data = await api.get<{ devices?: PlaybackDevice[] }>('/api/playback/devices')
    setPlaybackScopeMissing(false)   // a 200 proves the token has the scope
    return data.devices ?? []
  } catch (err) {
    if (classifyPlaybackError(err) === 'scope') setPlaybackScopeMissing(true)
    throw err
  }
}

async function playUris(uris: string[], deviceId?: string): Promise<number> {
  const res = await api.put<{ started?: number }>('/api/playback/play', {
    uris,
    ...(deviceId ? { device_id: deviceId } : {}),
  })
  return res.started ?? uris.length
}

async function queueUri(uri: string, deviceId?: string): Promise<void> {
  await api.post('/api/playback/queue', { uri, ...(deviceId ? { device_id: deviceId } : {}) })
}

/**
 * Start an ordered queue on the user's Spotify. Plays the first 100 URIs in one
 * shot, then appends up to MAX_QUEUE more one at a time (stopping on the first
 * append failure — the main queue is already playing, so a partial tail is fine).
 * Returns counts. Throws (classify with classifyPlaybackError) if the initial
 * /play fails — that's the one the UI must surface.
 */
export async function startQueue(
  uris: string[],
  opts: { deviceId?: string; shuffle?: boolean } = {},
): Promise<{ started: number; queued: number }> {
  const ordered = orderUris(uris, opts.shuffle ?? false)
  if (!ordered.length) throw new ApiError(400, 'No playable tracks in the queue.')

  const first = ordered.slice(0, PLAY_BATCH)
  const rest  = ordered.slice(PLAY_BATCH, MAX_QUEUE)

  let started: number
  try {
    started = await playUris(first, opts.deviceId)
    setPlaybackScopeMissing(false)
  } catch (err) {
    if (classifyPlaybackError(err) === 'scope') setPlaybackScopeMissing(true)
    throw err
  }

  let queued = 0
  for (const uri of rest) {
    try { await queueUri(uri, opts.deviceId); queued++ }
    catch { break }   // best-effort tail — don't fail the whole start over an append
  }
  return { started, queued }
}

// ─── Premium gate ───────────────────────────────────────────────────────────
// Subscription tier rarely changes; cache it for the session. On a fetch error we
// fall back to last-known (or true) so a network blip never wrongly blocks a real
// Premium user — the actual /play call still surfaces a 'premium' error otherwise.
let _premium: { value: boolean; ts: number } | null = null
const PREMIUM_TTL = 60 * 60 * 1000

export async function isPremium(force = false): Promise<boolean> {
  if (!force && _premium && Date.now() - _premium.ts < PREMIUM_TTL) return _premium.value
  try {
    const me = await api.get<SpotifyUser>('/api/me')
    _premium = { value: me.product === 'premium', ts: Date.now() }
    return _premium.value
  } catch {
    return _premium?.value ?? true
  }
}

/** For tests / logout — drop the cached tier. */
export function _resetPremiumCache(): void { _premium = null }
