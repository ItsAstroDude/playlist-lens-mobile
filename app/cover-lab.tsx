import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { BackButton } from '@/components/ui'
import { Colors, OnDark, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { CameraRing } from '@/components/cover/CameraRing'
import { FLIP7_OUTLINE, type CameraOutline } from '@/components/cover/outline'
import { useRingProgress, type RingTrack } from '@/components/cover/useRingProgress'
import { useMotionReduced } from '@/components/motion/reduced'
import { useCoverScreen } from '@/hooks/useCoverScreen'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { usePalette } from '@/hooks/usePalette'
import { getCameraOutline, setCameraOutline } from '@/utils/settings'

/** The cover window the simulator draws on the main screen (Flip 7, dp). */
const COVER_W = 399
const COVER_H = 441
const DEMO_MS = 24_000

/** The cover view is always black, so it always uses dark-theme ink (light theme too). */
const THEME_INK = { text: Colors.text, muted: Colors.textMuted, dim: Colors.textDim, glass: Colors.glass, border: Colors.glassBorder }
const COVER_INK = { text: OnDark.text, muted: OnDark.textMuted, dim: OnDark.textDim, glass: 'rgba(255,255,255,0.075)', border: 'rgba(255,255,255,0.15)' }
const Ink = createContext(THEME_INK)

/**
 * Settings › About › Cover screen lab — PROTOTYPE of the camera ring.
 *
 * On the cover screen it draws round the real cameras; tune the outline until the
 * red guide sits on the lens edges (drag to move, buttons for size and spacing).
 * On the main screen it shows a simulated cover screen instead.
 */
export default function CoverLab() {
  const onCover = useCoverScreen()
  const reduced = useMotionReduced()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  // ── outline (saved on every change) ──
  const [outline, setOutline] = useState<CameraOutline>(getCameraOutline)
  useEffect(() => { setCameraOutline(outline) }, [outline])
  const [guide, setGuide] = useState(true)
  const [tuning, setTuning] = useState(false)
  const nudge = (d: Partial<Record<'x' | 'y' | 'r' | 'gap', number>>) => {
    haptic.light()
    setOutline(o => {
      const half = (o.cx2 - o.cx1) / 2, mid = (o.cx1 + o.cx2) / 2
      const nh = Math.max(0, half + (d.gap ?? 0) / 2), nm = mid + (d.x ?? 0)
      return { cx1: nm - nh, cx2: nm + nh, cy: o.cy + (d.y ?? 0), r: Math.max(4, o.r + (d.r ?? 0)) }
    })
  }
  const drag = Gesture.Pan().runOnJS(true).enabled(onCover && tuning).minDistance(4)
    .onChange(e => setOutline(o => ({ ...o, cx1: o.cx1 + e.changeX, cx2: o.cx2 + e.changeX, cy: o.cy + e.changeY })))

  // ── source: live Spotify, else a demo song ──
  const { np } = useNowPlaying()
  const live: RingTrack | null = np?.item && np.item.duration_ms
    ? { id: np.item.id, playing: np.is_playing, progressMs: np.progress_ms ?? 0, durationMs: np.item.duration_ms, receivedAt: np.receivedAt }
    : null
  const [useDemo, setUseDemo] = useState(false)
  const [demo, setDemo] = useState<RingTrack>(() => ({ id: 'demo-1', playing: true, progressMs: 0, durationMs: DEMO_MS, receivedAt: Date.now() }))
  const demoNext = useCallback(() => {
    setDemo(d => ({ id: `demo-${Number(d.id?.split('-')[1] ?? 0) + 1}`, playing: true, progressMs: 0, durationMs: DEMO_MS, receivedAt: Date.now() }))
  }, [])
  const demoToggle = () => {
    haptic.light()
    setDemo(d => d.playing
      ? { ...d, playing: false, progressMs: Math.min(d.durationMs, d.progressMs + Date.now() - d.receivedAt), receivedAt: Date.now() }
      : { ...d, playing: true, receivedAt: Date.now() })
  }
  // The demo song "ends" and the next one starts.
  useEffect(() => {
    if (!(useDemo || !live) || !demo.playing) return
    const left = demo.durationMs - demo.progressMs - (Date.now() - demo.receivedAt)
    const t = setTimeout(demoNext, Math.max(0, left))
    return () => clearTimeout(t)
  }, [useDemo, !live, demo, demoNext])

  const showingDemo = useDemo || !live
  const track = showingDemo ? demo : live
  const progress = useRingProgress(track, reduced)

  // ── colours from the cover art ──
  const { palettes, extract } = usePalette()
  const art = np?.item?.album?.images?.[0]?.url ?? null
  const palKey = np?.item?.id ? `np-${np.item.id}` : null
  useEffect(() => { if (palKey && art) extract(palKey, art) }, [palKey, art])
  const pal = !showingDemo && palKey ? palettes[palKey] : undefined
  const colors: [string, string] = pal ? [pal.detail, pal.primary] : [Colors.greenPrimary, Colors.greenPrimary]

  const title = showingDemo ? 'Demo song' : np?.item?.name ?? ''
  const sub = showingDemo ? `${live ? 'live music available' : 'nothing playing on Spotify'}` : np?.item?.artists?.join(', ') ?? ''

  const ink = onCover ? COVER_INK : THEME_INK
  const controls = (
    <Ink.Provider value={ink}><View style={styles.controls}>
      <Text style={[styles.track, { color: ink.text }]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.sub, { color: ink.muted }]} numberOfLines={1}>{sub}</Text>
      <View style={styles.row}>
        {showingDemo && <>
          <RoundBtn icon={demo.playing ? 'pause' : 'play'} label={demo.playing ? 'Pause' : 'Play'} onPress={demoToggle} />
          <RoundBtn icon="play-skip-forward" label="Next song" onPress={() => { haptic.medium(); demoNext() }} />
        </>}
        {!!live && <Pill label={showingDemo ? 'Use live' : 'Use demo'} onPress={() => { haptic.light(); setUseDemo(d => !d) }} />}
        <Pill label={tuning ? 'Done' : 'Tune'} active={tuning} onPress={() => { haptic.light(); setTuning(v => !v) }} />
      </View>
      {tuning && (
        <View style={styles.tune}>
          <Stepper label="left/right" onMinus={() => nudge({ x: -1 })} onPlus={() => nudge({ x: 1 })} />
          <Stepper label="up/down" onMinus={() => nudge({ y: -1 })} onPlus={() => nudge({ y: 1 })} />
          <Stepper label="lens size" onMinus={() => nudge({ r: -0.5 })} onPlus={() => nudge({ r: 0.5 })} />
          <Stepper label="spacing" onMinus={() => nudge({ gap: -1 })} onPlus={() => nudge({ gap: 1 })} />
          <View style={styles.row}>
            <Pill label={guide ? 'Hide guide' : 'Show guide'} onPress={() => setGuide(g => !g)} />
            <Pill label="Reset" onPress={() => { haptic.medium(); setOutline({ ...FLIP7_OUTLINE }) }} />
          </View>
          <Text style={[styles.values, { color: ink.muted }]} selectable>
            {`cx1 ${outline.cx1.toFixed(1)} · cx2 ${outline.cx2.toFixed(1)} · cy ${outline.cy.toFixed(1)} · r ${outline.r.toFixed(1)}`}
          </Text>
          {onCover && <Text style={[styles.hint, { color: ink.dim }]}>Drag anywhere to move the ring.</Text>}
        </View>
      )}
    </View></Ink.Provider>
  )

  const ring = <CameraRing outline={outline} progress={progress} playing={!!track?.playing} colors={colors} guide={tuning && guide} />

  // ── on the cover screen: the real thing ──
  if (onCover) {
    return (
      <GestureDetector gesture={drag}>
        <View style={styles.cover}>
          {ring}
          <View style={[styles.coverTop, { paddingTop: insets.top + Spacing.sm }]}>
            <BackButton />
          </View>
          <View style={styles.coverBody}>{controls}</View>
        </View>
      </GestureDetector>
    )
  }

  // ── on the main screen: a simulated cover screen ──
  const s = Math.min(1, (width - Spacing.lg * 2) / COVER_W)
  return (
    <View style={[styles.main, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.mainHead}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>cover screen lab</Text>
          <Text style={styles.sub}>Prototype. Close the phone to see it round the real cameras.</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + Spacing.xl }}>
        <View style={{ width: COVER_W * s, height: COVER_H * s, marginVertical: Spacing.md }}>
          <View style={[styles.sim, {
            transform: [{ scale: s }],
            left: -(COVER_W * (1 - s)) / 2, top: -(COVER_H * (1 - s)) / 2,
          }]}>
            <FakeCameras o={outline} />
            {ring}
          </View>
        </View>
        {controls}
      </ScrollView>
    </View>
  )
}

