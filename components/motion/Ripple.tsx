import React, { useEffect } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSequence, withTiming, withSpring } from 'react-native-reanimated'
import { rippleDelay } from './math'
import { useMotionReduced } from './reduced'

/**
 * Motion #9 — Calendar ripple. A heatmap cell that pops in on a diagonal wave
 * (col + row) with a little overshoot. Change `trigger` to ripple again.
 */
export function RippleCell({ col, row, style, trigger, step = 24 }: {
  col: number; row: number; style: StyleProp<ViewStyle>; trigger?: unknown; step?: number
}) {
  const reduced = useMotionReduced()
  const s = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) { s.value = 1; return }
    s.value = 0
    s.value = withDelay(rippleDelay(col, row, step), withSequence(withTiming(1.35, { duration: 260 }), withSpring(1, { damping: 9, stiffness: 240 })))
  }, [trigger, reduced])
  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value), transform: [{ scale: s.value }] }))
  return <Animated.View style={[style, a]} />
}
