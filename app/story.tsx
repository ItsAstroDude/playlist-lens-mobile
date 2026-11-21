import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, BackHandler, Dimensions, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, Easing, runOnJS, type SharedValue,
} from 'react-native-reanimated'
import { FontFamily, Spacing } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Icon } from '@/components/ui/Icon'
import { Aurora, RollingNumber, RackFocus, useMotionReduced } from '@/components/motion'
import { KineticText } from '@/components/motion/KineticText'
import { ArtThumb } from '@/components/ui'
import { ShareCard, CARD_W, CARD_H } from '@/components/story/ShareCard'
import { FitHeadline } from '@/components/story/FitHeadline'
import { useArtwork } from '@/hooks/useArtwork'
import { usePalette } from '@/hooks/usePalette'
import { buildStory, type Palette } from '@/utils/story'
import { storyAsync, type StoryData, type StoryKind } from '@/utils/storyData'
import { showToast } from '@/utils/dialog'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'

const SLIDE_MS = 5200
const { width: SW } = Dimensions.get('window')

const LOADING_PALETTE: Palette = ['#6a2bd9', '#ff70a5', '#ffb347', '#b39dff']
/** Cover size on cover slides: big, but leaves room for a three-line title. */
const ART = Math.min(Math.round(SW * 0.62), 280)

/**
 * Motion #6 — Story mode. Your week / month / year as full-screen slides: progress bars,
 * tap right for next and left for back, hold to pause. Words rise line by line, numbers
 * roll, and the aurora behind changes colour with every slide.
 *
 * Phase 4: any period — /story?kind=week|month|year|all&back=N (N periods ago; 0 = so
 * far) — covers, top-5 lists, a listening-clock slide, and a share card at the end.
 * The data comes off the UI thread (a year or all time is real work).
 */
export default function StoryScreen() {
  const insets = useSafeAreaInsets()
  const reduced = useMotionReduced()
  const params = useLocalSearchParams<{ kind?: string; back?: string }>()
  const kind: StoryKind = params.kind === 'month' || params.kind === 'year' || params.kind === 'all' ? params.kind : 'week'
  const back = Math.max(0, Math.floor(Number(params.back) || 0))
  const [data, setData] = useState<StoryData | null>(null)
  useEffect(() => {
    let alive = true
    storyAsync(kind, back).then(d => { if (alive) setData(d) }, () => { if (alive) router.back() })
    return () => { alive = false }
  }, [kind, back])
  const slides = useMemo(
    () => (data ? buildStory(data.comparison, { all: data.all, past: data.past, newArtists: data.newArtists }) : null),
    [data],
  )

  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const prog = useSharedValue(0)
  const idx = useSharedValue(0)
  const remaining = useRef(SLIDE_MS)

  const close = useCallback(() => { haptic.light(); router.back() }, [])
  const count = slides?.length ?? 0
  const go = useCallback((n: number) => {
    if (n < 0) n = 0
    if (n >= count) { close(); return }
    haptic.light()
    setI(n)
  }, [count])

  const run = useCallback((ms: number) => {
    prog.value = withTiming(1, { duration: ms, easing: Easing.linear }, done => { if (done) runOnJS(go)(idx.value + 1) })
  }, [go])

  useEffect(() => {
    if (!slides) return                       // still loading: no timer yet
    idx.value = i
    cancelAnimation(prog)
    remaining.current = SLIDE_MS
    // Reduce motion: no timer — each slide waits for a tap (its bar shows full).
    if (reduced) { prog.value = 1; return }
    prog.value = 0
    run(SLIDE_MS)
  }, [i, reduced, slides])

  const pause = () => { if (reduced) return; cancelAnimation(prog); remaining.current = SLIDE_MS * (1 - prog.value); setPaused(true) }
  const resume = () => { if (!paused) return; setPaused(false); run(remaining.current) }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true })
    return () => sub.remove()
  }, [])

  // ── Share card ──
  const card = useRef<View>(null)
  const [sharing, setSharing] = useState(false)
  const share = useCallback(async () => {
    if (sharing || !data) return
    haptic.medium()
    // Hold the slide timer while the share sheet is up; carry on after.
    cancelAnimation(prog)
    remaining.current = SLIDE_MS * (1 - prog.value)
    setSharing(true)
    try {
      if (!(await Sharing.isAvailableAsync())) { showToast('Sharing isn’t available on this phone', 'alert-circle-outline'); return }
      const uri = await captureRef(card, { format: 'png', quality: 1, width: CARD_W * 3, height: CARD_H * 3 })
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your story' })
    } catch {
      showToast('Couldn’t make the card — try again', 'alert-circle-outline')
    } finally {
      setSharing(false)
      if (!reduced) run(Math.max(remaining.current, 1500))
    }
  }, [sharing, data, reduced, run])

  // Cover slides take their colours from the cover (like the Now Playing sheet).
  const artSlide = slides?.[i]?.art
  const coverUrl = useArtwork(artSlide?.kind ?? null, artSlide?.name, artSlide?.artist)
  const { palettes, extract } = usePalette()
  const palKey = coverUrl ? `story-${coverUrl}` : null
  useEffect(() => { if (palKey && coverUrl) extract(palKey, coverUrl) }, [palKey])
  const pal = palKey ? palettes[palKey] : undefined
  const coverPalette: Palette | null = artSlide && pal ? [pal.primary, pal.secondary, pal.detail, pal.background] : null

  if (!slides || !data) {
    return (
      <View style={styles.root}>
        <Aurora colors={LOADING_PALETTE} style={StyleSheet.absoluteFill} dim={0.34} />
        <View style={[styles.top, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.topRow}>
            <Text style={styles.brand}>playlist<Text style={{ color: '#fff' }}>.</Text>lens</Text>
            <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel="Close story">
              <Icon name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.sub}>Getting your story ready…</Text>
        </View>
      </View>
    )
  }

  const s = slides[i]
  return (
    <View style={styles.root}>
      <Aurora colors={coverPalette ?? s.palette} style={StyleSheet.absoluteFill} dim={0.34} />

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

      <View style={[styles.body, s.art && styles.bodyArt]} pointerEvents="none" key={s.id} accessibilityLiveRegion="polite">
        {s.art ? (
          // Cover slides: the cover big and centred, the words centred under it.
          <RackFocus index={0} style={styles.artWrap}>
            <ArtThumb kind={s.art.kind} name={s.art.name} artist={s.art.artist} size={ART} />
          </RackFocus>
        ) : null}
        <KineticText text={s.kicker} style={styles.kicker} stagger={60} containerStyle={s.art ? styles.center : undefined} />
        {s.list ? (
          <View style={styles.list}>
            {s.list.map((r, k) => (
              <RackFocus key={r.name + k} index={k + 1} step={110}>
                <View style={styles.listRow}>
                  <Text style={styles.listRank}>{k + 1}</Text>
                  {s.listKind ? <ArtThumb kind={s.listKind} name={r.name} artist={r.sub} size={40} /> : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.listName} numberOfLines={1}>{r.name}</Text>
                    {r.sub ? <Text style={styles.listSub} numberOfLines={1}>{r.sub}</Text> : null}
                  </View>
                  <Text style={styles.listValue}>{r.value}</Text>
                </View>
              </RackFocus>
            ))}
          </View>
        ) : s.roll
          ? <RollingNumber value={s.big} style={styles.big} unitStyle={styles.bigUnit} stagger={90} />
          : <FitHeadline text={s.big} style={styles.big} delay={260} stagger={110} containerStyle={s.art ? styles.center : undefined} />}
        {s.clock ? <MiniClock clock={s.clock} /> : null}
        {s.sub ? <KineticText text={s.sub} style={styles.sub} delay={700} stagger={40} containerStyle={s.art ? styles.center : undefined} /> : null}
      </View>

      {s.share && (
        <Pressable
          onPress={share} disabled={sharing}
          style={[styles.shareBtn, { bottom: insets.bottom + 64 }]}
          accessibilityRole="button" accessibilityLabel="Share your story card"
        >
          {sharing ? <ActivityIndicator color="#0d0b14" /> : <Icon name="share-outline" size={18} color="#0d0b14" />}
          <Text style={styles.shareText}>Share card</Text>
        </Pressable>
      )}
      {/* Off-screen, captured on Share. */}
      {s.share && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard ref={card} s={data.comparison.current} all={data.all} palette={s.palette} />
        </View>
      )}

      {paused && <Text style={[styles.paused, { bottom: insets.bottom + 28 }]}>paused · let go to continue</Text>}
      {reduced && !paused && <Text style={[styles.paused, { bottom: insets.bottom + 28 }]}>tap to go on</Text>}
    </View>
  )
}

