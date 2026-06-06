/**
 * Lightweight app-settings store, backed by the same MMKV instance as the cache.
 * Synchronous reads make it safe to call from render and from the haptic helper.
 */
import { storage } from '@/utils/cache'

const KEYS = {
  haptics: 'settings.haptics',
} as const

// ── Haptics ──
export function hapticsEnabled(): boolean {
  const v = storage.getBoolean(KEYS.haptics)
  return v === undefined ? true : v // default ON
}

export function setHapticsEnabled(on: boolean): void {
  storage.set(KEYS.haptics, on)
}
