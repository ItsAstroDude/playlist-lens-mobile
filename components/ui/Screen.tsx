import React from 'react'
import { View, Text, StyleSheet, ScrollView, type ScrollViewProps } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Spacing, Type } from '@/constants/theme'
import { LiquidBackground } from '@/components/motion/LiquidBackground'
import { BackButton } from '@/components/ui/BackButton'

/**
 * Design system — page scaffolding.
 *  Screen        background + safe area + (optionally) a padded ScrollView with a
 *                bottom gutter. Every pushed screen starts here.
 *  ScreenHeader  back button row, then the big Syne title + optional subtitle,
 *                with a right-hand slot for IconButtons.
 */
export function Screen({ children, scroll = true, back = true, scrollProps, overlay }: {
  children:     React.ReactNode
  /** Rendered above everything, outside the scroll view — sheets, dialogs. */
  overlay?:     React.ReactNode
  scroll?:      boolean
  /** Show the back-button row (pushed screens). Tabs pass false. */
  back?:        boolean
  scrollProps?: ScrollViewProps
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={styles.container}>
      <LiquidBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {back && <View style={styles.backRow}><BackButton /></View>}
        {scroll ? (
          <ScrollView
            {...scrollProps}
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing['4xl'] }, scrollProps?.contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : children}
      </SafeAreaView>
      {overlay}
    </View>
  )
}

export function ScreenHeader({ title, subtitle, right }: {
  title:     string
  subtitle?: string
  right?:    React.ReactNode
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={Type.display} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        {subtitle ? <Text style={[Type.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safe:      { flex: 1 },
  backRow:   { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  scroll:    { paddingHorizontal: Spacing.lg, gap: Spacing.xl },
  header:    { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  right:     { flexDirection: 'row', gap: Spacing.sm, paddingBottom: 4 },
})