/** Simulator only: lenses drawn where the outline says the cameras are. */
function FakeCameras({ o }: { o: CameraOutline }) {
  const lens = (cx: number) => (
    <View key={cx} style={[styles.lens, { left: cx - o.r, top: o.cy - o.r, width: o.r * 2, height: o.r * 2, borderRadius: o.r }]}>
      <View style={[styles.glass, { width: o.r * 1.1, height: o.r * 1.1, borderRadius: o.r }]} />
    </View>
  )
  return <>{lens(o.cx1)}{lens(o.cx2)}</>
}

function RoundBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const ink = useContext(Ink)
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.round, { backgroundColor: ink.glass, borderColor: ink.border }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={18} color={ink.text} />
    </Pressable>
  )
}

function Pill({ label, onPress, active = false }: { label: string; onPress: () => void; active?: boolean }) {
  const ink = useContext(Ink)
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.pill, { backgroundColor: ink.glass, borderColor: ink.border }, active && styles.pillOn, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.pillText, { color: ink.text }, active && { color: Colors.greenPrimary }]}>{label}</Text>
    </Pressable>
  )
}

function Stepper({ label, onMinus, onPlus }: { label: string; onMinus: () => void; onPlus: () => void }) {
  const ink = useContext(Ink)
  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepLabel, { color: ink.muted }]}>{label}</Text>
      <RoundBtn icon="remove" label={`${label} down`} onPress={onMinus} />
      <RoundBtn icon="add" label={`${label} up`} onPress={onPlus} />
    </View>
  )
}

