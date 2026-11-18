import React, { useEffect, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Canvas, Circle, Group, Rect, Blur } from '@shopify/react-native-skia'
import {
  useSharedValue, useDerivedValue, useFrameCallback, withTiming, interpolateColor, Easing,
} from 'react-native-reanimated'
import { useMotionReduced } from './reduced'

/**
 * Motion #1 — Album-art aurora. Four soft blobs in the playing cover's colours drift
 * behind everything and cross-fade (1 s) whenever `colors` changes.
 *
 *   <Aurora colors={palette /* 4 hex colours from the cover *\/} style={StyleSheet.absoluteFill} />
 */
export function Aurora({ colors, base = '#0d0b14', dim = 0.38, style }: {
  colors: [string, string, string, string]
  base?: string
  /** Darkening veil over the glow (0–1) so text stays readable. */
  dim?: number
  style?: StyleProp<ViewStyle>
}) {
  const reduced = useMotionReduced()
  const [box, setBox] = useState({ w: 0, h: 0 })
  const t = useSharedValue(0)
  useFrameCallback(f => { t.value = f.timeSinceFirstFrame }, !reduced)

  const from = useSharedValue<string[]>(colors)
  const to = useSharedValue<string[]>(colors)
  const mix = useSharedValue(1)
  useEffect(() => {
    // Start the fade from wherever the previous one had got to.
    const m = mix.value
    from.value = from.value.map((c, i) => interpolateColor(m, [0, 1], [c, to.value[i]]) as string)
    to.value = colors
    mix.value = 0
    mix.value = withTiming(1, { duration: reduced ? 0 : 1000, easing: Easing.inOut(Easing.ease) })
  }, [colors.join(',')])

  const blob = (i: number) => {
    const color = useDerivedValue(() => interpolateColor(mix.value, [0, 1], [from.value[i], to.value[i]]))
    const cx = useDerivedValue(() => box.w * (0.5 + 0.42 * Math.sin(t.value * 0.00027 * (1 + i * 0.33) + i * 1.9)))
    const cy = useDerivedValue(() => box.h * (0.45 + 0.4 * Math.cos(t.value * 0.00021 * (1 + i * 0.27) + i * 2.4)))
    const r = useDerivedValue(() => Math.max(box.w, box.h) * (0.32 + 0.05 * Math.sin(t.value * 0.0005 + i)))
    return { color, cx, cy, r }
  }
  const b = [blob(0), blob(1), blob(2), blob(3)]

  return (
    <View style={[styles.fill, style]} pointerEvents="none" onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={box.w} height={box.h} color={base} />
          <Group blendMode="screen" opacity={0.85}>
            {b.map((x, i) => <Circle key={i} cx={x.cx} cy={x.cy} r={x.r} color={x.color} />)}
            <Blur blur={Math.max(box.w, box.h) * 0.16} />
          </Group>
          <Rect x={0} y={0} width={box.w} height={box.h} color={`rgba(8,6,14,${dim})`} />
        </Canvas>
      )}
    </View>
  )
}

const styles = StyleSheet.create({ fill: { overflow: 'hidden' } })
