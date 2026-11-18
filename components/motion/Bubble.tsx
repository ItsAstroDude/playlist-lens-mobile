import React, { useCallback } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useFocusEffect } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, withSpring, Easing, cancelAnimation,
} from 'react-native-reanimated'
import { useMotionReduced } from './reduced'

// Fixed blobby corner radii (fractions of the size), one set per bubble. Animating
// radii redraws the view every frame on Android, so the shape holds still and only
// the cheap transform (bob) moves.
const SHAPES = [
  [0.48, 0.52, 0.39, 0.61],
  [0.61, 0.39, 0.58, 0.42],
  [0.38, 0.62, 0.45, 0.55],
]

/**
 * Liquid (2.0) — a floating glass bubble: pops in, then bobs gently while its screen
 * is in view (paused otherwise). Used for Wrapped's headline numbers.
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
  const bob = useSharedValue(0)
  useFocusEffect(useCallback(() => {
    if (reduced) return
    pop.value = withDelay(delay, withSpring(1, { mass: 0.8, damping: 9, stiffness: 140 }))
    bob.value = withDelay(phase * 400, withRepeat(withTiming(1, { duration: 3600 + phase * 500, easing: Easing.inOut(Easing.ease) }), -1, true))
    return () => { cancelAnimation(bob) }
  }, [reduced]))
  const shape = SHAPES[phase % SHAPES.length]
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.5),
    transform: [{ translateY: (bob.value - 0.5) * 10 }, { scale: pop.value }],
  }))
  return (
    <Animated.View style={[
      styles.b,
      {
        width: size, height: size, backgroundColor: color,
        borderTopLeftRadius: size * shape[0], borderTopRightRadius: size * shape[1],
        borderBottomRightRadius: size * shape[2], borderBottomLeftRadius: size * shape[3],
      },
      style, a,
    ]}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  b: { position: 'absolute', alignItems: 'center', justifyContent: 'center', padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
})
