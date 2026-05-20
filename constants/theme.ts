// ─── Color Palette ────────────────────────────────────────────────────────────
export const Colors = {
  background:   '#090910',
  card:         'rgba(255,255,255,0.04)',
  cardHover:    'rgba(255,255,255,0.07)',
  border:       'rgba(255,255,255,0.07)',
  borderActive: 'rgba(29,185,84,0.4)',

  // Text — off-white to prevent halation on deep black
  text:         '#EBEBEB',
  textSecondary:'#AAAAAA',
  textMuted:    '#555555',
  textDim:      '#333333',

  // Brand
  green:        '#1DB954',
  green2:       '#1ed760',
  greenGlow:    'rgba(29,185,84,0.15)',
  greenSubtle:  'rgba(29,185,84,0.08)',

  // Semantic
  error:        '#FF6B6B',
  errorSubtle:  'rgba(255,80,80,0.08)',
  warning:      '#FFB347',

  // Compare colors
  compareA:     '#4FC3F7',
  compareB:     '#F06292',

  // Overlay
  overlay:      'rgba(9,9,16,0.7)',
  overlayLight: 'rgba(9,9,16,0.4)',
} as const

// ─── Typography ───────────────────────────────────────────────────────────────
export const FontSize = {
  xs:   10,
  sm:   11,
  base: 13,
  md:   15,
  lg:   18,
  xl:   22,
  '2xl':28,
  '3xl':36,
  '4xl':48,
} as const

export const FontFamily = {
  mono:       'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
  syne:       'Syne_700Bold',
  syneBold:   'Syne_800ExtraBold',
} as const

export const LineHeight = {
  tight:  1.1,
  normal: 1.5,
  relaxed:1.7,
} as const

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl':24,
  '3xl':32,
  '4xl':40,
  '5xl':56,
} as const

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
} as const

// ─── Shadows (iOS glow effect) ────────────────────────────────────────────────
export const GreenGlow = {
  shadowColor:   '#1DB954',
  shadowOffset:  { width: 0, height: 0 },
  shadowOpacity: 0.6,
  shadowRadius:  24,
  elevation:     12,
} as const
