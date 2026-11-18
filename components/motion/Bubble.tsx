import React, { useEffect } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, withSpring, Easing, interpolate,
} from 'react-native-reanimated'
import { useMotionReduced } from './reduced'

// Corner radii (as fractions of the size) the bubble morphs between.
const SHAPES = [
  [0.48, 0.52, 0.39, 0.61],
  [0.61, 0.39, 0.58, 0.42],
  [0.38, 0.62, 0.45, 0.55],
]

/**
 * Liquid (2.0) — a floating glass bubble: pops in, then bobs and slowly changes shape.
 * Used for Wrapped's headline numbers.
 */
export function Bubble({ size, color, delay = 0, phase = 0, style, children }: {
  size: number
  color: string
  delay?: number
  phase?: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  const reduced = useMotionReduced()
  const pop = useSharedValue(reduced ? 1 : 0)
  const m = useSharedValue(0)
  const bob = useSharedValue(0)
  useEffect(() => {
    if (reduced) return
    pop.value = withDelay(delay, withSpring(1, { mass: 0.8, damping: 9, stiffness: 140 }))
    m.value = withRepeat(withTiming(2, { duration: 9000 + phase * 1300, easing: Easing.inOut(Easing.ease) }), -1, true)
    bob.value = withDelay(phase * 600, withRepeat(withTiming(1, { duration: 3600 + phase * 500, easing: Easing.inOut(Easing.ease) }), -1, true))
  }, [reduced])
  const a = useAnimatedStyle(() => {
    const r = (k: number) => size * interpolate(m.value, [0, 1, 2], [SHAPES[0][k], SHAPES[1][k], SHAPES[2][k]])
    return {
      borderTopLeftRadius: r(0), borderTopRightRadius: r(1), borderBottomRightRadius: r(2), borderBottomLeftRadius: r(3),
      opacity: Math.min(1, pop.value * 1.5),
      transform: [{ translateY: (bob.value - 0.5) * 10 }, { scale: pop.value }],
    }
  })
  return (
    <Animated.View style={[styles.b, { width: size, height: size, backgroundColor: color, borderRadius: size / 2 }, style, a]}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  b: { position: 'absolute', alignItems: 'center', justifyContent: 'center', padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
})
