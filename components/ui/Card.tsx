import React from 'react'
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Colors, Spacing, Radius, Type, alpha } from '@/constants/theme'

/**
 * Design system — surfaces.
 *  Card     the one glass surface (fill + hairline border + specular top edge)
 *  Section  overline label + Card + optional footer note — how screens group content
 *
 * Radius rule: cards are Radius.lg, pills/chips Radius.full, tiles 10. Nothing else.
 */
export function Card({ children, tone = 'glass', padded, style }: {
  children: React.ReactNode
  /** glass = default surface · accent = highlighted (accent-tinted) */
  tone?:    'glass' | 'accent'
  /** Inner padding for free-form content. ListRows bring their own. */
  padded?:  boolean
  style?:   StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.card, tone === 'accent' && styles.accent, padded && styles.padded, style]}>
      <View style={styles.specular} pointerEvents="none" />
      {children}
    </View>
  )
}

export function Section({ label, footer, children, style }: {
  label?:   string
  footer?:  string
  children: React.ReactNode
  style?:   StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.section, style]}>
      {label ? <Text style={styles.label} accessibilityRole="header">{label}</Text> : null}
      <Card>{children}</Card>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    borderRadius:    Radius.lg,
    overflow:        'hidden',
  },
  accent: {
    backgroundColor: alpha(Colors.greenPrimary, 0.07),
    borderColor:     alpha(Colors.greenPrimary, 0.25),
  },
  padded:   { padding: Spacing.lg },
  specular: { position: 'absolute', top: 0, left: Spacing.lg, right: Spacing.lg, height: 1, backgroundColor: Colors.glassHighlight },
  section:  { gap: Spacing.sm },
  label:    { ...Type.overline, paddingLeft: Spacing.xs },
  footer:   { ...Type.caption, paddingHorizontal: Spacing.xs },
})
