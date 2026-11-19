import React, { useEffect, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Canvas, Path, Group, Circle, Skia } from '@shopify/react-native-skia'
import { useSharedValue, useDerivedValue, withSpring, withSequence, withTiming } from 'react-native-reanimated'
import { waveY } from './math'
import { useMotionReduced } from './reduced'
import { useMotionClock } from './clock'

/**
 * Motion #7 — Liquid fill. A round gauge that fills like a glass: two waves slosh at
 * different speeds while the level moves, then settle. Put the label in `children`
 * (a RollingNumber reads well).
 *
 *   <LiquidFill progress={0.62} size={180} color={accent}><RollingNumber value="62%" … /></LiquidFill>
 */
export function LiquidFill({ progress, size = 180, color = '#53e076', track = 'rgba(255,255,255,0.10)', children, label }: {
  progress: number
  size?: number
  color?: string
  track?: string
  children?: React.ReactNode
  label?: string
}) {
  const reduced = useMotionReduced()
  const level = useSharedValue(0)
  const amp = useSharedValue(1)
  const t = useMotionClock(!reduced)

  useEffect(() => {
    const p = Math.max(0, Math.min(1, progress))
    if (reduced) { level.value = p; amp.value = 0.2; return }
    level.value = withSpring(p, { damping: 22, stiffness: 28, mass: 1 })
    amp.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0.3, { duration: 2600 }))
  }, [progress, reduced])

  const R = size / 2 - 6, cx = size / 2, cy = size / 2
  const clip = useMemo(() => { const p = Skia.Path.Make(); p.addCircle(cx, cy, R); return p }, [size])
  const wave = (speed: number, scale: number, offset: number) => useDerivedValue(() => {
    const p = Skia.Path.Make()
    const base = cy + R - level.value * 2 * R
    const a = 7 * amp.value * scale, ph = t.value * speed + offset
    p.moveTo(cx - R, cy + R + 2)
    for (let x = cx - R; x <= cx + R; x += 4) p.lineTo(x, waveY(x, base, a, ph))
    p.lineTo(cx + R, cy + R + 2)
    p.close()
    return p
  })
  const back = wave(0.0026, 0.6, 1.3)
  const front = wave(-0.0018, 1, 0)

  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={R + 5} color={color} style="stroke" strokeWidth={2} opacity={0.35} />
        <Group clip={clip}>
          <Circle cx={cx} cy={cy} r={R} color={track} />
          <Path path={back} color={color} opacity={0.45} />
          <Path path={front} color={color} opacity={0.95} />
        </Group>
      </Canvas>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } })
