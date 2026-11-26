import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming, withRepeat, withSequence, runOnJS,
} from 'react-native-reanimated'
import { Colors, OnDark, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { Icon } from '@/components/ui/Icon'
import { ArtThumb } from '@/components/ui'
import { RollingNumber, useMotionReduced } from '@/components/motion'
import { CameraRing } from './CameraRing'
import { toDp, panelScale, stadium } from './outline'
import { useRingProgress, type RingTrack } from './useRingProgress'
import { useNowPlaying, pokeNowPlaying } from '@/hooks/useNowPlaying'
import { usePalette } from '@/hooks/usePalette'
import { getCameraOutline } from '@/utils/settings'
import { storage } from '@/utils/cache'
import { setCoverFullApp } from '@/utils/coverMode'
import { showToast } from '@/utils/dialog'
import {
  resumePlayback, pausePlayback, skipNext, skipPrevious,
  classifyPlaybackError, transportErrorMessage, setPlaybackScopeMissing,
} from '@/utils/playback'
import { cachedAsync } from '@/utils/sqlJob'
import { periodStatsJob, type PeriodStats } from '@/utils/stats'
import { fmtHours } from '@/utils/wrapped'
import { useLiveWindow } from '@/utils/liveWindow'

const SECTIONS = ['now playing', 'this week', 'more'] as const
const HINT_KEY = 'cover.hintSeen.v2'
/** Keep swipes off the system's back-gesture edges. */
const EDGE = 28

/**
 * The cover-screen app (Galaxy Z Flip): a compact UI built round the cameras.
 * Swipe left/right between sections; the camera ring shows the song's progress.
 * Mounted over the normal app while the cover screen is in use (see CoverHost).
 *
 * Layout: the cameras sit bottom-right and Samsung's "open on main screen" button
 * bottom-centre, so content lives in the upper area and the left column.
 */
export function CoverApp() {
  const insets = useSafeAreaInsets()
  const { width: W, height: H } = useLiveWindow()
  const reduced = useMotionReduced()

  // ── the ring ──
  const outline = useMemo(() => toDp(getCameraOutline(), panelScale(W)), [W])
  const ringTop = stadium(outline, 7).top
  const { np } = useNowPlaying()
  const item = np?.item ?? null
  const track: RingTrack | null = item && item.duration_ms
    ? { id: item.id, playing: np!.is_playing, progressMs: np!.progress_ms ?? 0, durationMs: item.duration_ms, receivedAt: np!.receivedAt }
    : null
  const progress = useRingProgress(track, reduced)

  const art = item?.album?.images?.[0]?.url ?? null
  const { palettes, extract } = usePalette()
  const palKey = item?.id ? `np-${item.id}` : null
  useEffect(() => { if (palKey && art) extract(palKey, art) }, [palKey, art])
  const pal = palKey ? palettes[palKey] : undefined
  const ringColors: [string, string] = pal ? [pal.detail, pal.primary] : [Colors.greenPrimary, Colors.greenPrimary]
  const bg: [string, string, string] = pal ? [alpha(pal.primary, 0.55), alpha(pal.background, 0.9), '#000000'] : ['#101413', '#07090a', '#000000']

  // ── sections: a horizontal pager driven by a spring ──
  const [page, setPage] = useState(0)
  const x = useSharedValue(0)          // in pages; follows the finger while dragging
  const go = useCallback((p: number) => {
    const n = Math.max(0, Math.min(SECTIONS.length - 1, p))
    if (n !== page) haptic.light()
    setPage(n)
    x.value = reduced ? n : withSpring(n, Spring.default)
    if (!storage.getBoolean(HINT_KEY)) storage.set(HINT_KEY, true)
  }, [page, reduced])

  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16]).failOffsetY([-24, 24])
    .hitSlop({ left: -EDGE, right: -EDGE })
    .onChange(e => { 'worklet'; x.value = Math.max(-0.15, Math.min(SECTIONS.length - 0.85, x.value - e.changeX / W)) })
    .onEnd(e => {
      'worklet'
      const flick = Math.abs(e.velocityX) > 500 ? (e.velocityX < 0 ? 1 : -1) : 0
      const target = Math.round(x.value + flick * 0.5)
      runOnJS(go)(target)
    })

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -x.value * W }] }))

  // ── first-time hint: a pill in the empty top-right, its arrows sliding side to side.
  //    Goes on the first swipe, on tap, or after 8 s. ──
  const [showHint, setShowHint] = useState(() => !storage.getBoolean(HINT_KEY))
  const slide = useSharedValue(0)
  useEffect(() => {
    if (!showHint) return
    if (!reduced) slide.value = withDelay(600, withRepeat(withSequence(withTiming(-6, { duration: 320 }), withSpring(6, Spring.bouncy), withSpring(0, Spring.snappy)), 4))
    const t = setTimeout(() => { setShowHint(false); storage.set(HINT_KEY, true) }, 8000)
    return () => clearTimeout(t)
  }, [showHint, reduced])
  useEffect(() => { if (page > 0) setShowHint(false) }, [page])
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value }] }))

  const contentBottom = Math.max(ringTop - 8, H * 0.55)

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Opaque: the normal app stays mounted underneath and must not show through. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
      <LinearGradient colors={bg} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      <CameraRing outline={outline} progress={progress} playing={!!track?.playing} colors={ringColors} />

      <GestureDetector gesture={swipe}>
        <View style={[styles.fill, { paddingTop: insets.top + Spacing.sm }]}>
          {/* section dots + name */}
          <View style={styles.dots} accessibilityRole="tablist">
            {SECTIONS.map((s, i) => (
              <Pressable key={s} onPress={() => go(i)} hitSlop={8} accessibilityRole="tab"
                accessibilityLabel={s} accessibilityState={{ selected: i === page }}>
                <View style={[styles.dot, i === page && styles.dotOn]} />
              </Pressable>
            ))}
            <Text style={styles.sectionName}>{SECTIONS[page]}</Text>
          </View>

          <Animated.View style={styles.fill}>
            <Animated.View style={[styles.row, { width: W * SECTIONS.length }, rowStyle]}>
              <View style={[styles.page, { width: W, maxHeight: contentBottom }]}>
                <NowPlayingSection np={np} art={art} />
              </View>
              <View style={[styles.page, { width: W, maxHeight: contentBottom }]}>
                <WeekSection active={page === 1} />
              </View>
              <View style={[styles.page, { width: W, maxHeight: contentBottom }]}>
                <MoreSection />
              </View>
            </Animated.View>
          </Animated.View>

          {showHint && (
            <Pressable onPress={() => { setShowHint(false); storage.set(HINT_KEY, true) }}
              style={[styles.hintPill, { top: insets.top + 40 }]} accessibilityRole="button"
              accessibilityLabel="Swipe left and right between sections. Tap to dismiss.">
              <Animated.View style={arrowStyle}><Icon name="swap-horizontal" size={18} color="#000" /></Animated.View>
              <Text style={styles.hintText}>Swipe for This week{'\n'}and more</Text>
            </Pressable>
          )}

        </View>
      </GestureDetector>
    </View>
  )
}

