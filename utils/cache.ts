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

export function getCache<T>(key: string): T | null {
  const raw = storage.getString(key)
  if (!raw) return null
  try {
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      storage.remove(key)
      return null
    }
    return entry.data
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
    if (k === 'wrapped_stats') continue     // preserve imported listening history (costly to re-import)
    storage.remove(k)
  }
}

// ─── flush() — wipes everything on logout ────────────────────────────────────
export async function flush(): Promise<void> {
  // Clear all MMKV cache
  storage.clearAll()
  // Clear secure token vault
  await Promise.all([
    SecureStore.deleteItemAsync(SecureKeys.accessToken),
    SecureStore.deleteItemAsync(SecureKeys.refreshToken),
    SecureStore.deleteItemAsync(SecureKeys.oauthState),
  ])
}
