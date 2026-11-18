import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Path, Ellipse, Circle, G, Text as SvgText } from 'react-native-svg'
import { useFocusEffect } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withRepeat, withTiming, withSequence, withSpring,
  withDelay, cancelAnimation, Easing, interpolate,
} from 'react-native-reanimated'
import { useMotionReduced } from '@/components/motion/reduced'

/**
 * Spark — a chubby amber four-point star with a face. "a little smarter than a rock.
 * but hey." Drawn from the canonical SVG in docs/spark/SPARK_BRIEF.md §3; his amber never
 * takes the app's album-art tint. He moves on springs, ONE loop at a time, pauses when
 * off-screen or in the background, and holds still under Reduce motion.
 */

export type SparkMood =
  | 'idle' | 'listening' | 'thinking' | 'talking' | 'happy' | 'error' | 'sleeping'
  | 'loading' | 'uwu' | 'shocked' | 'unsure' | 'unloaded' | 'vibing'

export const SPARK = {
  amber: '#FFC23D',
  ink:   '#2A1B5E',
  blush: '#FF7AA8',
  navy:  '#151926',
  cream: '#F2EEE6',
  mint:  '#7FE0C2',
  /** headphones: a lifted ink so they read on the navy app background */
  phones: '#5B48B5',
} as const

// The body; control point `c` = 20 is the canonical star, 25 straightens the sides into a
// diamond (a square on its point) — the `loading` squish.
function bodyPath(c: number): string {
  'worklet'
  return `M0 -50 Q${c} ${-c} 50 0 Q${c} ${c} 0 50 Q${-c} ${c} -50 0 Q${-c} ${-c} 0 -50 Z`
}
const APath = Animated.createAnimatedComponent(Path)

