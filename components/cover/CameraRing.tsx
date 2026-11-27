import React, { useEffect, useMemo, useState } from 'react'
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Canvas, Path, Circle, RoundedRect, BlurMask, Group, Skia } from '@shopify/react-native-skia'
import { useAnimatedReaction, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useMotionReduced } from '@/components/motion/reduced'
import { useMotionClock } from '@/components/motion/clock'
import { perimeter, pointAt, stadium, type CameraOutline } from './outline'

/** How far outside the glass the ring runs, and how far the pulses travel (dp). */
const GAP = 7
const PULSE_SPREAD = 26
const PULSE_PERIOD_MS = 1700
const PULSES = 3
const STROKE = 3.5
/** Paused: breathe this long, then hold still (no frame work while idle). */
const IDLE_BREATHE_MS = 30_000

/** The ring path: top centre, clockwise (right lens first). Same route as `pointAt`. */
function ringPath(o: CameraOutline, gap: number) {
  const { a, b, R } = stadium(o, gap)
  const mid = (a + b) / 2
  const p = Skia.Path.Make()
  p.moveTo(mid, o.cy - R)
  p.lineTo(b, o.cy - R)
  p.arcToOval(Skia.XYWHRect(b - R, o.cy - R, 2 * R, 2 * R), -90, 180, false)
  p.lineTo(a, o.cy + R)
  p.arcToOval(Skia.XYWHRect(a - R, o.cy - R, 2 * R, 2 * R), 90, 180, false)
  p.lineTo(mid, o.cy - R)
  return p
}

/**
 * Cover screen: a ring traced around the cameras. It fills as the song plays (the
 * tip glows), soft pulses ripple out from the cameras while music plays, and the
 * track breathes for a while when paused, then holds still.
 *
 * Draw it over a full-window box: the outline is in that box's dp coordinates.
 *
 *   <CameraRing outline={getCameraOutline()} progress={p} playing colors={['#9BF7B2', '#53E076']} />
 */
export function CameraRing({ outline, progress, playing, colors, guide = false, style }: {
  outline: CameraOutline
  progress: SharedValue<number>
  playing: boolean
  /** [ring + tip, pulses], usually from the cover art. */
  colors: [string, string]
  /** Draw the lens edges (gap 0) in red, for lining the outline up with the real cameras. */
  guide?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const reduced = useMotionReduced()

  // Breathe for a while after pausing, then stop the clock entirely.
  const [idleDone, setIdleDone] = useState(false)
  useEffect(() => {
    setIdleDone(false)
    if (playing) return
    const t = setTimeout(() => setIdleDone(true), IDLE_BREATHE_MS)
    return () => clearTimeout(t)
  }, [playing])
  const t = useMotionClock(!reduced && (playing || !idleDone))

  const { cx1, cx2, cy, r } = outline
  const o = useMemo(() => ({ cx1, cx2, cy, r }), [cx1, cx2, cy, r])
  const path = useMemo(() => ringPath(o, GAP), [o])
  const guidePath = useMemo(() => ringPath(o, 0), [o])

  // Progress moves a fraction of a pixel per frame over a whole song. Hand Skia a new
  // value only when the tip moves a whole physical pixel, so a playing song costs a
  // redraw a few times a second, not every frame (same idea as ProgressFill).
  const steps = Math.max(1, Math.round(perimeter(o, GAP) * PixelRatio.get()))
  const end = useSharedValue(0)
  useAnimatedReaction(
    () => Math.round(Math.min(1, Math.max(0, progress.value)) * steps) / steps,
    (cur, prev) => { if (cur !== prev) end.value = cur },
    [steps],
  )
  const tipX = useDerivedValue(() => pointAt(o, GAP, end.value).x)
  const tipY = useDerivedValue(() => pointAt(o, GAP, end.value).y)
  const tipR = useDerivedValue(() => (end.value > 0.002 ? STROKE * 1.35 : 0))

  // Paused: the track breathes. Playing: steady.
  const trackOpacity = useDerivedValue(() =>
    playing || reduced ? 0.22 : 0.2 + 0.14 * (0.5 + 0.5 * Math.sin(t.value * 0.0024)))

  const pulse = (i: number) => {
    const phase = useDerivedValue(() => {
      if (!playing || reduced) return 1
      return ((t.value / PULSE_PERIOD_MS) + i / PULSES) % 1
    })
    const s = (k: 'left' | 'top' | 'width' | 'height' | 'R') => useDerivedValue(() =>
      stadium(o, GAP + 2 + phase.value * PULSE_SPREAD)[k])
    const opacity = useDerivedValue(() => (playing && !reduced ? 0.42 * (1 - phase.value) ** 2 : 0))
    return { x: s('left'), y: s('top'), w: s('width'), h: s('height'), r: s('R'), opacity }
  }
  const pulses = [pulse(0), pulse(1), pulse(2)]

  // Draw only in a box round the cameras (pulses + glow included), not the whole screen.
  const box = stadium(o, GAP + 2 + PULSE_SPREAD)
  const PAD = 12
  const cv = { left: Math.floor(box.left - PAD), top: Math.floor(box.top - PAD), width: Math.ceil(box.width + PAD * 2), height: Math.ceil(box.height + PAD * 2) }

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Canvas style={{ position: 'absolute', ...cv }}>
        <Group transform={[{ translateX: -cv.left }, { translateY: -cv.top }]}>
        {pulses.map((q, i) => (
          <RoundedRect key={i} x={q.x} y={q.y} width={q.w} height={q.h} r={q.r}
            style="stroke" strokeWidth={2} color={colors[1]} opacity={q.opacity} />
        ))}

        {/* track */}
        <Path path={path} style="stroke" strokeWidth={STROKE} strokeCap="round" color={colors[0]} opacity={trackOpacity} />

        {/* progress: a glow under a crisp stroke */}
        <Group>
          <Path path={path} style="stroke" strokeWidth={STROKE * 2.4} strokeCap="round" color={colors[0]} opacity={0.45} start={0} end={end}>
            <BlurMask blur={6} style="normal" />
          </Path>
          <Path path={path} style="stroke" strokeWidth={STROKE} strokeCap="round" color={colors[0]} start={0} end={end} />
        </Group>

        {/* tip */}
        <Circle cx={tipX} cy={tipY} r={tipR} color="#ffffff" opacity={0.95}>
          <BlurMask blur={2} style="solid" />
        </Circle>

        {guide && <Path path={guidePath} style="stroke" strokeWidth={1} color="#ff3b3b" />}
        </Group>
      </Canvas>
    </View>
  )
}