const styles = StyleSheet.create({
  cover:     { flex: 1, backgroundColor: '#000' },
  coverTop:  { paddingHorizontal: Spacing.md, flexDirection: 'row' },
  // Keep the controls clear of the cameras (bottom-left).
  coverBody: { position: 'absolute', top: 64, right: Spacing.md, left: 150, bottom: 24 },
  main:      { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.lg },
  mainHead:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  h1:        { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, letterSpacing: -0.5 },
  sim:       { position: 'absolute', width: COVER_W, height: COVER_H, backgroundColor: '#000', borderRadius: 28, overflow: 'hidden' },
  lens:      { position: 'absolute', backgroundColor: '#15161a', borderWidth: 2, borderColor: '#2a2c33', alignItems: 'center', justifyContent: 'center' },
  glass:     { backgroundColor: '#050608', borderWidth: 1, borderColor: '#1c2030' },
  controls:  { gap: 6, alignSelf: 'stretch' },
  track:     { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text },
  sub:       { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  row:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 4 },
  round:     { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  pill:      { paddingHorizontal: 12, height: 32, borderRadius: Radius.full, justifyContent: 'center', backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder },
  pillOn:    { borderColor: alpha(Colors.greenPrimary, 0.6) },
  pillText:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.text },
  tune:      { gap: 6, marginTop: 6 },
  stepper:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepLabel: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  values:    { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.textMuted },
  hint:      { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.textDim },
})
