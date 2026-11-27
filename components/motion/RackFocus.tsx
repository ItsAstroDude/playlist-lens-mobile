import React, { useEffect, useState } from 'react'
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing } from 'react-native-reanimated'
import { useMotionReduced } from './reduced'
import { useSettle } from './settle'

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
export function RackFocus({ index = 0, children, style, trigger, step = 90, blur: withBlur = false, settle: canSettle = false }: {
  index?: number
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Any value; changing it replays the entrance. */
  trigger?: unknown
  step?: number
  /** Real blur (Android 12+). Costs a few re-renders per row — use on short lists only. */
  blur?: boolean
  /** Become a plain View once in focus (see useSettle). Re-mounts the children once, so
   *  only for children with no entrance of their own (it would replay). For long-lived
   *  lists: Wrapped keeps dozens of these mounted for the life of the tab. */
  settle?: boolean
}) {
  const reduced = useMotionReduced()
  const p = useSharedValue(reduced ? 1 : 0)
  const useBlur = withBlur && BLUR_OK && !reduced
  const [blur, setBlur] = useState(useBlur ? BLUR_STEPS[0] : 0)
  const { settled, begin, settleNow } = useSettle(trigger)

  useEffect(() => {
    if (reduced) { p.value = 1; setBlur(0); if (canSettle) settleNow(); return }
    const delay = index * step
    p.value = 0
    p.value = withDelay(delay, withTiming(1, { duration: 720, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }, canSettle ? begin() : undefined))
    if (!useBlur) return
    setBlur(BLUR_STEPS[0])
    const timers = BLUR_STEPS.slice(1).map((b, i) => setTimeout(() => setBlur(b), delay + 110 * (i + 1)))
    return () => timers.forEach(clearTimeout)
  }, [trigger, reduced])

  const a = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 18 }, { scale: 0.97 + 0.03 * p.value }],
  }))
  // Landed (p = 1, blur stepped to 0): opacity 1, translateY 0, scale 1 — the plain style.
  if (canSettle && settled && blur === 0) return <View style={style}>{children}</View>
  return (
    <Animated.View style={[style, a, blur > 0 ? ({ filter: [{ blur }] } as ViewStyle) : null]}>
      {children}
    </Animated.View>
  )
}
