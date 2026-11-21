import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, PixelRatio } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { BackButton } from '@/components/ui'
import { Colors, OnDark, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { CameraRing } from '@/components/cover/CameraRing'
import { FLIP7_OUTLINE, toDp, type CameraOutline } from '@/components/cover/outline'
import { useRingProgress, type RingTrack } from '@/components/cover/useRingProgress'
import { useMotionReduced } from '@/components/motion/reduced'
import { useScreen } from '@/hooks/useScreen'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { usePalette } from '@/hooks/usePalette'
import { getCameraOutline, setCameraOutline } from '@/utils/settings'

const DEMO_MS = 24_000

/** Ink follows the lab's own background (never the app theme). */
const COVER_INK = { text: OnDark.text, muted: OnDark.textMuted, dim: OnDark.textDim, glass: 'rgba(0,0,0,0.28)', border: 'rgba(255,255,255,0.2)' }
const LIGHT_INK = { text: '#121316', muted: '#43474f', dim: '#6b7079', glass: 'rgba(255,255,255,0.45)', border: 'rgba(0,0,0,0.18)' }

/** Backgrounds to check the ring against (the Background button cycles them). */
const BACKGROUNDS: { name: string; color: string }[] = [
  { name: 'black',    color: '#000000' },
  { name: 'charcoal', color: '#1c1d22' },
  { name: 'slate',    color: '#3b4250' },
  { name: 'grey',     color: '#8a8f98' },
  { name: 'light',    color: '#f2efe9' },
  { name: 'white',    color: '#ffffff' },
  { name: 'red',      color: '#e8401c' },
  { name: 'crimson',  color: '#b3122e' },
  { name: 'orange',   color: '#ff8a1f' },
  { name: 'yellow',   color: '#ffd23f' },
  { name: 'lime',     color: '#a6e22e' },
  { name: 'green',    color: '#1f9e55' },
  { name: 'teal',     color: '#14a39a' },
  { name: 'cyan',     color: '#3fd0f2' },
  { name: 'blue',     color: '#2459d6' },
  { name: 'navy',     color: '#14204a' },
  { name: 'indigo',   color: '#4b3fd6' },
  { name: 'purple',   color: '#6a2bd9' },
  { name: 'pink',     color: '#ff70a5' },
  { name: 'brown',    color: '#6b4226' },
]

/** Relative luminance of a #rrggbb colour, 0–1. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}
type InkSet = { text: string; muted: string; dim: string; glass: string; border: string }
const Ink = createContext<InkSet>(COVER_INK)

/**
 * Settings › About › Cover screen lab — PROTOTYPE of the camera ring.
 *
 * Always drawn at the real camera positions (no simulator): open it on the cover
 * screen. Tune the outline until the red guide sits on the lens edges (drag to move,
 * buttons for size and spacing). The readout says which screen the app thinks it's on.
 */
export default function CoverLab() {
  const screen = useScreen()
  const onCover = screen.kind === 'cover'
  const reduced = useMotionReduced()
  const insets = useSafeAreaInsets()

  // ── outline, in cover-panel px (saved on every change) ──
  const ratio = PixelRatio.get()
  const [outline, setOutline] = useState<CameraOutline>(getCameraOutline)
  useEffect(() => { setCameraOutline(outline) }, [outline])
  const [guide, setGuide] = useState(true)
  const [tuning, setTuning] = useState(false)
  const nudge = (d: Partial<Record<'x' | 'y' | 'r' | 'gap', number>>) => {
    haptic.light()
    setOutline(o => {
      const half = (o.cx2 - o.cx1) / 2, mid = (o.cx1 + o.cx2) / 2
      const nh = Math.max(0, half + (d.gap ?? 0) / 2), nm = mid + (d.x ?? 0)
      return { cx1: nm - nh, cx2: nm + nh, cy: o.cy + (d.y ?? 0), r: Math.max(8, o.r + (d.r ?? 0)) }
    })
  }
  const drag = Gesture.Pan().runOnJS(true).enabled(tuning).minDistance(4)
    .onChange(e => setOutline(o => ({ ...o, cx1: o.cx1 + e.changeX * ratio, cx2: o.cx2 + e.changeX * ratio, cy: o.cy + e.changeY * ratio })))

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

  // ── background: cycles the presets, plus the cover's colour when a song is playing ──
  const bgs = pal ? [...BACKGROUNDS, { name: 'cover art', color: pal.background }] : BACKGROUNDS
  const [bgIdx, setBgIdx] = useState(0)
  const [picking, setPicking] = useState(false)
  const bg = bgs[bgIdx % bgs.length]
  const bgInk: InkSet = luminance(bg.color) > 0.4 ? LIGHT_INK : COVER_INK
  const ink = bgInk
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
        <Pill label={`Background: ${bg.name}`} active={picking} onPress={() => { haptic.light(); setPicking(v => !v) }} />
      </View>
      {picking && (
        <View style={styles.swatches}>
          {bgs.map((b, i) => (
            <Pressable key={b.name} onPress={() => { haptic.light(); setBgIdx(i) }} hitSlop={3}
              accessibilityRole="button" accessibilityLabel={`${b.name} background`} accessibilityState={{ selected: i === bgIdx % bgs.length }}
              style={[styles.swatch, { backgroundColor: b.color, borderColor: i === bgIdx % bgs.length ? ink.text : ink.border },
                i === bgIdx % bgs.length && styles.swatchOn]}>
              {b.name === 'cover art' && <Ionicons name="musical-notes" size={12} color={luminance(b.color) > 0.4 ? '#121316' : '#ffffff'} />}
            </Pressable>
          ))}
        </View>
      )}
      {tuning && (
        <View style={styles.tune}>
          <Stepper label="left/right" onMinus={() => nudge({ x: -2 })} onPlus={() => nudge({ x: 2 })} />
          <Stepper label="up/down" onMinus={() => nudge({ y: -2 })} onPlus={() => nudge({ y: 2 })} />
          <Stepper label="lens size" onMinus={() => nudge({ r: -1 })} onPlus={() => nudge({ r: 1 })} />
          <Stepper label="spacing" onMinus={() => nudge({ gap: -2 })} onPlus={() => nudge({ gap: 2 })} />
          <View style={styles.row}>
            <Pill label={guide ? 'Hide guide' : 'Show guide'} onPress={() => setGuide(g => !g)} />
            <Pill label="Reset" onPress={() => { haptic.medium(); setOutline({ ...FLIP7_OUTLINE }) }} />
          </View>
          <Text style={[styles.values, { color: ink.muted }]} selectable>
            {`px  cx1 ${outline.cx1.toFixed(0)} · cx2 ${outline.cx2.toFixed(0)} · cy ${outline.cy.toFixed(0)} · r ${outline.r.toFixed(0)}`}
          </Text>
          <Text style={[styles.hint, { color: ink.dim }]}>Drag anywhere to move the ring.</Text>
        </View>
      )}
    </View></Ink.Provider>
  )

  const ringOutline = toDp(outline, ratio)
  const ring = <CameraRing outline={ringOutline} progress={progress} playing={!!track?.playing} colors={colors} guide={tuning && guide} />

  return (
    <GestureDetector gesture={drag}>
      <View style={[styles.cover, { backgroundColor: bg.color }]}>
        {ring}
        <View style={[styles.coverTop, { paddingTop: insets.top + Spacing.sm }]}>
          {/* dark pill so the light arrow reads on every background */}
          <BackButton style={{ backgroundColor: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.2)' }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.screen, { color: onCover ? ink.text : '#ffb347' }]} numberOfLines={1}>
              {onCover ? 'cover screen' : 'main screen: close the phone to use this'}
            </Text>
            <Text style={[styles.values, { color: ink.muted }]} numberOfLines={2} selectable>{screen.detail}</Text>
          </View>
        </View>
        <View style={styles.coverBody}>{controls}</View>
      </View>
    </GestureDetector>
  )
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
  coverTop:  { paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  screen:    { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs },
  // Upper area: the cameras are bottom-right, Samsung's "open on main screen" button bottom-centre.
  coverBody: { position: 'absolute', top: 76, right: Spacing.lg, left: Spacing.lg },
  controls:  { gap: 6, alignSelf: 'stretch' },
  track:     { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text },
  sub:       { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  row:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 4 },
  round:     { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  pill:      { paddingHorizontal: 12, height: 32, borderRadius: Radius.full, justifyContent: 'center', backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder },
  pillOn:    { borderColor: alpha(Colors.greenPrimary, 0.6) },
  pillText:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.text },
  tune:      { gap: 6, marginTop: 6 },
  swatches:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  swatch:    { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatchOn:  { borderWidth: 3 },
  stepper:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepLabel: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  values:    { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.textMuted },
  hint:      { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.textDim },
})
