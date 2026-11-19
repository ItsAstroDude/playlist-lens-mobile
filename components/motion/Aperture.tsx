import React, { useEffect } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedProps, withRepeat, withTiming, withSpring, Easing, cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated'
import { apertureGeometry } from './math'
import { useMotionReduced } from './reduced'
import { useMotionClock } from './clock'

const APath = Animated.createAnimatedComponent(Path)
const ARect = Animated.createAnimatedComponent(Rect)

/**
 * Motion #8 — the playlist.lens aperture, alive. Six blades close as `close` goes 0 → 1
 * (pull-to-refresh), spin while `loading`, then spring open; the equalizer inside
 * bounces once it's open. Also the splash / loading mark.
 *
 *   <Aperture size={72} close={pullProgress} loading={refreshing} />
 */
export function Aperture({ size = 96, close, loading = false, colors = ['#9BF7B2', '#53E076', '#1E9E4A'], cut = '#0d0b14', label = 'Loading' }: {
  size?: number
  close?: SharedValue<number>
  loading?: boolean
  colors?: [string, string, string]
  /** The surface colour behind the mark (the blade gaps show it). */
  cut?: string
  label?: string
}) {
  const reduced = useMotionReduced()
  const R = size / 2 - 1, c = size / 2
  const rot = useSharedValue(0)
  const pulse = useSharedValue(1)        // 1 = fully open (when not pulled)
  const t = useMotionClock(!reduced)

  useEffect(() => {
    if (reduced) return
    if (loading) {
      rot.value = withRepeat(withTiming(rot.value + Math.PI * 2, { duration: 1100, easing: Easing.linear }), -1)
      pulse.value = withRepeat(withTiming(0.35, { duration: 550, easing: Easing.inOut(Easing.ease) }), -1, true)
    } else {
      cancelAnimation(rot); cancelAnimation(pulse)
      pulse.value = withSpring(1, { damping: 7, stiffness: 140 })
    }
  }, [loading, reduced])

  const openOf = () => {
    'worklet'
    const pulled = close ? 1 - Math.min(1, Math.max(0, close.value)) * 0.94 : 1
    return Math.min(pulled, pulse.value)
  }
  const sepsProps = useAnimatedProps(() => ({ d: apertureGeometry(c, c, R, openOf(), rot.value + (close ? close.value * 0.8 : 0)).seps }))
  const irisProps = useAnimatedProps(() => ({ d: apertureGeometry(c, c, R, openOf(), rot.value + (close ? close.value * 0.8 : 0)).iris }))
  const bar = (i: number, k: number) => useAnimatedProps(() => {
    const g = apertureGeometry(c, c, R, openOf(), 0), r = g.r, open = openOf()
    const live = open > 0.85 ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t.value * 0.012 + i * 1.9)) : 0.55
    const h = r > R * 0.22 ? r * 0.9 * k * live : 0
    const w = r * 0.18, gap = r * 0.12
    return { x: c + (i - 1) * (w + gap) - w / 2, y: c + r * 0.45 - h, width: w, height: h, rx: w / 2 }
  })
  const b0 = bar(0, 0.6), b1 = bar(1, 1), b2 = bar(2, 0.75)

  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: loading }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ap" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} /><Stop offset="0.45" stopColor={colors[1]} /><Stop offset="1" stopColor={colors[2]} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={R} fill="url(#ap)" />
        <APath animatedProps={sepsProps} stroke={cut} strokeWidth={Math.max(2, R * 0.075)} strokeLinecap="round" />
        <APath animatedProps={irisProps} fill="#0c0c0f" stroke={cut} strokeWidth={Math.max(2, R * 0.075)} strokeLinejoin="round" />
        <ARect animatedProps={b0} fill={colors[1]} />
        <ARect animatedProps={b1} fill={colors[1]} />
        <ARect animatedProps={b2} fill={colors[1]} />
      </Svg>
    </View>
  )
}
