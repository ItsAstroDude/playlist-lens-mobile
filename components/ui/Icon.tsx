import React from 'react'
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/theme'

/**
 * The app's single icon set: Ionicons (MIT — ionic.io/ionicons), shipped with
 * @expo/vector-icons as a font, so it costs no extra bundle and works over OTA.
 * Every UI icon goes through here so the set stays swappable in one place.
 */
export type IconName = React.ComponentProps<typeof Ionicons>['name']

/**
 * `style` may be a text style written for the old unicode glyph — its fontSize /
 * color become the icon's size / colour, and font props are dropped so they can't
 * clobber the icon font. Works nested inside a <Text> for inline icons.
 */
export function Icon({ name, size, color, style, inline }: {
  name:   IconName
  size?:  number
  color?: string
  style?: StyleProp<TextStyle>
  /** Nested in a <Text>: take only size + colour from `style` (no box props). */
  inline?: boolean
}) {
  const { fontFamily: _f, fontWeight: _w, fontSize, color: styleColor, lineHeight: _l, ...rest } =
    (StyleSheet.flatten(style) ?? {}) as TextStyle
  return (
    <Ionicons
      name={name}
      size={size ?? fontSize ?? 18}
      color={color ?? (styleColor as string | undefined) ?? Colors.text}
      style={inline ? undefined : rest}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  )
}

/**
 * Legacy unicode glyphs → Ionicons. Strings that carry a leading glyph (the
 * rotating quotes, Wrapped teasers, a user's custom banner) are mapped through
 * this; anything unmapped (e.g. an emoji the user typed) renders as text.
 */
export const GLYPH_ICON: Record<string, IconName> = {
  '✦': 'sparkles',
  '♪': 'musical-note',
  '◎': 'aperture',
  '◐': 'disc',
  '♥': 'heart',
  '☾': 'moon',
  '◍': 'git-compare',
  '⤳': 'play-skip-forward',
  '◷': 'time',
  '★': 'star',
  '↻': 'repeat',
  '✚': 'person-add',
  '✺': 'flame',
  '▲': 'trending-up',
}

/** Render a leading glyph: an Ionicon when we know it, else the raw character. */
export function GlyphOrIcon({ glyph, size, color, style, inline }: {
  glyph: string; size: number; color: string; style?: StyleProp<TextStyle>; inline?: boolean
}) {
  const name = GLYPH_ICON[glyph]
  return name
    ? <Icon name={name} size={size} color={color} style={style} inline={inline} />
    : <Text style={[{ fontSize: size, color }, style]}>{glyph}</Text>
}