// ─── Now playing ──────────────────────────────────────────────────────────────
function NowPlayingSection({ np, art }: { np: ReturnType<typeof useNowPlaying>['np']; art: string | null }) {
  const item = np?.item ?? null
  const [override, setOverride] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setOverride(null) }, [np?.is_playing, item?.uri])
  const playing = override ?? (np?.is_playing ?? false)

  const control = useCallback(async (fn: () => Promise<void>, optimistic?: boolean) => {
    if (busy) return
    haptic.light()
    if (optimistic !== undefined) setOverride(optimistic)
    setBusy(true)
    try { await fn() } catch (err) {
      setOverride(null)
      haptic.warning()
      const kind = classifyPlaybackError(err)
      if (kind === 'scope') setPlaybackScopeMissing(true)
      showToast(transportErrorMessage(kind), 'alert-circle-outline')
    }
    setTimeout(() => { pokeNowPlaying(); setBusy(false) }, 500)
  }, [busy])
  const toggle = () => (playing ? control(pausePlayback, false) : control(resumePlayback, true))
  const openInSpotify = () => {
    if (!item?.uri) return
    haptic.medium()
    Linking.openURL(item.uri).catch(() => { if (item.id) Linking.openURL(`https://open.spotify.com/track/${item.id}`).catch(() => {}) })
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Icon name="musical-notes-outline" size={34} color={OnDark.textMuted} />
        <Text style={styles.big}>Nothing playing</Text>
        <Text style={styles.muted}>Play something on Spotify and it shows up here, with the ring round your cameras.</Text>
      </View>
    )
  }

  return (
    <View style={styles.np}>
      {/* tap the art: play / pause · hold: open in Spotify */}
      <Pressable onPress={toggle} onLongPress={openInSpotify} delayLongPress={450}
        accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} accessibilityHint="Hold to open in Spotify">
        {art
          ? <Image source={{ uri: art }} style={styles.art} contentFit="cover" transition={150} />
          : <View style={[styles.art, styles.artEmpty]}><Icon name="musical-note" size={40} color={OnDark.textMuted} /></View>}
        {!playing && (
          <View style={styles.pausedBadge}><Icon name="pause" size={16} color="#fff" /></View>
        )}
      </Pressable>
      <Text style={styles.kicker}>{playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
      <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.muted} numberOfLines={1}>{item.artists.join(', ')}</Text>
      <View style={styles.controls}>
        <RoundBtn icon="play-skip-back" label="Previous" onPress={() => control(skipPrevious)} />
        <RoundBtn icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} onPress={toggle} big />
        <RoundBtn icon="play-skip-forward" label="Next" onPress={() => control(skipNext)} />
      </View>
    </View>
  )
}

