// ─── Color Palette ────────────────────────────────────────────────────────────
export const Colors = {
  background:   '#090910',

  // ── Glass surfaces ──
  // These are the core tokens for the glassmorphism aesthetic.
  // glass:          the surface fill (semi-transparent white)
  // glassBorder:    the crisp edge that sells the glass illusion
  // glassHighlight: the specular "glare" line at the top edge of a panel
  glass:          'rgba(255,255,255,0.07)',
  glassBorder:    'rgba(255,255,255,0.13)',
  glassHighlight: 'rgba(255,255,255,0.07)',

  // ── Generic surfaces (kept for compatibility) ──
  card:         'rgba(255,255,255,0.06)',
  cardHover:    'rgba(255,255,255,0.10)',
  border:       'rgba(255,255,255,0.10)',
  borderActive: 'rgba(29,185,84,0.4)',

  // ── Text — off-white prevents halation on near-black backgrounds ──
  text:          '#EBEBEB',
  textSecondary: '#AAAAAA',
  textMuted:     '#606060',
  textDim:       '#333333',

  // ── Brand ──
  green:        '#1DB954',
  green2:       '#1ed760',
  greenNeon:    '#00FF87',
  greenGlow:    'rgba(29,185,84,0.15)',
  greenSubtle:  'rgba(29,185,84,0.08)',

  // ── Aurora — the ambient "light source" behind the glass ──
  // Used as a vertical gradient from the top of the main screen,
  // giving the glass cards something luminous to refract.
  auroraTop:    'rgba(29,185,84,0.09)',
  auroraBot:    'rgba(9,9,16,0.00)',

  // ── Semantic ──
  error:        '#FF6B6B',
  errorSubtle:  'rgba(255,80,80,0.08)',
  warning:      '#FFB347',

  // ── Compare palette ──
  compareA:     '#4FC3F7',
  compareB:     '#F06292',

  // ── Overlays ──
  overlay:      'rgba(9,9,16,0.75)',
  overlayLight: 'rgba(9,9,16,0.4)',
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

export const FontFamily = {
  mono:       'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
  syne:       'Syne_700Bold',
  syneBold:   'Syne_800ExtraBold',
} as const

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
// Rounder across the board — consistent with the premium glass aesthetic.
export const Radius = {
  sm:    8,
  md:    14,
  lg:    20,
  xl:    28,
  '2xl': 36,
  full:  9999,
} as const

// ─── Shadows / Glows ─────────────────────────────────────────────────────────
export const GreenGlow = {
  shadowColor:   '#1DB954',
  shadowOffset:  { width: 0, height: 0 },
  shadowOpacity: 0.65,
  shadowRadius:  28,
  elevation:     14,
} as const