// A tiny four-point sparkle (sparkles, orbiting stars).
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x + r * 0.25} ${y - r * 0.25} ${x + r} ${y} Q${x + r * 0.25} ${y + r * 0.25} ${x} ${y + r} Q${x - r * 0.25} ${y + r * 0.25} ${x - r} ${y} Q${x - r * 0.25} ${y - r * 0.25} ${x} ${y - r} Z`

const INK = { stroke: SPARK.ink, strokeWidth: 3.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

function Eyes({ mood, blink }: { mood: SparkMood; blink: boolean }) {
  const open = (dx = 0, dy = 0, r = 1) => (
    <>
      <Ellipse cx={-11 + dx} cy={-3 + dy} rx={5.6 * r} ry={7 * r} fill={SPARK.ink} />
      <Ellipse cx={11 + dx} cy={-3 + dy} rx={5.6 * r} ry={7 * r} fill={SPARK.ink} />
      <Circle cx={-12.8 + dx} cy={-5.6 + dy} r={1.9 * r} fill="#fff" />
      <Circle cx={9.2 + dx} cy={-5.6 + dy} r={1.9 * r} fill="#fff" />
    </>
  )
  const closedDown = <><Path d="M-16 -3 Q-11 1 -6 -3" {...INK} /><Path d="M6 -3 Q11 1 16 -3" {...INK} /></>
  if (blink && (mood === 'idle' || mood === 'listening' || mood === 'talking' || mood === 'unsure' || mood === 'unloaded')) return closedDown
  switch (mood) {
    case 'happy': case 'vibing':
      return <><Path d="M-16 -2 Q-11 -9 -6 -2" {...INK} /><Path d="M6 -2 Q11 -9 16 -2" {...INK} /></>
    case 'sleeping':
      return closedDown
    case 'uwu':
      return <><Path d="M-15 -6 Q-11 2 -7 -6" {...INK} /><Path d="M7 -6 Q11 2 15 -6" {...INK} /></>
    case 'error':
      return <><Path d="M-15 -7 L-8 -3 L-15 1" {...INK} /><Path d="M15 -7 L8 -3 L15 1" {...INK} /></>
    case 'shocked':
      return open(0, -1, 1.15)
    case 'thinking':
      return open(2.2, -2.6)
    case 'unsure':
      return <>
        <Path d="M-15.5 -3 L-6.5 -3" {...INK} />
        <Ellipse cx={11} cy={-3} rx={5.6} ry={7} fill={SPARK.ink} />
        <Circle cx={9.2} cy={-5.6} r={1.9} fill="#fff" />
      </>
    default:
      return open()
  }
}

function Mouth({ mood, mouthOpen }: { mood: SparkMood; mouthOpen: boolean }) {
  switch (mood) {
    case 'happy': case 'vibing': return <Path d="M-6 8 Q0 15 6 8" {...INK} />
    case 'sleeping':             return <Ellipse cx={0} cy={10.5} rx={2.2} ry={2.6} fill={SPARK.ink} />
    case 'uwu':                  return <Path d="M-5 8.5 Q-2.5 12.5 0 8.5 Q2.5 12.5 5 8.5" {...INK} />
    case 'error':                return <Path d="M-6.5 10.5 Q-3.3 7.5 0 10.5 Q3.3 13.5 6.5 10.5" {...INK} />
    case 'shocked':              return <Ellipse cx={0} cy={11} rx={3} ry={4} fill={SPARK.ink} />
    case 'unsure':               return <Path d="M-4 10.5 Q0 9.5 4 11.5" {...INK} />
    case 'thinking':             return <Path d="M-2.5 10 Q0.5 11 3 9.5" {...INK} />
    case 'talking':              return mouthOpen ? <Ellipse cx={0} cy={10} rx={3.4} ry={3.2} fill={SPARK.ink} /> : <Path d="M-3.5 9 Q0 11.8 3.5 9" {...INK} />
    default:                     return <Path d="M-3.5 9 Q0 11.8 3.5 9" {...INK} />
  }
}

/** Headphones (decided 2026-11-18: in both apps). Band behind the top point, cups on the side points. */
function HeadphonesBand() {
  return <Path d="M-47 -6 C-49 -70 49 -70 47 -6" stroke={SPARK.phones} strokeWidth={6} strokeLinecap="round" fill="none" />
}
function HeadphonesCups() {
  return (
    <G>
      <Path d="M-58 -13 Q-58 -18 -53 -18 L-49 -18 Q-44 -18 -44 -13 L-44 9 Q-44 14 -49 14 L-53 14 Q-58 14 -58 9 Z" fill={SPARK.phones} />
      <Path d="M58 -13 Q58 -18 53 -18 L49 -18 Q44 -18 44 -13 L44 9 Q44 14 49 14 L53 14 Q58 14 58 9 Z" fill={SPARK.phones} />
      <Circle cx={-51} cy={-2} r={2.6} fill={SPARK.mint} />
      <Circle cx={51} cy={-2} r={2.6} fill={SPARK.mint} />
    </G>
  )
}

export function Spark({
  mood = 'idle', size = 64, headphones, onPress, active = true, style, label,
}: {
  mood?: SparkMood
  size?: number
  /** Default: on from 32 px up (the cups vanish below that). */
  headphones?: boolean
  onPress?: () => void
  /** false = hold still (e.g. not on screen). Focus and app state are handled inside. */
  active?: boolean
  style?: StyleProp<ViewStyle>
  /** Screen-reader text; omit for a decorative Spark (hidden from screen readers). */
  label?: string
}) {
  const phones = headphones ?? size >= 32
  const reduced = useMotionReduced()
  const [focused, setFocused] = useState(true)
  const [appActive, setAppActive] = useState(true)
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))
  useEffect(() => { const s = AppState.addEventListener('change', st => setAppActive(st === 'active')); return () => s.remove() }, [])
  const live = active && focused && appActive && !reduced

  // ── blink (~3.4 s with jitter) and talking mouth: small React state flips, no loops on the UI thread
  const [blink, setBlink] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)
  useEffect(() => {
    if (!live) return
    let t: ReturnType<typeof setTimeout>
    const next = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 120); next() }, 2800 + Math.random() * 1200) }
    next()
    return () => clearTimeout(t)
  }, [live])
  useEffect(() => {
    if (!live || mood !== 'talking') return
    const i = setInterval(() => setMouthOpen(o => !o), 150)
    return () => clearInterval(i)
  }, [live, mood])

  // ── motion: ONE loop per mood, driven by `loop` 0→1; one-shots on mood change
  const loop = useSharedValue(0)
  const hop = useSharedValue(0)        // happy hops / error jitter
  const pop = useSharedValue(reduced ? 1 : 0)
  const squash = useSharedValue(0)     // tap / landing squash
  useEffect(() => { pop.value = withSpring(1, { mass: 0.7, damping: 9, stiffness: 180 }) }, [])
  useEffect(() => {
    cancelAnimation(loop); loop.value = 0
    if (!live) return
    const dur = mood === 'vibing' ? 500 : mood === 'loading' ? 900 : mood === 'thinking' ? 2400 : mood === 'sleeping' ? 3600 : 2600
    loop.value = withRepeat(withTiming(1, { duration: dur, easing: mood === 'thinking' ? Easing.linear : Easing.inOut(Easing.sin) }), -1, mood !== 'thinking')
    return () => cancelAnimation(loop)
  }, [live, mood])
  useEffect(() => {
    if (reduced) return
    if (mood === 'happy') hop.value = withSequence(withTiming(1, { duration: 160 }), withSpring(0, { damping: 6 }), withDelay(60, withTiming(0.7, { duration: 140 })), withSpring(0, { damping: 6 }))
    if (mood === 'error') hop.value = withSequence(withTiming(1, { duration: 50 }), withTiming(-1, { duration: 60 }), withTiming(0.6, { duration: 60 }), withTiming(0, { duration: 80 }))
  }, [mood])

  const body = useAnimatedStyle(() => {
    const l = loop.value
    let ty = 0, rot = 0, sx = 1, sy = 1
    if (mood === 'vibing')       { ty = interpolate(l, [0, 1], [0, 5]); sy = 1 - l * 0.06; sx = 1 + l * 0.05 }
    else if (mood === 'loading') { sx = 1 + l * 0.08; sy = 1 - l * 0.08 }
    else if (mood === 'sleeping') { rot = 14; sy = 1 + l * 0.025; sx = 1 + l * 0.025 }
    else if (mood !== 'thinking') { ty = (l - 0.5) * 6; rot = (l - 0.5) * 6 }
    if (mood === 'happy') ty -= hop.value * 14
    const tx = mood === 'error' ? hop.value * 4 : 0
    const sq = squash.value
    return {
      opacity: mood === 'unloaded' ? 0.45 : 1,
      transform: [
        { translateX: tx }, { translateY: ty },
        { rotate: `${rot}deg` },
        { scaleX: sx * pop.value * (1 + sq * 0.16) }, { scaleY: sy * pop.value * (1 - sq * 0.16) },
      ],
    }
  })
  const bodyProps = useAnimatedProps(() => ({ d: bodyPath(mood === 'loading' ? 20 + loop.value * 5 : 20) }))
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${loop.value * 360}deg` }] }))
  const zs = useAnimatedStyle(() => ({ opacity: 0.4 + loop.value * 0.6, transform: [{ translateY: -loop.value * 6 }] }))

  const press = () => {
    if (!reduced) squash.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 7, stiffness: 260 }))
    onPress?.()
  }

  const art = (
    <Animated.View style={[{ width: size, height: size }, body]}>
      <Svg width={size} height={size} viewBox="-80 -80 160 160">
        {mood === 'error' && <Path d={bodyPath(20)} fill={SPARK.mint} opacity={0.35} transform="translate(6,-3)" />}
        {mood === 'listening' && <Circle cx={0} cy={0} r={70} stroke={SPARK.amber} strokeOpacity={0.45} strokeWidth={3} fill="none" />}
        {phones && <HeadphonesBand />}
        <APath animatedProps={bodyProps} fill={SPARK.amber} stroke={SPARK.amber} strokeWidth={10} strokeLinejoin="round" />
        {phones && <HeadphonesCups />}
        <Eyes mood={mood} blink={blink} />
        {mood !== 'unloaded' && <>
          <Ellipse cx={-19} cy={8} rx={5} ry={2.8} fill={SPARK.blush} opacity={0.6} />
          <Ellipse cx={19} cy={8} rx={5} ry={2.8} fill={SPARK.blush} opacity={0.6} />
        </>}
        <Mouth mood={mood} mouthOpen={live && mood === 'talking' && mouthOpen} />
        {mood === 'happy' && <G fill={SPARK.amber}><Path d={sparkle(-58, -48, 7)} /><Path d={sparkle(60, -38, 5)} /><Path d={sparkle(52, 50, 6)} /></G>}
        {mood === 'uwu' && <G fill={SPARK.blush}><Path d={sparkle(-56, -46, 7)} /><Path d={sparkle(58, -40, 5)} /><Path d={sparkle(-50, 52, 5)} /></G>}
      </Svg>
      {mood === 'thinking' && (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, orbit]}>
          <Svg width={size} height={size} viewBox="-80 -80 160 160">
            <G fill={SPARK.amber}><Path d={sparkle(0, -70, 6)} /><Path d={sparkle(61, 35, 5)} /><Path d={sparkle(-61, 35, 4)} /></G>
          </Svg>
        </Animated.View>
      )}
      {mood === 'sleeping' && (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, zs]}>
          <Svg width={size} height={size} viewBox="-80 -80 160 160">
            <SvgText x={42} y={-44} fontSize={16} fontWeight="700" fill={SPARK.amber}>z</SvgText>
            <SvgText x={56} y={-62} fontSize={22} fontWeight="700" fill={SPARK.amber} opacity={0.7}>z</SvgText>
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  )

  const a11y = label
    ? { accessible: true, accessibilityLabel: label }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true }
  return onPress
    ? <Pressable onPress={press} hitSlop={10} style={style} accessibilityRole="button" {...a11y}>{art}</Pressable>
    : <View style={style} {...a11y}>{art}</View>
}

/** Tiny Spark (≤ 24 px): body + two eyes only — blush and shine vanish at this size. */
export function SparkTiny({ size = 14, headphones = false, rock = false }: { size?: number; headphones?: boolean; /** the 5-tap gag: he turns to stone */ rock?: boolean }) {
  const fill = rock ? '#8C8F99' : SPARK.amber
  return (
    <Svg width={size} height={size} viewBox="-80 -80 160 160" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {headphones && <Path d="M-47 -6 C-49 -70 49 -70 47 -6" stroke={SPARK.phones} strokeWidth={10} strokeLinecap="round" fill="none" />}
      <Path d={bodyPath(20)} fill={fill} stroke={fill} strokeWidth={14} strokeLinejoin="round" />
      <Ellipse cx={-13} cy={-2} rx={8} ry={10} fill={SPARK.ink} />
      <Ellipse cx={13} cy={-2} rx={8} ry={10} fill={SPARK.ink} />
    </Svg>
  )
}
