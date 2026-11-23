/**
 * Lightweight app-settings store, backed by the same MMKV instance as the cache.
 * Synchronous reads make it safe to call from render and from the haptic helper.
 */
import { storage } from '@/utils/cache'
import { cleanOutline, FLIP7_OUTLINE, type CameraOutline } from '@/components/cover/outline'

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
  nowPlayingPos: 'settings.nowPlayingPos',
  tribute:       'settings.tribute',
  cameraOutline: 'settings.cameraOutlinePx',   // panel px (the old dp key is ignored)
  tabletop:      'settings.tabletop',
  tabletopLayout: 'settings.tabletopLayout',
  flexPanel:     'settings.flexPanel',
  simulateFold:  'labs.simulateHalfFold',
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

// ── Memorial marks (default ON) — a small † beside artists who have passed,
// plus a quiet remembrance line in their expanded panel. Opt-out here. ──
export function tributeEnabled(): boolean {
  const v = storage.getBoolean(KEYS.tribute)
  return v === undefined ? true : v
}
export function setTributeEnabled(on: boolean): void {
  storage.set(KEYS.tribute, on)
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

// ── Now-playing bar position (v1.3) — applies LIVE, no restart ──
// 'bottom' = glass pill docked above the floating tab bar (every tab);
// 'top'    = lives in the Lenses quote-strip slot (quotes return when idle).
// Both the bar and the strip subscribe, so flipping it in Settings is instant.
export type NowPlayingPos = 'bottom' | 'top'
const npPosListeners = new Set<(p: NowPlayingPos) => void>()
export function getNowPlayingPos(): NowPlayingPos {
  return (storage.getString(KEYS.nowPlayingPos) as NowPlayingPos) ?? 'bottom'
}
export function setNowPlayingPos(pos: NowPlayingPos): void {
  storage.set(KEYS.nowPlayingPos, pos)
  npPosListeners.forEach(cb => cb(pos))
}
export function onNowPlayingPos(cb: (p: NowPlayingPos) => void): () => void {
  npPosListeners.add(cb)
  return () => { npPosListeners.delete(cb) }
}

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

// ── Cover-screen camera outline (prototype) — tuned in the Cover screen lab ──
// Falls back to the hardcoded Flip 7 estimate until the user saves a tuned copy.
export function getCameraOutline(): CameraOutline {
  const raw = storage.getString(KEYS.cameraOutline)
  if (!raw) return { ...FLIP7_OUTLINE }
  try { return cleanOutline(JSON.parse(raw)) } catch { return { ...FLIP7_OUTLINE } }
}
export function setCameraOutline(o: CameraOutline | null): void {
  if (o) storage.set(KEYS.cameraOutline, JSON.stringify(cleanOutline(o)))
  else   storage.remove(KEYS.cameraOutline)
}

// ── Half-folded (tabletop) Now Playing (default ON) — applies live ──
// `simulateFold` (Labs) pretends the phone is half-folded so the layout can be checked
// without the posture-aware APK. Both notify subscribers (hooks/usePosture, the view).
const foldListeners = new Set<() => void>()
const emitFold = () => foldListeners.forEach(cb => cb())
export function onFoldSettings(cb: () => void): () => void {
  foldListeners.add(cb)
  return () => { foldListeners.delete(cb) }
}
export function tabletopEnabled(): boolean {
  // Off by default (2.0.35): folding brings up the Flex panel instead; Now playing's full
  // screen opens from the cover button. On = folding while a song plays opens it.
  return storage.getBoolean(KEYS.tabletop) ?? false
}
export function setTabletopEnabled(on: boolean): void {
  storage.set(KEYS.tabletop, on); emitFold()
}
export function simulateHalfFold(): boolean {
  return storage.getBoolean(KEYS.simulateFold) ?? false
}
export function setSimulateHalfFold(on: boolean): void {
  storage.set(KEYS.simulateFold, on); emitFold()
}

/** What the half-folded view shows: Now playing (H1), or up next as a swipe deck over a
 *  touch strip (C+D 1) or sitting on a touch pad (C+D 2). Switchable in the view itself. */
/** 'pad' (C+D 2) was removed in 2.0.36 — a stored 'pad' reads as 'strip'. */
export type TabletopLayout = 'now' | 'strip'
export function tabletopLayout(): TabletopLayout {
  const v = storage.getString(KEYS.tabletopLayout)
  return v === 'now' ? 'now' : 'strip'
}
export function setTabletopLayout(v: TabletopLayout): void {
  storage.set(KEYS.tabletopLayout, v); emitFold()
}

/** Flex panel (2.0.35, default on): folded, the app moves to the standing half and the
 *  flat half becomes a music remote. */
export function flexPanelEnabled(): boolean {
  return storage.getBoolean(KEYS.flexPanel) ?? true
}
export function setFlexPanelEnabled(on: boolean): void {
  storage.set(KEYS.flexPanel, on); emitFold()
}
