import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, BackHandler, Dimensions } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, Easing, runOnJS, type SharedValue,
} from 'react-native-reanimated'
import { FontFamily, Spacing } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Icon } from '@/components/ui/Icon'
import { Aurora, RollingNumber, useMotionReduced } from '@/components/motion'
import { KineticText } from '@/components/motion/KineticText'
import { playsSince } from '@/utils/playDb'
import { comparePeriods, periodRange, type SummaryKind } from '@/utils/listening'
import { buildStory } from '@/utils/story'

const SLIDE_MS = 5200
const { width: SW } = Dimensions.get('window')

/**
 * Motion #6 — Story mode. Your week / month / year as full-screen slides: progress bars,
 * tap right for next and left for back, hold to pause. Words rise line by line, numbers
 * roll, and the aurora behind changes colour with every slide.
 */
export default function StoryScreen() {
  const insets = useSafeAreaInsets()
  const reduced = useMotionReduced()
  const params = useLocalSearchParams<{ kind?: string }>()
  const kind: SummaryKind = params.kind === 'month' || params.kind === 'year' ? params.kind : 'week'
  const slides = useMemo(() => {
    const now = new Date()
    return buildStory(comparePeriods(playsSince(Math.floor(periodRange(kind, now, 1).start / 1000)), kind, now))
  }, [kind])

  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const prog = useSharedValue(0)
  const idx = useSharedValue(0)
  const remaining = useRef(SLIDE_MS)

  const close = useCallback(() => { haptic.light(); router.back() }, [])
  const go = useCallback((n: number) => {
    if (n < 0) n = 0
    if (n >= slides.length) { close(); return }
    haptic.light()
    setI(n)
  }, [slides.length])

  const run = useCallback((ms: number) => {
    prog.value = withTiming(1, { duration: ms, easing: Easing.linear }, done => { if (done) runOnJS(go)(idx.value + 1) })
  }, [go])

  useEffect(() => {
    idx.value = i
    cancelAnimation(prog)
    remaining.current = SLIDE_MS
    // Reduce motion: no timer — each slide waits for a tap (its bar shows full).
    if (reduced) { prog.value = 1; return }
    prog.value = 0
    run(SLIDE_MS)
  }, [i, reduced])

  const pause = () => { if (reduced) return; cancelAnimation(prog); remaining.current = SLIDE_MS * (1 - prog.value); setPaused(true) }
  const resume = () => { if (!paused) return; setPaused(false); run(remaining.current) }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true })
    return () => sub.remove()
  }, [])

  const s = slides[i]
  return (
    <View style={styles.root}>
      <Aurora colors={s.palette} style={StyleSheet.absoluteFill} dim={0.34} />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={e => go(e.nativeEvent.locationX < SW / 3 ? i - 1 : i + 1)}
        onLongPress={pause} delayLongPress={180} onPressOut={resume}
        accessibilityRole="button"
        accessibilityLabel={`Slide ${i + 1} of ${slides.length}. Tap for the next slide.`}
      />

      <View style={[styles.top, { paddingTop: insets.top + Spacing.sm }]} pointerEvents="box-none">
        <View style={styles.bars} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: slides.length, now: i + 1 }}>
          {slides.map((_, k) => <Bar key={k} k={k} idx={idx} prog={prog} />)}
        </View>
        <View style={styles.topRow} pointerEvents="box-none">
          <Text style={styles.brand}>playlist<Text style={{ color: '#fff' }}>.</Text>lens</Text>
          <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel="Close story">
            <Icon name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.body} pointerEvents="none" key={s.id} accessibilityLiveRegion="polite">
        <KineticText text={s.kicker} style={styles.kicker} stagger={60} />
        {s.roll
          ? <RollingNumber value={s.big} style={styles.big} unitStyle={styles.bigUnit} stagger={90} />
          : <KineticText text={s.big} style={styles.big} delay={260} stagger={110} />}
        {s.sub ? <KineticText text={s.sub} style={styles.sub} delay={700} stagger={40} /> : null}
      </View>

      {paused && <Text style={[styles.paused, { bottom: insets.bottom + 28 }]}>paused · let go to continue</Text>}
      {reduced && !paused && <Text style={[styles.paused, { bottom: insets.bottom + 28 }]}>tap to go on</Text>}
    </View>
  )
}

function Bar({ k, idx, prog }: { k: number; idx: SharedValue<number>; prog: SharedValue<number> }) {
  const a = useAnimatedStyle(() => ({ width: `${(k < idx.value ? 1 : k === idx.value ? prog.value : 0) * 100}%` }))
  return <View style={styles.bar}><Animated.View style={[styles.barFill, a]} /></View>
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0d0b14' },
  top:     { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: Spacing.lg, gap: Spacing.md },
  bars:    { flexDirection: 'row', gap: 4 },
  bar:     { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  topRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand:   { fontFamily: FontFamily.syneBold, fontSize: 16, color: 'rgba(255,255,255,0.85)', letterSpacing: -0.5 },
  close:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body:    { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  kicker:  { fontFamily: FontFamily.mono, fontSize: 16, color: 'rgba(255,255,255,0.86)' },
  big:     { fontFamily: FontFamily.syneBold, fontSize: 46, lineHeight: 52, color: '#fff', letterSpacing: -1.5 },
  bigUnit: { fontFamily: FontFamily.syneBold, fontSize: 26, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  sub:     { fontFamily: FontFamily.mono, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.86)' },
  paused:  { position: 'absolute', alignSelf: 'center', fontFamily: FontFamily.mono, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
})
