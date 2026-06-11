// ═══════════════════════════════════════════════════════════════════════════════
//  Expressive Expressions — reload-based theming
//
//  Instead of making every StyleSheet dynamic (a 24-file refactor), the chosen
//  accent + font are read ONCE here at module load and baked into the exported
//  tokens below. Changing them persists the choice to MMKV and relaunches the JS
//  bundle (Updates.reloadAsync) so these tokens recompute. Every existing
//  StyleSheet keeps importing `Colors`/`FontFamily` unchanged.
//
//  The default green/Syne selection reproduces the original literal values exactly,
//  so a fresh install looks identical to before.
// ═══════════════════════════════════════════════════════════════════════════════
import { storage } from '@/utils/cache'

export interface AccentOption { id: string; label: string; hex: string }
export const ACCENTS: AccentOption[] = [
  { id: 'green',    label: 'Neon Green', hex: '#53e076' }, // default — original accent
  { id: 'lavender', label: 'Lavender',   hex: '#CCBDFF' },
  { id: 'pink',     label: 'Hot Pink',   hex: '#FF70A5' },
  { id: 'sky',      label: 'Sky',        hex: '#4FC3F7' },
  { id: 'amber',    label: 'Amber',      hex: '#FFB347' },
  { id: 'coral',    label: 'Coral',      hex: '#FF7A5C' },
]
export const DEFAULT_ACCENT_ID = 'green'

export interface FontFamilySet {
  mono: string; monoMedium: string; syne: string; syneBold: string; display: string
}
// BRAND identity — the Syne display face is FIXED and never themed, so the
// "playlist.lens" wordmark and every screen header (Your Lenses, Compare, Wrapped,
// Swipe, and any future ones) stay on-brand regardless of the user's font choice.
const BRAND = { syne: 'Syne_700Bold', syneBold: 'Syne_800ExtraBold', display: 'Syne_700Bold' } as const

// The font picker swaps ONLY the mono/body face (labels, meta, data, body copy) —
// which is the bulk of the UI text. Headlines stay Syne.
export interface FontOption { id: string; label: string; mono: string; monoMedium: string }
export const FONTS: FontOption[] = [
  { id: 'dmmono',    label: 'DM Mono',       mono: 'DMMono_400Regular',      monoMedium: 'DMMono_500Medium'  }, // default
  { id: 'spacemono', label: 'Space Mono',    mono: 'SpaceMono_400Regular',   monoMedium: 'SpaceMono_700Bold' },
  { id: 'plexmono',  label: 'IBM Plex Mono', mono: 'IBMPlexMono_400Regular', monoMedium: 'IBMPlexMono_500Medium' },
]
export const DEFAULT_FONT_ID = 'dmmono'

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
/** rgba() string from a hex + alpha — derives accent tints. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
/** Scale a hex toward black by factor `f` (0..1) — darkens an accent for light mode. */
function darken(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex)
  const c = (x: number) => Math.round(x * f).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export type ThemeMode = 'dark' | 'light'
export const DEFAULT_THEME_MODE: ThemeMode = 'dark'

// ── Read the persisted selection ONCE at startup (sync MMKV read) ──
const _accentId = storage.getString('settings.accentId') ?? DEFAULT_ACCENT_ID
const _fontId   = storage.getString('settings.fontId')   ?? DEFAULT_FONT_ID
const _mode     = (storage.getString('settings.themeMode') as ThemeMode) ?? DEFAULT_THEME_MODE
const _isLight  = _mode === 'light'
const _accentHex = (ACCENTS.find(a => a.id === _accentId) ?? ACCENTS[0]).hex
const _fontOpt  = FONTS.find(f => f.id === _fontId) ?? FONTS[0]

// On a light background the raw neon accent is too pale for foreground text/active
// states, so the UI accent is darkened in light mode (swatches still show the true
// hue). On dark it's the accent as-is.
const _accent = _isLight ? darken(_accentHex, 0.62) : _accentHex

/** The selections actually in effect this launch (for the Settings UI). */
export function activeAccentId(): string { return _accentId }
export function activeFontId():   string { return _fontId }
export function activeThemeMode(): ThemeMode { return _mode }

