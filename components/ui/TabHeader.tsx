import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming, withSequence } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Type } from '@/constants/theme'
import { Spring } from '@/constants/animation'
import { reduceMotionEnabled } from '@/utils/settings'
import { IconButton } from '@/components/ui/Controls'
import { haptic } from '@/constants/animation'
import { SparkTiny, SparkLine, useSparkMode, greetingLine, tapLine, LINE_MS } from '@/components/spark'

/**
 * Design system — the header every TAB screen shares (Lenses, Queue, Wrapped, Swipe):
 *
 *   playlist.lens                       [actions] [⚙]
 *   title                                [titleRight]
 *   subtitle
 *   [children — chips, a search box…]
 *
 * Lowercase title (matches the tab label). Settings is one tap away from every tab.
 * Rises in on mount; still under Reduce motion.
 */
export function TabHeader({ title, subtitle, actions, titleRight, children, settings = true }: {
  title:       string
  subtitle?:   string
  /** Extra items left of the settings button on the wordmark row (badges, buttons). */
  actions?:    React.ReactNode
  /** Controls aligned with the title (IconButtons, a Done button). */
  titleRight?: React.ReactNode
  /** Anything under the subtitle — period chips, a search box. */
  children?:   React.ReactNode
  settings?:   boolean
}) {
  const still = reduceMotionEnabled()
  const y = useSharedValue(still ? 0 : 12)
  const o = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    if (still) return
    y.value = withDelay(60, withSpring(0, Spring.entrance))
    o.value = withDelay(60, withTiming(1, { duration: 360 }))
  }, [])
  const enter = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }))

  // ── Spark lives in the wordmark's dot. He greets (≥ 12 h away) and answers taps. ──
  const mode = useSparkMode()
  const [said, setSaid] = useState<{ line: string; n: number } | null>(null)
  const [rock, setRock] = useState(false)
  const hop = useSharedValue(0)
  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -hop.value * 5 }, { scale: 1 + hop.value * 0.25 }] }))
  useEffect(() => {
    if (mode !== 'on') return
    const t = setTimeout(() => { const g = greetingLine(); if (g) setSaid({ line: g, n: Date.now() }) }, 900)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { if (mode === 'off') setSaid(null) }, [mode])
  useEffect(() => {
    if (!rock) return
    const t = setTimeout(() => setRock(false), LINE_MS + 300)
    return () => clearTimeout(t)
  }, [rock])
  const onSpark = () => {
    haptic.light()
    if (!still) hop.value = withSequence(withTiming(1, { duration: 110 }), withSpring(0, { damping: 6, stiffness: 240 }))
    const r = tapLine()
    if (r.rock) setRock(true)
    setSaid({ line: r.line, n: Date.now() })
  }

  return (
    <Animated.View style={[styles.wrap, enter]}>
      <View style={styles.brandRow}>
        {mode === 'off' ? (
          <Text style={styles.logo} accessibilityRole="header" accessibilityLabel="playlist.lens">
            playlist<Text style={styles.dot}>.</Text>lens
          </Text>
        ) : (
          <View style={styles.logoRow} accessibilityRole="header" accessibilityLabel="playlist.lens">
            <Text style={styles.logo}>playlist</Text>
            <Pressable onPress={onSpark} hitSlop={14} accessibilityRole="button" accessibilityLabel="Spark" accessibilityHint="Say hi to Spark">
              <Animated.View style={[styles.sparkDot, hopStyle]}><SparkTiny size={13} rock={rock} /></Animated.View>
            </Pressable>
            <Text style={styles.logo}>lens</Text>
          </View>
        )}
        <View style={styles.actions}>
          {actions}
          {settings && (
            <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
          )}
        </View>
      </View>
      {/* 2.0 Liquid: a greeting over a big sentence-case title */}
      {said && mode !== 'off'
        ? <View style={styles.sayRow}><SparkLine key={said.n} line={said.line} mood={rock ? 'unloaded' : 'talking'} onDone={() => setSaid(null)} /></View>
        : <Text style={styles.greet}>{greeting()}</Text>}
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title.charAt(0).toUpperCase() + title.slice(1)}</Text>
        {titleRight ? <View style={styles.actions}>{titleRight}</View> : null}
      </View>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      {children}
    </Animated.View>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const styles = StyleSheet.create({
  wrap:     { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, gap: 4 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  logo:     { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.textSecondary, letterSpacing: -0.5 },
  greet:    { ...Type.caption, fontSize: 13, color: Colors.textSecondary, marginTop: Spacing.sm },
  dot:      { color: Colors.greenPrimary },
  logoRow:  { flexDirection: 'row', alignItems: 'center' },
  sparkDot: { marginHorizontal: 1.5, marginTop: 4 },
  sayRow:   { marginTop: Spacing.sm - 4, minHeight: 18 },
  actions:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  title:    { ...Type.title, fontSize: 30, lineHeight: 36, letterSpacing: -1.2, flexShrink: 1 },
  sub:      { ...Type.caption, fontSize: 11 },
})
