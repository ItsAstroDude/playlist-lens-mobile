import React, { useEffect, useState } from 'react'
import { Platform, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing } from 'react-native-reanimated'
import { useMotionReduced } from './reduced'

// Blur can't be animated on the UI thread in React Native, so the focus pull steps the
// static `filter` blur (Android 12+) a few times while opacity/scale/position glide.
const BLUR_OK = Platform.OS === 'android' && (Platform.Version as number) >= 31
const BLUR_STEPS = [10, 6, 3, 1, 0]

/**
 * Motion #11 — Rack focus. Children arrive out of focus and sharpen, one after another,
 * like a lens pulling focus. Change `trigger` to play it again.
 *
 *   {rows.map((r, i) => <RackFocus key={r.id} index={i}><Row … /></RackFocus>)}
 */
export function RackFocus({ index = 0, children, style, trigger, step = 90, blur: withBlur = false }: {
  index?: number
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Any value; changing it replays the entrance. */
  trigger?: unknown
  step?: number
  /** Real blur (Android 12+). Costs a few re-renders per row — use on short lists only. */
  blur?: boolean
}) {
  const reduced = useMotionReduced()
  const p = useSharedValue(reduced ? 1 : 0)
  const useBlur = withBlur && BLUR_OK && !reduced
  const [blur, setBlur] = useState(useBlur ? BLUR_STEPS[0] : 0)

  useEffect(() => {
    if (reduced) { p.value = 1; setBlur(0); return }
    const delay = index * step
    p.value = 0
    p.value = withDelay(delay, withTiming(1, { duration: 720, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }))
    if (!useBlur) return
    setBlur(BLUR_STEPS[0])
    const timers = BLUR_STEPS.slice(1).map((b, i) => setTimeout(() => setBlur(b), delay + 110 * (i + 1)))
    return () => timers.forEach(clearTimeout)
  }, [trigger, reduced])

  const a = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 18 }, { scale: 0.97 + 0.03 * p.value }],
  }))
  return (
    <Animated.View style={[style, a, blur > 0 ? ({ filter: [{ blur }] } as ViewStyle) : null]}>
      {children}
    </Animated.View>
  )
}
