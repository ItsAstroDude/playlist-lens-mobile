import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming, runOnJS, interpolate,
} from 'react-native-reanimated'
import { useMotionReduced } from './reduced'

export interface Rect { x: number; y: number; w: number; h: number }
export interface Flight { key: number; uri?: string; from: Rect; to: Rect; fromRadius?: number; toRadius?: number }

/**
 * Motion #5 — Card opens into the lens. The tapped card's cover flies from where it
 * sat to where the opening screen shows it (window coordinates), landing as that screen
 * arrives, then fades so the real cover takes over. Mount it at screen root, above the
 * sheet it opens.
 */
export function CoverFlight({ flight, onLanded, onDone }: {
  flight: Flight | null
  /** The flight has arrived: show the real cover now (the flight then fades over it). */
  onLanded?: () => void
  onDone: () => void
}) {
  const reduced = useMotionReduced()
  const p = useSharedValue(0)
  const fade = useSharedValue(1)

  useEffect(() => {
    if (!flight) return
    if (reduced) { onLanded?.(); onDone(); return }
    p.value = 0; fade.value = 1
    p.value = withSpring(1, { mass: 1, damping: 20, stiffness: 150, overshootClamping: false })
    // Land → reveal the real cover underneath → only then fade the flying copy.
    const t = setTimeout(() => onLanded?.(), 470)
    fade.value = withDelay(520, withTiming(0, { duration: 180 }, done => { if (done) runOnJS(onDone)() }))
    return () => clearTimeout(t)
  }, [flight?.key])

  const style = useAnimatedStyle(() => {
    if (!flight) return { opacity: 0 }
    const f = flight.from, t = flight.to, k = p.value
    return {
      opacity: fade.value,
      left: interpolate(k, [0, 1], [f.x, t.x]),
      top: interpolate(k, [0, 1], [f.y, t.y]),
      width: interpolate(k, [0, 1], [f.w, t.w]),
      height: interpolate(k, [0, 1], [f.h, t.h]),
      borderRadius: interpolate(k, [0, 1], [flight.fromRadius ?? 28, flight.toRadius ?? 28]),
    }
  })

  if (!flight || reduced) return null
  return (
    <Animated.View pointerEvents="none" style={[styles.flight, style]}>
      {flight.uri ? <Image source={{ uri: flight.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  flight: {
    position: 'absolute', zIndex: 40, overflow: 'hidden', backgroundColor: '#1d1d22',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 24,
  },
})
