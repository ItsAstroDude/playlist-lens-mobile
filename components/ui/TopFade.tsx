import React from 'react'
import { StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { useAnimatedStyle, interpolate, Extrapolation, type SharedValue } from 'react-native-reanimated'
import { Colors, alpha } from '@/constants/theme'

/**
 * Scroll-driven top fade for scroll surfaces. Invisible at rest (so nothing dims
 * the content when you're at the top), it fades IN as you scroll so list content
 * feathers out into the background as it slides up under the screen title — "phased",
 * not a hard clip. Drop it in as a sibling AFTER the scroll view inside a flex:1
 * container and feed it the list's scroll offset; it's non-interactive.
 */
export function TopFade({ scrollY, height = 44 }: { scrollY: SharedValue<number>; height?: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }))
  return (
    <Animated.View pointerEvents="none" style={[styles.fade, { height }, style]}>
      <LinearGradient colors={[Colors.background, alpha(Colors.background, 0)]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
})
