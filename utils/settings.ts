/**
 * Lightweight app-settings store, backed by the same MMKV instance as the cache.
 * Synchronous reads make it safe to call from render and from the haptic helper.
 */
import { storage } from '@/utils/cache'

const KEYS = {
  haptics:      'settings.haptics',
  reduceMotion: 'settings.reduceMotion',
  artwork:      'settings.artwork',
  accentId:     'settings.accentId',
  fontId:       'settings.fontId',
  themeMode:    'settings.themeMode',
  customQuote:  'settings.customQuote',
  lensLayout:   'settings.lensLayout',
  navbarStyle:  'settings.navbarStyle',
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

// ── Appearance (Expressive Expressions) — accent + font ──
// NOTE: these are read at app-startup by constants/theme.ts. Writing a new value
// only takes effect after an app reload (see reloadApp in utils/updates). The keys
// here MUST match the literals theme.ts reads ('settings.accentId'/'settings.fontId').
export function getAccentId(): string {
  return storage.getString(KEYS.accentId) ?? 'green'
}
export function setAccentId(id: string): void {
  storage.set(KEYS.accentId, id)
}

export function getFontId(): string {
  return storage.getString(KEYS.fontId) ?? 'dmmono'
}
export function setFontId(id: string): void {
  storage.set(KEYS.fontId, id)
}

// Theme mode (read at startup by constants/theme.ts; applies on next reload).
export type ThemeMode = 'dark' | 'light'
export function getThemeMode(): ThemeMode {
  return (storage.getString(KEYS.themeMode) as ThemeMode) ?? 'dark'
}
export function setThemeMode(mode: ThemeMode): void {
  storage.set(KEYS.themeMode, mode)
}

// ── Lenses layout — full-bleed cards (default) or a 2-column grid ──
// Toggled from the Lenses screen itself; applies instantly.
export type LensLayout = 'full' | 'grid'
export function getLensLayout(): LensLayout {
  return (storage.getString(KEYS.lensLayout) as LensLayout) ?? 'full'
}
export function setLensLayout(layout: LensLayout): void {
  storage.set(KEYS.lensLayout, layout)
}

// ── Navbar style — read once per launch by the tab layout (restart to apply) ──
export type NavbarStyle = 'legacy' | 'minimal' | 'gestures'
export const NAVBAR_STYLES: { id: NavbarStyle; label: string; hint: string }[] = [
  { id: 'legacy',   label: 'Legacy',        hint: 'The floating bar with labels' },
  { id: 'minimal',  label: 'Minimal',       hint: 'Compact pill, icons only' },
  { id: 'gestures', label: 'Gestures only', hint: 'No bar — swipe anywhere to switch' },
]
export function getNavbarStyle(): NavbarStyle {
  return (storage.getString(KEYS.navbarStyle) as NavbarStyle) ?? 'legacy'
}
export function setNavbarStyle(style: NavbarStyle): void {
  storage.set(KEYS.navbarStyle, style)
}
// Captured at module load (≈ app launch) so Settings can tell whether the saved
// choice differs from the bar actually on screen this session.
const _launchNavbarStyle = getNavbarStyle()
export function launchNavbarStyle(): NavbarStyle { return _launchNavbarStyle }

// ── Custom home banner (empty = rotating tips, the default) ──
// Joins the Lenses top-strip rotation pool; applied live on next screen focus.
export function getCustomQuote(): string {
  return storage.getString(KEYS.customQuote)?.trim() ?? ''
}
export function setCustomQuote(text: string): void {
  const v = text.trim()
  if (v) storage.set(KEYS.customQuote, v)
  else   storage.remove(KEYS.customQuote)
}
