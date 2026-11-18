import React, { useEffect } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSpring } from 'react-native-reanimated'
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
 * Liquid (2.0) — a glass bubble that pops in and then holds still. (It used to bob
 * forever; endless motion on a scrolling screen makes Android recomposite every frame
 * through the glass and the aurora, which is what made Wrapped lag.)
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
  useEffect(() => {
    if (reduced) return
    pop.value = withDelay(delay, withSpring(1, { mass: 0.8, damping: 9, stiffness: 140 }))
  }, [reduced])
  const shape = SHAPES[phase % SHAPES.length]
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.5),
    transform: [{ scale: pop.value }],
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
