import React, { useEffect } from 'react'
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { rollingParts, rollDelays } from './math'
import { useMotionReduced } from './reduced'

const DIGITS = '0123456789'.split('')

/**
 * Motion #3 — Rolling numbers. Each digit is a column of 0–9 that springs to its value;
 * columns roll left to right so the ones column lands last.
 *
 *   <RollingNumber value="18h 24m" style={{ fontSize: 64, fontFamily: … }} unitStyle={…} />
 */
export function RollingNumber({ value, style, unitStyle, stagger = 70, containerStyle }: {
  value: string
  style: StyleProp<TextStyle>
  /** Style for non-digit characters ("h", "m", "%"); defaults to `style`. */
  unitStyle?: StyleProp<TextStyle>
  stagger?: number
  containerStyle?: StyleProp<ViewStyle>
}) {
  const flat = StyleSheet.flatten(style) ?? {}
  const lineH = Math.round((flat.lineHeight as number) ?? (flat.fontSize ?? 16) * 1.1)
  const parts = rollingParts(value)
  const delays = rollDelays(parts, stagger)
  return (
    <View style={[styles.row, containerStyle]} accessible accessibilityRole="text" accessibilityLabel={value}>
      {parts.map((p, i) =>
        p.kind === 'digit'
          ? <DigitColumn key={p.key} digit={p.d} delay={delays[i]} lineH={lineH} style={[style, { lineHeight: lineH }]} />
          : <Text key={p.key} style={[unitStyle ?? style]} importantForAccessibility="no">{p.ch === ' ' ? ' ' : p.ch}</Text>,
      )}
    </View>
  )
}

function DigitColumn({ digit, delay, lineH, style }: { digit: number; delay: number; lineH: number; style: StyleProp<TextStyle> }) {
  const reduced = useMotionReduced()
  const y = useSharedValue(0)
  useEffect(() => {
    y.value = reduced
      ? withTiming(-digit * lineH, { duration: 0 })
      : withDelay(delay, withSpring(-digit * lineH, { mass: 1, damping: 15, stiffness: 110 }))
  }, [digit, lineH, reduced])
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
  return (
    <View style={{ height: lineH, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      <Animated.View style={a}>
        {DIGITS.map(d => <Text key={d} style={[style, styles.digit]}>{d}</Text>)}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'flex-end' },
  digit: { textAlign: 'center', fontVariant: ['tabular-nums'] },
})
