import React, { useEffect } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSequence, withTiming, withSpring } from 'react-native-reanimated'
import { rippleDelay } from './math'
import { useMotionReduced } from './reduced'
import { useSettle } from './settle'

/**
 * Motion #9 — Calendar ripple. A heatmap cell that pops in on a diagonal wave
 * (col + row) with a little overshoot. Change `trigger` to ripple again.
 *
 * `startedAt` (Date.now() when the wave began) is for grids that mount their cells
 * over a few frames: a cell mounted late skips the part of its delay that has already
 * passed, so the wave looks exactly as if every cell had mounted at once.
 *
 * Once the pop lands the cell becomes a plain View (see useSettle): same look, but it
 * no longer rides along on every commit.
 */
export function RippleCell({ col, row, style, trigger, step = 24, startedAt }: {
  col: number; row: number; style: StyleProp<ViewStyle>; trigger?: unknown; step?: number; startedAt?: number
}) {
  const reduced = useMotionReduced()
  const s = useSharedValue(reduced ? 1 : 0)
  const { settled, begin, settleNow } = useSettle(trigger)
  useEffect(() => {
    if (reduced) { s.value = 1; settleNow(); return }
    s.value = 0
    const late = startedAt ? Math.max(0, Date.now() - startedAt) : 0
    s.value = withDelay(Math.max(0, rippleDelay(col, row, step) - late), withSequence(withTiming(1.35, { duration: 260 }), withSpring(1, { damping: 9, stiffness: 240 }, begin())))
  }, [trigger, reduced])
  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value), transform: [{ scale: s.value }] }))
  if (settled) return <View style={style} />
  return <Animated.View style={[style, a]} />
}
