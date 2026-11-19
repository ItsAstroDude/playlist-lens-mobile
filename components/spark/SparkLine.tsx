import React, { useEffect } from 'react'
import { Text, StyleSheet, View, AccessibilityInfo } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated'
import { useMotionReduced } from '@/components/motion/reduced'
import { Spark, SPARK, type SparkMood } from './Spark'

export const LINE_MS = 4500

/**
 * Spark saying one line: a small talking Spark and a dark-glass bubble (Outfit 500,
 * cream). Pops in on a spring, leaves on its own after ~4.5 s (`onDone`).
 */
export function SparkLine({ line, mood = 'talking', onDone, showSpark = true }: {
  line: string
  mood?: SparkMood
  onDone?: () => void
  showSpark?: boolean
}) {
  const reduced = useMotionReduced()
  const v = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Spark: ${line}`)
    const done = () => onDone?.()
    v.value = reduced ? 1 : withSpring(1, { mass: 0.6, damping: 11, stiffness: 220 })
    const t = setTimeout(() => {
      v.value = withTiming(0, { duration: reduced ? 1 : 220 }, fin => { if (fin) runOnJS(done)() })
    }, LINE_MS)
    return () => clearTimeout(t)
  }, [line])
  const pop = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.value * 1.5),
    transform: [{ translateY: (1 - v.value) * 6 }, { scale: 0.9 + 0.1 * v.value }],
  }))
  return (
    <Animated.View style={[styles.row, pop]} accessible accessibilityLabel={`Spark: ${line}`} accessibilityLiveRegion="polite">
      {showSpark && <Spark mood={mood} size={28} />}
      <View style={styles.bubble}>
        <Text style={styles.text}>{line}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  bubble: {
    flexShrink: 1,
    backgroundColor: 'rgba(21,25,38,0.72)',
    borderColor: 'rgba(255,194,61,0.28)', borderWidth: 1,
    borderRadius: 16, borderTopLeftRadius: 6,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  text:   { fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 18, color: SPARK.cream },
})
