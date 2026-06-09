import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing,
} from 'react-native-reanimated'
import { Colors } from '@/constants/theme'
import { reduceMotionEnabled } from '@/utils/settings'

/**
 * Ambient glow background — violet (top-left) + pink (bottom-right) blobs that
 * slowly drift & breathe, plus a green aurora at the top. Reusable across screens
 * so the whole app feels alive. Pure decoration → pointerEvents none.
 * Honours Reduce-motion: blobs sit still (no drift/breathe) when it's on.
 */
export function AmbientBackground() {
  const vX = useSharedValue(0); const vY = useSharedValue(0); const vS = useSharedValue(1)
  const pX = useSharedValue(0); const pY = useSharedValue(0); const pS = useSharedValue(1)

  useEffect(() => {
    if (reduceMotionEnabled()) return // still, no animation
    const drift = (to: number, dur: number) =>
      withRepeat(withSequence(
        withTiming(to,  { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(-to, { duration: dur, easing: Easing.inOut(Easing.ease) }),
      ), -1, true)
    vX.value = drift(26, 9000)
    vY.value = drift(20, 11000)
    vS.value = withRepeat(withSequence(
      withTiming(1.12, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      withTiming(1.0,  { duration: 8000, easing: Easing.inOut(Easing.ease) }),
    ), -1, true)
    pX.value = drift(30, 12000)
    pY.value = drift(24, 10000)
    pS.value = withRepeat(withSequence(
      withTiming(1.15, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
      withTiming(1.0,  { duration: 9000, easing: Easing.inOut(Easing.ease) }),
    ), -1, true)
  }, [])

  const violetStyle = useAnimatedStyle(() => ({ transform: [{ translateX: vX.value }, { translateY: vY.value }, { scale: vS.value }] }))
  const pinkStyle   = useAnimatedStyle(() => ({ transform: [{ translateX: pX.value }, { translateY: pY.value }, { scale: pS.value }] }))

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.violet, violetStyle]} />
      <Animated.View style={[styles.pink, pinkStyle]} />
      <LinearGradient
        colors={[Colors.auroraTop, Colors.auroraBot]}
        style={styles.aurora}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  violet: { position: 'absolute', top: -90, left: -90, width: 320, height: 320, borderRadius: 160, backgroundColor: Colors.violetGlow },
  pink:   { position: 'absolute', bottom: -110, right: -90, width: 280, height: 280, borderRadius: 140, backgroundColor: Colors.pinkGlow },
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
})