// ─── Color Palette ────────────────────────────────────────────────────────────
// Neutral tokens (surfaces, text, scrims) swap with the theme mode. Accent-derived
// tokens come from `_accent` (already darkened for light mode above). Vibe/brand
// colours (violet/pink/lavender/compare, Spotify greens) are mode-independent.
// NOTE: vibe badges sit on a dark scrim regardless of mode, so vibe colours stay
// bright; only the accent green darkens for light. The light palette is a first
// pass — tune contrasts/glows from on-device screenshots.
const NEUTRALS = _isLight ? {
  background:     '#F6F5F8',                 // soft near-white, faint cool tint
  sheet:          '#FFFFFF',                 // bottom sheets lift to pure white
  glass:          'rgba(22,20,32,0.04)',
  glassBorder:    'rgba(22,20,32,0.12)',
  glassHighlight: 'rgba(255,255,255,0.75)',  // specular top edge (light)
  card:           'rgba(22,20,32,0.035)',
  cardHover:      'rgba(22,20,32,0.07)',
  border:         'rgba(22,20,32,0.12)',
  text:           '#191820',
  textSecondary:  '#4A4853',
  textMuted:      '#6E6B78',
  textDim:        '#A7A3B0',
  auroraBot:      'rgba(246,245,248,0.00)',
  overlay:        'rgba(22,20,32,0.45)',     // scrim stays dark to dim modals
  overlayLight:   'rgba(22,20,32,0.25)',
  error:          '#B3261E',
  violetGlow:     'rgba(78,3,208,0.05)',     // ambient blobs much softer on white
  pinkGlow:       'rgba(255,112,165,0.045)',
} : {
  background:     '#131315',
  sheet:          '#17171b',                 // slightly lifted off the bg
  glass:          'rgba(255,255,255,0.04)',
  glassBorder:    'rgba(255,255,255,0.10)',
  glassHighlight: 'rgba(255,255,255,0.13)',
  card:           'rgba(255,255,255,0.04)',
  cardHover:      'rgba(255,255,255,0.08)',
  border:         'rgba(255,255,255,0.10)',
  text:           '#E5E1E4',
  textSecondary:  '#BCCBB9',
  textMuted:      '#869585',
  textDim:        '#3D4A3D',
  auroraBot:      'rgba(19,19,21,0.00)',
  overlay:        'rgba(19,19,21,0.75)',
  overlayLight:   'rgba(19,19,21,0.4)',
  error:          '#ffb4ab',
  violetGlow:     'rgba(78,3,208,0.14)',
  pinkGlow:       'rgba(255,112,165,0.09)',
}

export const Colors = {
  ...NEUTRALS,

  borderActive: alpha(_accent, 0.4),

  // ── Brand greens ──
  green:        '#1DB954',  // Spotify brand (login button) — NOT themed
  greenPrimary: _accent,    // design primary — the chosen accent (darkened in light)
  green2:       '#1ed760',  // Spotify brand variant — NOT themed
  greenNeon:    _accent,
  greenGlow:    alpha(_accent, 0.15),
  greenSubtle:  alpha(_accent, 0.08),

  // ── Aurora ──
  auroraTop:    alpha(_accent, 0.06),

  // ── Violet / pink / lavender accents (glows are mode-specific, in NEUTRALS) ──
  violet:      '#4E03D0',
  pink:        '#FF70A5',
  lavender:    '#CCBDFF',

  // ── Compare palette ──
  compareA:    '#4FC3F7',
  compareB:    '#F06292',

  // ── Semantic ──
  errorSubtle: 'rgba(255,80,80,0.08)',
  warning:     '#FFB347',
} as const

// Text colours for surfaces that are ALWAYS dark regardless of theme mode —
// playlist-card cover gradients and the detail-sheet hero. Using the themed text
// there would flip to dark in light mode and vanish on the dark artwork. These are
// fixed to the dark-theme values, so dark mode is unchanged.
export const OnDark = { text: '#E5E1E4', textMuted: '#869585', textDim: '#3D4A3D' } as const

// ─── Typography ───────────────────────────────────────────────────────────────
export const FontSize = {
  xs:    10,
  sm:    11,
  base:  13,
  md:    15,
  lg:    18,
  xl:    22,
  '2xl': 28,
  '3xl': 36,
  '4xl': 48,
} as const

// The chosen font pairing (defaults to Syne · DM Mono — identical to before).
// `display` is the alias used across the app as the headline font.
// Body/mono face follows the picker; syne/syneBold/display are the fixed brand face.
export const FontFamily: FontFamilySet = {
  mono:       _fontOpt.mono,
  monoMedium: _fontOpt.monoMedium,
  ...BRAND,
}

export const LineHeight = {
  tight:   1.1,
  normal:  1.5,
  relaxed: 1.7,
} as const

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  sm:    8,
  md:    14,
  lg:    20,
  xl:    28,
  '2xl': 36,
  full:  9999,
} as const

// ─── Glows ────────────────────────────────────────────────────────────────────
export const GreenGlow = {
  shadowColor:   _accent,   // tracks the chosen accent
  shadowOffset:  { width: 0, height: 0 },
  shadowOpacity: 0.55,
  shadowRadius:  24,
  elevation:     12,
} as const

export const VioletGlow = {
  shadowColor:   '#4E03D0',
  shadowOffset:  { width: 0, height: 0 },
  shadowOpacity: 0.35,
  shadowRadius:  40,
  elevation:     8,
} as const
