import React, { useEffect } from 'react'
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { useMotionReduced } from './reduced'

/**
 * Motion #6 (part) — kinetic type. Each word rises out of its own line slot, one after
 * another, with a small tilt that settles. Remount (or change `trigger`) to play again.
 */
export function KineticText({ text, style, delay = 0, stagger = 80, containerStyle }: {
  text: string
  style: StyleProp<TextStyle>
  delay?: number
  stagger?: number
  containerStyle?: StyleProp<ViewStyle>
}) {
  const flat = StyleSheet.flatten(style) ?? {}
  const lineH = Math.round((flat.lineHeight as number) ?? (flat.fontSize ?? 16) * 1.15)
  const words = text.split(' ')
  return (
    <View style={[styles.row, containerStyle]} accessible accessibilityRole="text" accessibilityLabel={text}>
      {words.map((w, i) => (
        <Word key={`${i}-${w}`} word={w} lineH={lineH} style={[style, { lineHeight: lineH }]} delay={delay + i * stagger} last={i === words.length - 1} />
      ))}
    </View>
  )
}

function Word({ word, lineH, style, delay, last }: { word: string; lineH: number; style: StyleProp<TextStyle>; delay: number; last: boolean }) {
  const reduced = useMotionReduced()
  const p = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) { p.value = 1; return }
    p.value = withDelay(delay, withSpring(1, { mass: 0.9, damping: 14, stiffness: 150 }))
  }, [])
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.6),
    transform: [{ translateY: (1 - p.value) * lineH * 1.05 }, { rotate: `${(1 - p.value) * 5}deg` }],
  }))
  return (
    <View style={{ height: lineH, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      <Animated.Text style={[style, { includeFontPadding: false }, a]}>{word}{last ? '' : ' '}</Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap' } })