// ─── This week ────────────────────────────────────────────────────────────────
function WeekSection({ active }: { active: boolean }) {
  const [s, setS] = useState<PeriodStats | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!active || loaded) return
    let alive = true
    cachedAsync('cover.week', 'v1', () => periodStatsJob('week', { topN: 1 }))
      .then(v => { if (alive) { setS(v); setLoaded(true) } })
      .catch(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [active, loaded])

  if (!loaded) return <View style={styles.center}><Text style={styles.muted}>Adding up your week…</Text></View>
  if (!s || !s.plays) {
    return (
      <View style={styles.center}>
        <Text style={styles.big}>A quiet week</Text>
        <Text style={styles.muted}>Nothing tracked yet this week. Turn on tracking in Settings to fill this in.</Text>
      </View>
    )
  }
  const artist = s.topArtists[0], song = s.topTracks[0]
  return (
    <View style={styles.week}>
      <Text style={styles.kicker}>LISTENED THIS WEEK</Text>
      <RollingNumber value={fmtHours(s.ms)} style={styles.hours} />
      <Text style={styles.muted}>{s.plays} plays · {s.artists} artists · {s.activeDays} of 7 days</Text>
      {artist && (
        <View style={styles.topRow}>
          <ArtThumb kind="artist" name={artist.name} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>TOP ARTIST</Text>
            <Text style={styles.rowName} numberOfLines={1}>{artist.name}</Text>
          </View>
        </View>
      )}
      {song && (
        <View style={styles.topRow}>
          <ArtThumb kind="track" name={song.name} artist={song.sub} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>TOP SONG</Text>
            <Text style={styles.rowName} numberOfLines={1}>{song.name}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

// ─── More ─────────────────────────────────────────────────────────────────────
function MoreSection() {
  return (
    <View style={styles.more}>
      <Text style={styles.big}>Everything else</Text>
      <Text style={styles.muted}>Open the phone for Lenses, Queue, Play and Rewind. It picks up right where you are.</Text>
      <Pressable onPress={() => { haptic.medium(); setCoverFullApp(true) }} accessibilityRole="button"
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}>
        <Icon name="expand-outline" size={16} color={OnDark.text} />
        <Text style={styles.pillText}>Use the full app on this screen</Text>
      </Pressable>
      <Text style={styles.tiny}>Tap the cover to play or pause. Hold it to open the song in Spotify.</Text>
    </View>
  )
}

function RoundBtn({ icon, label, onPress, big = false }: { icon: 'play' | 'pause' | 'play-skip-back' | 'play-skip-forward'; label: string; onPress: () => void; big?: boolean }) {
  const d = big ? 56 : 44
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.round, { width: d, height: d, borderRadius: d / 2 }, big && styles.roundBig, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Icon name={icon} size={big ? 26 : 20} color={big ? '#000' : OnDark.text} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill:        { flex: 1 },
  row:         { flexDirection: 'row', flex: 1 },
  page:        { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  center:      { flex: 1, justifyContent: 'center', gap: 6, paddingBottom: 40, maxWidth: 300 },

  dots:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, height: 24 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn:       { width: 18, backgroundColor: '#fff' },
  sectionName: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: OnDark.textMuted, marginLeft: 6, letterSpacing: 1, textTransform: 'uppercase' },

  np:          { gap: 4 },
  art:         { width: 150, height: 150, borderRadius: Radius.lg, marginBottom: Spacing.sm },
  artEmpty:    { backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  pausedBadge: { position: 'absolute', left: 8, top: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  kicker:      { fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 1.5, color: OnDark.textMuted },
  title:       { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: OnDark.text, letterSpacing: -0.5, maxWidth: 360 },
  big:         { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: OnDark.text, letterSpacing: -0.5 },
  muted:       { fontFamily: FontFamily.mono, fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.45, color: OnDark.textMuted, maxWidth: 340 },
  controls:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  round:       { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  roundBig:    { backgroundColor: '#fff', borderColor: '#fff' },

  week:        { gap: 6 },
  hours:       { fontFamily: FontFamily.syneBold, fontSize: 44, color: OnDark.text },
  topRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm, maxWidth: 300 },
  rowName:     { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: OnDark.text },

  more:        { gap: Spacing.sm, maxWidth: 360 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, height: 40, borderRadius: 20,
                 backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginTop: Spacing.sm },
  pillText:    { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: OnDark.text },
  tiny:        { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: OnDark.textMuted, marginTop: Spacing.md },
  hintPill:    { position: 'absolute', right: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 8,
                 paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: '#fff' },
  hintText:    { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: '#000' },
})
