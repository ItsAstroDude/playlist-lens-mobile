import { useCoverActive, useTabletopActive } from '@/utils/coverMode'
import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Canvas, Circle, Blur } from '@shopify/react-native-skia'
import Animated, {
  useSharedValue, useAnimatedStyle, useFrameCallback, withTiming, Easing, runOnJS,
} from 'react-native-reanimated'
import { Colors, activeThemeMode } from '@/constants/theme'
import { useTint, type Tint } from '@/utils/liquidTint'
import { useMotionReduced } from './reduced'
import { useLiveWindow } from '@/utils/liveWindow'

// Each blob is drawn ONCE in Skia (once more per colour change, then cross-faded) and
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
  // Hidden under the cover-screen app or the tabletop Now Playing: hold still.
  const underCover = useCoverActive()
  const underTabletop = useTabletopActive()
  const coverOn = underCover || underTabletop
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))
  const { width: W, height: H } = useLiveWindow()
  const light = activeThemeMode() === 'light'
  const t = useSharedValue(Date.now() % 10_000_000)
  // The drift is a fraction of a pixel per frame, so 20 updates a second looks the same
  // as 60 at a third of the work.
  useFrameCallback(() => {
    const now = Date.now() % 10_000_000
    if (Math.abs(now - t.value) >= 50) t.value = now
  }, focused && !reduced && !coverOn)

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.background }]} pointerEvents="none">
      {ORBITS.map((o, i) => <Blob key={i} i={i} o={o} t={t} tint={tint} W={W} H={H} light={light} focused={focused} />)}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: light ? 'rgba(246,245,248,0.35)' : 'rgba(10,8,16,0.42)' }]} />
    </View>
  )
}

function Blob({ i, o, t, tint, W, H, light, focused }: {
  i: number; o: typeof ORBITS[number]; t: { value: number }; tint: Tint; W: number; H: number; light: boolean; focused: boolean
}) {
  const size = Math.max(W, H) * o.r
  const cx = CENTERS[i][0] * W - size / 2, cy = CENTERS[i][1] * H - size / 2
  // Colour change (1 s): the old colour's drawing stays, the new one fades in over it —
  // an opacity change only, no Skia redraw per frame (2.0.17: redrawing four big blurs
  // every frame on every open screen was the lag when the song changed). Screens you
  // can't see switch instantly.
  const [layers, setLayers] = useState<{ under: string; over: string }>({ under: tint[i], over: tint[i] })
  const fade = useSharedValue(1)
  useEffect(() => {
    if (tint[i] === layers.over) return
    if (!focused) { setLayers({ under: tint[i], over: tint[i] }); fade.value = 1; return }
    setLayers({ under: layers.over, over: tint[i] })
    fade.value = 0
    fade.value = withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }, done => {
      if (done) runOnJS(setLayers)({ under: tint[i], over: tint[i] })
    })
  }, [tint[i]])
  const move = useAnimatedStyle(() => ({
    transform: [
      { translateX: cx + Math.sin(t.value * o.sx + o.px) * W * o.ax },
      { translateY: cy + Math.cos(t.value * o.sy + o.py) * H * o.ay },
      { scale: 1 + 0.08 * Math.sin(t.value * 0.0004 + i) },
    ],
  }))
  const fadeIn = useAnimatedStyle(() => ({ opacity: fade.value }))
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size, opacity: light ? 0.32 : 0.62 }, move]}>
      <BlobCanvas size={size} color={layers.under} />
      {layers.over !== layers.under && (
        <Animated.View style={[StyleSheet.absoluteFill, fadeIn]}>
          <BlobCanvas size={size} color={layers.over} />
        </Animated.View>
      )}
    </Animated.View>
  )
}

/** One blurred circle, drawn once per colour (memoised: moving it never redraws it). */
const BlobCanvas = React.memo(function BlobCanvas({ size, color }: { size: number; color: string }) {
  return (
    <Canvas style={{ width: size, height: size, position: 'absolute' }}>
      <Circle cx={size / 2} cy={size / 2} r={size * 0.3} color={color}>
        <Blur blur={size * 0.12} />
      </Circle>
    </Canvas>
  )
})
