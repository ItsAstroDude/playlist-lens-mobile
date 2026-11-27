import { createMMKV } from 'react-native-mmkv'
import * as SecureStore from 'expo-secure-store'

// ─── MMKV instance ────────────────────────────────────────────────────────────
export const storage = createMMKV({ id: 'playlist-lens-cache' })

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ─── Generic cache read/write ─────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T
  ts:   number
}

export function setCache<T>(key: string, value: T): void {
  const entry: CacheEntry<T> = { data: value, ts: Date.now() }
  storage.set(key, JSON.stringify(entry))
}

/** Fresh data only (younger than a day). An older entry is kept — readCache() still
 *  serves it, so a screen can show it at once while it refreshes. */
export function getCache<T>(key: string): T | null {
  const entry = readCache<T>(key)
  return entry && !entry.stale ? entry.data : null
}

/**
 * Whatever is saved, however old (2.0.36, "instant like Instagram"): show it straight
 * away, and refresh behind it when `stale`. Never deletes: an old copy beats a spinner
 * while the free-tier server wakes up.
 */
export function readCache<T>(key: string): { data: T; stale: boolean; ts: number } | null {
  const raw = storage.getString(key)
  if (!raw) return null
  try {
    const entry: CacheEntry<T> = JSON.parse(raw)
    return { data: entry.data, ts: entry.ts, stale: Date.now() - entry.ts > CACHE_TTL_MS }
  } catch {
    storage.remove(key)
    return null
  }
}

export function deleteCache(key: string): void {
  storage.remove(key)
}

// ─── Cache key builders ───────────────────────────────────────────────────────
export const CacheKeys = {
  playlists:         'playlists',
  playlistAnalysis:  (id: string) => `analysis:${id}`,
  // Raw track lists (swipe-refresh) — MUST stay out of the `analysis:` namespace:
  // the taste profile aggregates EVERY `analysis:*` key as a PlaylistAnalysis,
  // and a raw array there crashed taste/compare (v1.3 gray-screen bug).
  playlistTracks:    (id: string) => `tracks:${id}`,
  playlistPalette:   (id: string) => `palette:${id}`,
  tasteProfile:      'taste_profile',
}

// ─── Secure storage keys ──────────────────────────────────────────────────────
export const SecureKeys = {
  accessToken:  'access_token',
  refreshToken: 'refresh_token',
  // CSRF state for the OAuth round-trip. Persisted (not just held in memory) so
  // the /callback deep-link route can verify it even if the app was cold-started
  // by the redirect intent.
  oauthState:   'oauth_state',
}

// ─── clearCaches() — drop cached data, keep user settings & tokens ───────────
export function clearCaches(): void {
  for (const k of storage.getAllKeys()) {
    if (k.startsWith('settings.')) continue // preserve app settings
    // Covers found (art:) and covers you picked (artov:) don't go stale — keep them, so
    // clearing the cache doesn't mean waiting for every picture again. Saved "no picture"
    // answers (artmiss*:) do get cleared: that's how you make the app look again.
    if (k.startsWith('art:') || k.startsWith('artov:')) continue
    if (k === 'wrapped_stats') continue     // preserve imported listening history (costly to re-import)
    storage.remove(k)
  }
}

// ─── flush() — wipes everything on logout ────────────────────────────────────
// Privacy choices outlive a logout: wiping them would quietly switch reporting back on.
const KEEP_ON_LOGOUT = ['settings.errorReports'] as const

export async function flush(): Promise<void> {
  const kept = KEEP_ON_LOGOUT.map(k => [k, storage.getBoolean(k)] as const)
  // Clear all MMKV cache
  storage.clearAll()
  for (const [k, v] of kept) if (v !== undefined) storage.set(k, v)
  // Clear secure token vault
  await Promise.all([
    SecureStore.deleteItemAsync(SecureKeys.accessToken),
    SecureStore.deleteItemAsync(SecureKeys.refreshToken),
    SecureStore.deleteItemAsync(SecureKeys.oauthState),
  ])
}
