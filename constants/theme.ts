// ─── Color Palette ────────────────────────────────────────────────────────────
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
  borderActive: 'rgba(83,224,118,0.4)',

  // ── Text ──
  text:          '#E5E1E4',
  textSecondary: '#BCCBB9',
  textMuted:     '#869585',
  textDim:       '#3D4A3D',

  // ── Brand greens ──
  green:        '#1DB954',  // Spotify brand (login button)
  greenPrimary: '#53e076',  // design primary — used for all UI accents
  green2:       '#1ed760',
  greenNeon:    '#53e076',
  greenGlow:    'rgba(83,224,118,0.15)',
  greenSubtle:  'rgba(83,224,118,0.08)',

  // ── Aurora ──
  auroraTop:    'rgba(83,224,118,0.06)',
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

export const FontFamily = {
  mono:       'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
  syne:       'Syne_700Bold',
  syneBold:   'Syne_800ExtraBold',
  // alias used across the app as the "display" font
  display:    'Syne_700Bold',
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
  shadowColor:   '#53e076',
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
