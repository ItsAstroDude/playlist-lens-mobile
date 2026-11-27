import React, { createContext, useContext } from 'react'
import { View, Text, StyleSheet, ScrollView, type ScrollViewProps } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, FontFamily, FontSize, Spacing, Type } from '@/constants/theme'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { BackButton } from '@/components/ui/BackButton'
import { Icon } from '@/components/ui/Icon'
import { useIsCover } from '@/hooks/useScreen'
import { useBottomGutter } from '@/hooks/useCoverClearance'

/** Set by a Screen with a back button: on the cover screen its ScreenHeader draws it. */
const BackInHeader = createContext(false)

/**
 * Design system — page scaffolding.
 *  Screen        background + safe area + (optionally) a padded ScrollView with a
 *                bottom gutter. Every pushed screen starts here.
 *  ScreenHeader  back button row, then the big Syne title + optional subtitle,
 *                with a right-hand slot for IconButtons.
 *
 * Flip cover screen (≈474×524 dp), like TabHeader there: one row — back, title,
 * buttons — with no subtitle, and the content always ends above the cameras.
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
  const cover = useIsCover()
  const bottom = useBottomGutter(insets.bottom + Spacing['4xl'])
  return (
    <View style={styles.container}>
      <AmbientBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {back && !cover && <View style={styles.backRow}><BackButton /></View>}
        <BackInHeader.Provider value={back && cover}>
          {scroll ? (
            <ScrollView
              {...scrollProps}
              contentContainerStyle={[styles.scroll, cover && styles.scrollCover, { paddingBottom: bottom }, scrollProps?.contentContainerStyle]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : children}
        </BackInHeader.Provider>
      </SafeAreaView>
      {overlay}
    </View>
  )
}

export function ScreenHeader({ title, subtitle, right, mainScreenOnly = false, coverSubtitle = false }: {
  title:     string
  subtitle?: string
  right?:    React.ReactNode
  /** Keep the subtitle (one line) on the cover screen too: for live text such as counts. */
  coverSubtitle?: boolean
  /** A tool made for the main screen (Labs): on the cover screen, say so under the title. */
  mainScreenOnly?: boolean
}) {
  const cover = useIsCover()
  const back = useContext(BackInHeader)

  if (cover) {
    return (
      <View style={styles.coverWrap}>
        <View style={styles.coverRow}>
          {back && <BackButton />}
          <Text style={styles.coverTitle} accessibilityRole="header" numberOfLines={1}>
            {title.charAt(0).toUpperCase() + title.slice(1)}
          </Text>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
        {coverSubtitle && subtitle ? <Text style={Type.caption} numberOfLines={1}>{subtitle}</Text> : null}
        {mainScreenOnly && (
          <View style={styles.mainOnly}>
            <Icon name="phone-portrait-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.mainOnlyText}>Made for the main screen. Open the phone for the full view.</Text>
          </View>
        )}
      </View>
    )
  }

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
  scrollCover: { gap: Spacing.lg },
  header:    { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  right:     { flexDirection: 'row', gap: Spacing.sm, paddingBottom: 4 },

  // Cover screen: the same size as TabHeader's one-row title there.
  coverWrap:    { paddingTop: Spacing.sm, gap: Spacing.sm },
  coverRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  coverTitle:   { ...Type.title, fontSize: 24, lineHeight: 30, letterSpacing: -1, flex: 1, minWidth: 0 },
  mainOnly:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mainOnlyText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, flexShrink: 1 },
})