/** 24 thin bars: when in the day you listen. */
function MiniClock({ clock }: { clock: number[] }) {
  const max = Math.max(...clock, 1)
  const peak = clock.indexOf(max)
  return (
    <View style={styles.clock}>
      {clock.map((v, h) => (
        <View key={h} style={styles.clockCol}>
          <View style={[styles.clockBar, { height: `${Math.max(4, (v / max) * 100)}%`, opacity: h === peak ? 1 : 0.45 }]} />
        </View>
      ))}
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
  bodyArt: { alignItems: 'center' },
  artWrap: {
    marginBottom: Spacing.md, borderRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 18,
  },
  center:  { justifyContent: 'center' },
  kicker:  { fontFamily: FontFamily.mono, fontSize: 16, color: 'rgba(255,255,255,0.86)' },
  big:     { fontFamily: FontFamily.syneBold, fontSize: 46, lineHeight: 52, color: '#fff', letterSpacing: -1.5 },
  bigUnit: { fontFamily: FontFamily.syneBold, fontSize: 26, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  sub:     { fontFamily: FontFamily.mono, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.86)' },
  paused:  { position: 'absolute', alignSelf: 'center', fontFamily: FontFamily.mono, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  list:      { gap: 10, marginTop: Spacing.xs },
  listRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  listRank:  { fontFamily: FontFamily.syneBold, fontSize: 22, color: 'rgba(255,255,255,0.6)', width: 24 },
  listName:  { fontFamily: FontFamily.syneBold, fontSize: 20, lineHeight: 24, color: '#fff', letterSpacing: -0.5 },
  listSub:   { fontFamily: FontFamily.mono, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  listValue: { fontFamily: FontFamily.mono, fontSize: 13, color: 'rgba(255,255,255,0.86)' },
  clock:     { flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 3 },
  clockCol:  { flex: 1, height: '100%', justifyContent: 'flex-end' },
  clockBar:  { width: '100%', borderRadius: 2, backgroundColor: '#fff' },
  shareBtn:  {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, height: 46, borderRadius: 23, backgroundColor: '#fff',
  },
  shareText: { fontFamily: FontFamily.monoMedium, fontSize: 14, color: '#0d0b14' },
  offscreen: { position: 'absolute', left: -CARD_W * 3, top: 0 },
})
