import React, { useEffect, useRef, useState } from 'react'
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming, Easing, interpolate, runOnJS, type SharedValue,
} from 'react-native-reanimated'
import { haptic } from '@/constants/animation'
import { burstVectors } from './math'
import { useMotionReduced } from './reduced'

const COUNT = 14

/**
 * Motion #2 — Save burst. The icon springs, a ring pulses out and confetti bursts around
 * it when `active` turns on (not on mount, not when turning off).
 *
 *   <SaveBurst active={saved} onPress={toggle} colors={[accent, …]} label="Save">
 *     {saved ? <Icon name="heart" … /> : <Icon name="heart-outline" … />}
 *   </SaveBurst>
 */
export function SaveBurst({ active, onPress, children, colors, size = 48, distance = 46, label, style }: {
  active: boolean
  onPress: () => void
  children: React.ReactNode
  colors: string[]
  size?: number
  distance?: number
  label: string
  style?: StyleProp<ViewStyle>
}) {
  const reduced = useMotionReduced()
  const scale = useSharedValue(1)
  const burst = useSharedValue(0)
  const was = useRef(active)
  const vecs = useRef(burstVectors(COUNT, distance)).current
  // The ring + particles are mounted only for the burst itself. Idle, a SaveBurst is
  // just the icon — a list of add-to-queue buttons doesn't carry ~15 animated views each.
  const [bursting, setBursting] = useState(false)

  useEffect(() => {
    const turnedOn = active && !was.current
    was.current = active
    if (reduced) return
    if (turnedOn) {
      haptic.success()
      scale.value = withSequence(withTiming(0.6, { duration: 90 }), withSpring(1.3, { damping: 6, stiffness: 320 }), withSpring(1, { damping: 10, stiffness: 220 }))
      burst.value = 0
      setBursting(true)
      burst.value = withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }, done => { if (done) runOnJS(setBursting)(false) })
    } else if (!active) {
      scale.value = withSequence(withTiming(0.8, { duration: 110 }), withSpring(1, { damping: 12, stiffness: 260 }))
    }
  }, [active, reduced])

  const icon = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const ring = useAnimatedStyle(() => ({
    opacity: burst.value > 0 && burst.value < 1 ? interpolate(burst.value, [0, 0.7], [1, 0], 'clamp') : 0,
    transform: [{ scale: interpolate(burst.value, [0, 0.7], [0.5, 1.9], 'clamp') }],
    borderWidth: interpolate(burst.value, [0, 0.7], [5, 1], 'clamp'),
  }))

  return (
    <Pressable
      onPress={onPress} hitSlop={8}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}
    >
      {bursting && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: colors[0] }, ring]} />
          {vecs.map((v, i) => <Particle key={i} p={burst} x={v.x} y={v.y} color={colors[i % colors.length]} size={size} chip={i % 3 === 0} />)}
        </View>
      )}
      <Animated.View style={icon}>{children}</Animated.View>
    </Pressable>
  )
}

function Particle({ p, x, y, color, size, chip }: { p: SharedValue<number>; x: number; y: number; color: string; size: number; chip: boolean }) {
  const a = useAnimatedStyle(() => {
    const t = p.value
    return {
      opacity: t > 0 && t < 1 ? 1 - t : 0,
      transform: [{ translateX: x * t }, { translateY: y * t }, { scale: 1 - t * 0.8 }, { rotate: `${t * 240}deg` }],
    }
  })
  return <Animated.View style={[{ position: 'absolute', left: size / 2 - 4, top: size / 2 - (chip ? 2 : 4), width: chip ? 10 : 8, height: chip ? 4 : 8, borderRadius: chip ? 2 : 4, backgroundColor: color }, a]} />
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', left: 0, top: 0 },
})
