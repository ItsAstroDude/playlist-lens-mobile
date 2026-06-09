/**
 * Lightweight app-settings store, backed by the same MMKV instance as the cache.
 * Synchronous reads make it safe to call from render and from the haptic helper.
 */
import { storage } from '@/utils/cache'

const KEYS = {
  haptics:      'settings.haptics',
  reduceMotion: 'settings.reduceMotion',
  artwork:      'settings.artwork',
} as const

// ── Haptics (default ON) ──
export function hapticsEnabled(): boolean {
  const v = storage.getBoolean(KEYS.haptics)
  return v === undefined ? true : v
}
export function setHapticsEnabled(on: boolean): void {
  storage.set(KEYS.haptics, on)
}

// ── Reduce motion (default OFF) — stills the ambient backgrounds + strip fades ──
export function reduceMotionEnabled(): boolean {
  return storage.getBoolean(KEYS.reduceMotion) ?? false
}
export function setReduceMotionEnabled(on: boolean): void {
  storage.set(KEYS.reduceMotion, on)
}

// ── Artwork fetching (default ON) — off = always tinted initials, no network ──
export function artworkEnabled(): boolean {
  const v = storage.getBoolean(KEYS.artwork)
  return v === undefined ? true : v
}
export function setArtworkEnabled(on: boolean): void {
  storage.set(KEYS.artwork, on)
}
