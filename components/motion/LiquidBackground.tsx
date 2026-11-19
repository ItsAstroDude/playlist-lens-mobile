import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Canvas, Circle, Blur } from '@shopify/react-native-skia'
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue, useFrameCallback, withTiming, interpolateColor, Easing,
} from 'react-native-reanimated'
import { Colors, activeThemeMode } from '@/constants/theme'
import { useTint, type Tint } from '@/utils/liquidTint'
import { useMotionReduced } from './reduced'

// Each blob is drawn ONCE in Skia (redrawn only while its colour cross-fades) and
// drifts by transform on the UI thread — far cheaper than redrawing a blurred scene
// every frame. Positions come from one wall clock, so every screen's background is in
// the same phase and switching tabs doesn't jump.
const ORBITS = [
  { ax: 0.30, ay: 0.20, sx: 0.00021, sy: 0.00017, px: 0.0, py: 1.1, r: 0.62 },
  { ax: 0.34, ay: 0.26, sx: 0.00016, sy: 0.00023, px: 2.1, py: 0.3, r: 0.55 },
  { ax: 0.28, ay: 0.30, sx: 0.00019, sy: 0.00014, px: 4.0, py: 2.6, r: 0.5 },
  { ax: 0.36, ay: 0.18, sx: 0.00013, sy: 0.00020, px: 5.2, py: 4.4, r: 0.46 },
]
const CENTERS = [[0.25, 0.18], [0.8, 0.35], [0.3, 0.72], [0.78, 0.86]]

/**
 * Liquid (2.0) — the app's background: an aurora in the playing song's colours behind
 * every screen. Opaque (paints the base colour itself). Pauses when its screen isn't
 * focused; holds still under Reduce motion.
 */
export function LiquidBackground() {
  const tint = useTint()
  const reduced = useMotionReduced()
  const [focused, setFocused] = useState(true)
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))
  const { width: W, height: H } = useWindowDimensions()
  const light = activeThemeMode() === 'light'
  const t = useSharedValue(Date.now() % 10_000_000)
  // The drift is a fraction of a pixel per frame, so 20 updates a second looks the same
  // as 60 at a third of the work.
  useFrameCallback(() => {
    const now = Date.now() % 10_000_000
    if (Math.abs(now - t.value) >= 50) t.value = now
  }, focused && !reduced)

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.background }]} pointerEvents="none">
      {ORBITS.map((o, i) => <Blob key={i} i={i} o={o} t={t} tint={tint} W={W} H={H} light={light} />)}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: light ? 'rgba(246,245,248,0.35)' : 'rgba(10,8,16,0.42)' }]} />
    </View>
  )
}

function Blob({ i, o, t, tint, W, H, light }: {
  i: number; o: typeof ORBITS[number]; t: { value: number }; tint: Tint; W: number; H: number; light: boolean
}) {
  const size = Math.max(W, H) * o.r
  const cx = CENTERS[i][0] * W - size / 2, cy = CENTERS[i][1] * H - size / 2
  // colour cross-fade (1 s) when the tint changes
  const from = useSharedValue(tint[i]), to = useSharedValue(tint[i]), mix = useSharedValue(1)
  useEffect(() => {
    from.value = interpolateColor(mix.value, [0, 1], [from.value, to.value]) as string
    to.value = tint[i]
    mix.value = 0
    mix.value = withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
  }, [tint[i]])
  const color = useDerivedValue(() => interpolateColor(mix.value, [0, 1], [from.value, to.value]))
  const move = useAnimatedStyle(() => ({
    transform: [
      { translateX: cx + Math.sin(t.value * o.sx + o.px) * W * o.ax },
      { translateY: cy + Math.cos(t.value * o.sy + o.py) * H * o.ay },
      { scale: 1 + 0.08 * Math.sin(t.value * 0.0004 + i) },
    ],
  }))
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size, opacity: light ? 0.32 : 0.62 }, move]}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={size / 2} cy={size / 2} r={size * 0.3} color={color}>
          <Blur blur={size * 0.12} />
        </Circle>
      </Canvas>
    </Animated.View>
  )
}
