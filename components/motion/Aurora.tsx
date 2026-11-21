import React, { useEffect, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Canvas, Circle, Blur } from '@shopify/react-native-skia'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS, type SharedValue,
} from 'react-native-reanimated'
import { useMotionReduced } from './reduced'
import { useMotionClock } from './clock'

/**
 * Motion #1 — Album-art aurora. Four soft blobs in the playing cover's colours drift
 * behind everything and cross-fade (1 s) whenever `colors` changes.
 *
 *   <Aurora colors={palette /* 4 hex colours from the cover *\/} style={StyleSheet.absoluteFill} />
 *
 * 2.0.17 — same paths, sizes, blur and "screen" blend, far less work. It used to redraw
 * a full-screen blur of all four circles on every frame (60×/s), which with a story's
 * music decoding alongside made the background stutter. Now each blob is drawn once
 * (small, then scaled up — a blur scales up looking the same) and only moved and scaled
 * on the UI thread; a colour change fades the new drawing in over the old one.
 */

/** Blobs are drawn at a quarter of their on-screen size and scaled ×4. */
const K = 0.25
/** Base radius and blur, as shares of the box's longer side (as before). */
const R0 = 0.32
const SIGMA = 0.16

export function Aurora({ colors, base = '#0d0b14', dim = 0.38, style }: {
  colors: [string, string, string, string]
  base?: string
  /** Darkening veil over the glow (0–1) so text stays readable. */
  dim?: number
  style?: StyleProp<ViewStyle>
}) {
  const reduced = useMotionReduced()
  const [box, setBox] = useState({ w: 0, h: 0 })
  const t = useMotionClock(!reduced)

  // Colour change: the old drawing stays under, the new one fades in over it.
  const key = colors.join(',')
  const [layers, setLayers] = useState({ under: colors, over: colors })
  const fade = useSharedValue(1)
  useEffect(() => {
    if (key === layers.over.join(',')) return
    if (reduced) { setLayers({ under: colors, over: colors }); return }
    setLayers({ under: layers.over, over: colors })
    fade.value = 0
    fade.value = withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }, done => {
      if (done) runOnJS(setLayers)({ under: colors, over: colors })
    })
  }, [key])

  const side = Math.max(box.w, box.h)
  return (
    <View
      style={[styles.fill, { backgroundColor: base }, style]}
      pointerEvents="none"
      onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 && [0, 1, 2, 3].map(i => (
        <Blob key={i} i={i} t={t} box={box} side={side} under={layers.under[i]} over={layers.over[i]} fade={fade} />
      ))}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(8,6,14,${dim})` }]} />
    </View>
  )
}

function Blob({ i, t, box, side, under, over, fade }: {
  i: number; t: SharedValue<number>; box: { w: number; h: number }; side: number
  under: string; over: string; fade: SharedValue<number>
}) {
  // The drawing: base radius plus 3σ of blur on each side, at a quarter size.
  const c = Math.ceil((R0 + 0.05 + 3 * SIGMA) * side * 2 * K)
  const r0 = side * R0
  const move = useAnimatedStyle(() => {
    // The same paths as before: centre, and a radius that breathes ±0.05.
    const cx = box.w * (0.5 + 0.42 * Math.sin(t.value * 0.00027 * (1 + i * 0.33) + i * 1.9))
    const cy = box.h * (0.45 + 0.4 * Math.cos(t.value * 0.00021 * (1 + i * 0.27) + i * 2.4))
    const r = side * (R0 + 0.05 * Math.sin(t.value * 0.0005 + i))
    return { transform: [{ translateX: cx - c / 2 }, { translateY: cy - c / 2 }, { scale: (r / r0) / K }] }
  })
  const fadeIn = useAnimatedStyle(() => ({ opacity: fade.value }))
  return (
    <Animated.View style={[styles.blob, { width: c, height: c }, move]}>
      <BlobCanvas size={c} r={r0 * K} sigma={side * SIGMA * K} color={under} />
      {over !== under && (
        <Animated.View style={[StyleSheet.absoluteFill, fadeIn]}>
          <BlobCanvas size={c} r={r0 * K} sigma={side * SIGMA * K} color={over} />
        </Animated.View>
      )}
    </Animated.View>
  )
}

/** One blurred circle, drawn once per colour (memoised: moving it never redraws it). */
const BlobCanvas = React.memo(function BlobCanvas({ size, r, sigma, color }: { size: number; r: number; sigma: number; color: string }) {
  return (
    <Canvas style={{ width: size, height: size, position: 'absolute' }}>
      <Circle cx={size / 2} cy={size / 2} r={r} color={color}>
        <Blur blur={sigma} />
      </Circle>
    </Canvas>
  )
})

const styles = StyleSheet.create({
  // isolate: the blobs "screen"-blend with each other and the base, not with what's
  // behind the aurora.
  fill: { overflow: 'hidden', isolation: 'isolate' },
  blob: { position: 'absolute', left: 0, top: 0, opacity: 0.85, mixBlendMode: 'screen' },
})
