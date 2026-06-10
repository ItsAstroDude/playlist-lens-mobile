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
export interface FontOption { id: string; label: string; family: FontFamilySet }
export const FONTS: FontOption[] = [
  {
    id: 'syne', label: 'Syne · DM Mono', // default — original pairing
    family: { mono: 'DMMono_400Regular', monoMedium: 'DMMono_500Medium', syne: 'Syne_700Bold', syneBold: 'Syne_800ExtraBold', display: 'Syne_700Bold' },
  },
  {
    id: 'grotesk', label: 'Space Grotesk · Space Mono',
    family: { mono: 'SpaceMono_400Regular', monoMedium: 'SpaceMono_700Bold', syne: 'SpaceGrotesk_600SemiBold', syneBold: 'SpaceGrotesk_700Bold', display: 'SpaceGrotesk_700Bold' },
  },
  {
    id: 'sora', label: 'Sora · IBM Plex Mono',
    family: { mono: 'IBMPlexMono_400Regular', monoMedium: 'IBMPlexMono_500Medium', syne: 'Sora_600SemiBold', syneBold: 'Sora_700Bold', display: 'Sora_700Bold' },
  },
]
export const DEFAULT_FONT_ID = 'syne'

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

// ── Read the persisted selection ONCE at startup (sync MMKV read) ──
const _accentId = storage.getString('settings.accentId') ?? DEFAULT_ACCENT_ID
const _fontId   = storage.getString('settings.fontId')   ?? DEFAULT_FONT_ID
const _accent   = (ACCENTS.find(a => a.id === _accentId) ?? ACCENTS[0]).hex
const _font     = (FONTS.find(f => f.id === _fontId)     ?? FONTS[0]).family

/** The accent/font ids actually in effect this launch (for the Settings UI). */
export function activeAccentId(): string { return _accentId }
export function activeFontId():   string { return _fontId }

// ─── Color Palette ────────────────────────────────────────────────────────────
// Neutral tokens are fixed; the six accent-derived tokens come from `_accent`.
export const Colors = {
  background: '#131315',

  // ── Glass surfaces ──
  glass:          'rgba(255,255,255,0.04)',
  glassBorder:    'rgba(255,255,255,0.10)',
  glassHighlight: 'rgba(255,255,255,0.13)',  // specular top edge

  // ── Generic surfaces ──
  card:         'rgba(255,255,255,0.04)',
  cardHover:    'rgba(255,255,255,0.08)',
  border:       'rgba(255,255,255,0.10)',
  borderActive: alpha(_accent, 0.4),

  // ── Text ──
  text:          '#E5E1E4',
  textSecondary: '#BCCBB9',
  textMuted:     '#869585',
  textDim:       '#3D4A3D',

  // ── Brand greens ──
  green:        '#1DB954',  // Spotify brand (login button) — NOT themed
  greenPrimary: _accent,    // design primary — the chosen accent, used for all UI
  green2:       '#1ed760',  // Spotify brand variant — NOT themed
  greenNeon:    _accent,
  greenGlow:    alpha(_accent, 0.15),
  greenSubtle:  alpha(_accent, 0.08),

  // ── Aurora ──
  auroraTop:    alpha(_accent, 0.06),
  auroraBot:    'rgba(19,19,21,0.00)',

  // ── Violet ambient (top-left glow) ──
  violet:      '#4E03D0',
  violetGlow:  'rgba(78,3,208,0.14)',

  // ── Pink / tertiary accent ──
  pink:        '#FF70A5',
  pinkGlow:    'rgba(255,112,165,0.09)',

  // ── Lavender / secondary ──
  lavender:    '#CCBDFF',

  // ── Compare palette ──
  compareA:    '#4FC3F7',
  compareB:    '#F06292',

  // ── Semantic ──
  error:       '#ffb4ab',
  errorSubtle: 'rgba(255,80,80,0.08)',
  warning:     '#FFB347',

  // ── Overlays ──
  overlay:      'rgba(19,19,21,0.75)',
  overlayLight: 'rgba(19,19,21,0.4)',
} as const

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
export const FontFamily: FontFamilySet = _font

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
