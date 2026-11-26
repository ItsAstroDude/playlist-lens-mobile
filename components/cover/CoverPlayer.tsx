import React, { useEffect, useState } from 'react'
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useMotionReduced } from '@/components/motion'
import { fmtMinutesShort } from '@/utils/wrapped'
import { fetchDevices } from '@/utils/playback'
import type { NowPlaying } from '@/hooks/useNowPlaying'
import { fmtClock, useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'
import { usePageLinks } from '@/hooks/usePageLinks'
import { useLiveWindow } from '@/utils/liveWindow'

/**
 * Now playing on the Flip's cover screen (2.0.27), after Samsung's open Now Bar: the
 * cover fills the screen, dimmed; the device on top; the title (scrolling when it's too
 * long) and artists centred; a scrubber line with times; big round controls. Your numbers
 * for the song sit bottom-left, beside the cameras (the ring round them keeps showing
 * progress). Close with the arrow, back, or a swipe down.
 *
 * Opened from the ring round the cameras or the bento's now-playing tile (it replaces
 * the Now Playing sheet there). Seek, shuffle and save need backend support first.
 */
export function CoverPlayer({ np, open, onClose }: { np: NowPlaying | null; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const { width: W } = useLiveWindow()
  const reduced = useMotionReduced()
  const [mounted, setMounted] = useState(open)
  const m = useNowPlayingModel(np, mounted)

  // Which device is playing ("This phone" when it's the phone itself).
  const [device, setDevice] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    let alive = true
    fetchDevices()
      .then(ds => { if (alive) { const d = ds.find(x => x.is_active); setDevice(d ? (d.type === 'Smartphone' ? 'This phone' : d.name) : null) } })
      .catch(() => {})
    return () => { alive = false }
  }, [open])

  // ── open / close ──
  const k = useSharedValue(0)
  const drag = useSharedValue(0)
  useEffect(() => {
    if (open) {
      setMounted(true)
      drag.value = 0
      k.value = reduced ? withTiming(1, { duration: 180 }) : withSpring(1, Spring.default)
    } else {
      k.value = withTiming(0, { duration: 200 }, done => { if (done) runOnJS(setMounted)(false) })
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true })
    return () => sub.remove()
  }, [open, onClose])

  const swipe = Gesture.Pan()
    .activeOffsetY(12).failOffsetX([-30, 30])
    .onUpdate(e => { drag.value = Math.max(0, e.translationY) })
    .onEnd(e => {
      if (e.translationY > 90 || e.velocityY > 900) runOnJS(onClose)()
      else drag.value = withSpring(0, Spring.snappy)
    })
  const rootStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, k.value),
    transform: [{ translateY: drag.value }, { scale: 0.94 + 0.06 * Math.min(1, k.value) }],
  }))

  // ── the title scrolls when it doesn't fit (only while open) ──
  const [boxW, setBoxW] = useState(0)
  const [textW, setTextW] = useState(0)
  const x = useSharedValue(0)
  const overflow = textW - boxW
  useEffect(() => {
    cancelAnimation(x)
    x.value = 0
    if (!open || reduced || overflow <= 4) return
    const dist = overflow + 24
    x.value = withRepeat(withSequence(
      withDelay(1600, withTiming(-dist, { duration: dist * 32, easing: Easing.linear })),
      withDelay(1600, withTiming(0, { duration: 0 })),
    ), -1)
    return () => cancelAnimation(x)
  }, [open, reduced, overflow, m.item?.id])
  const marquee = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  // Tap the title (or your numbers) for the song's page, the artists for the artist's (2.0.43).
  const { openSong, openArtist } = usePageLinks(m.item?.name, m.item?.artists?.[0], open, onClose)

  if (!mounted) return null
  const { item, stats, dur, liveMs, playing, busy, art, pal } = m
  const pct = dur > 0 ? Math.min(liveMs / dur, 1) : 0
  const tint = pal?.detail ?? Colors.greenPrimary
  const fits = overflow <= 4
  const line = stats?.stat
    ? `${stats.stat.plays.toLocaleString()} plays · ${fmtMinutesShort(stats.stat.ms)}${stats.rank != null ? ` · your #${stats.rank.toLocaleString()}` : ''}`
    : stats?.imported ? 'first listen?' : ''

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} accessibilityViewIsModal>
        {art ? <Image source={{ uri: art }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
             : <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.card }]} />}
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.7)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />

        <View style={[styles.top, { top: insets.top + Spacing.sm }]}>
          <Pressable onPress={() => { haptic.light(); onClose() }} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.device} numberOfLines={1}>{device ?? 'Spotify'}</Text>
          <Pressable onPress={m.onOpenSpotify} hitSlop={10} style={styles.iconBtn} accessibilityRole="link" accessibilityLabel="Open in Spotify">
            <Ionicons name="open-outline" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.titleBox, { top: insets.top + 72 }]} onLayout={e => setBoxW(e.nativeEvent.layout.width)}>
          {/* measured off-screen at its natural width */}
          <Text style={[styles.title, styles.measure]} onLayout={e => setTextW(e.nativeEvent.layout.width)} numberOfLines={1}>{item?.name}</Text>
          <Animated.Text style={[styles.title, fits ? styles.center : { width: textW }, marquee]} numberOfLines={1}
            onPress={openSong} suppressHighlighting
            accessibilityRole={openSong ? 'link' : 'header'} accessibilityHint={openSong ? 'Opens your page for this song' : undefined}>{item?.name}</Animated.Text>
          <Text style={styles.artists} numberOfLines={1} onPress={openArtist} suppressHighlighting
            accessibilityRole={openArtist ? 'link' : undefined}>{item?.artists?.join(', ')}</Text>
        </View>

        <View style={[styles.scrub, { top: insets.top + 170 }]} accessible accessibilityRole="progressbar"
          accessibilityLabel={`${fmtClock(liveMs)} of ${fmtClock(dur)}`}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: tint }]} />
            <View style={[styles.thumb, { left: `${pct * 100}%`, backgroundColor: tint, shadowColor: tint }]} />
          </View>
          <View style={styles.times}>
            <Text style={styles.time}>{fmtClock(liveMs)}</Text>
            <Text style={styles.time}>{fmtClock(dur)}</Text>
          </View>
        </View>

        <View style={[styles.controls, { top: insets.top + 236, width: Math.min(W - Spacing.xl * 2, 360) }]}>
          <Pressable onPress={m.onPrev} disabled={busy} style={styles.round} accessibilityRole="button" accessibilityLabel="Previous track">
            <Ionicons name="play-skip-back" size={26} color="#fff" />
          </Pressable>
          <Pressable onPress={m.onPlayPause} disabled={busy} style={[styles.round, styles.roundBig]} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
            <Ionicons name={playing ? 'pause' : 'play'} size={32} color="#fff" />
          </Pressable>
          <Pressable onPress={m.onNext} disabled={busy} style={styles.round} accessibilityRole="button" accessibilityLabel="Next track">
            <Ionicons name="play-skip-forward" size={26} color="#fff" />
          </Pressable>
        </View>

        {!!line && <Text style={[styles.stats, { bottom: Math.max(insets.bottom, Spacing.xl) }]} numberOfLines={2}
          onPress={openSong} suppressHighlighting accessibilityRole={openSong ? 'link' : undefined}>{line}{openSong ? '  ›' : ''}</Text>}
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  root:     { zIndex: 30, elevation: 30, backgroundColor: '#000', overflow: 'hidden' },
  top:      { position: 'absolute', left: Spacing.md, right: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  device:   { flex: 1, fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: '#fff' },
  titleBox: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, overflow: 'hidden', alignItems: 'flex-start' },
  measure:  { position: 'absolute', opacity: 0, width: 2000, left: -4000 },
  title:    { fontFamily: FontFamily.syneBold, fontSize: 28, letterSpacing: -0.5, lineHeight: 36, color: '#fff' },
  center:   { alignSelf: 'stretch', textAlign: 'center' },
  artists:  { alignSelf: 'stretch', textAlign: 'center', fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: 'rgba(255,255,255,0.88)', marginTop: 4 },
  scrub:    { position: 'absolute', left: Spacing.xl + 4, right: Spacing.xl + 4, gap: Spacing.sm },
  track:    { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center' },
  fill:     { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  thumb:    { position: 'absolute', width: 22, height: 22, marginLeft: -11, borderRadius: 11, borderWidth: 3, borderColor: '#fff', shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  times:    { flexDirection: 'row', justifyContent: 'space-between' },
  time:     { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: '#fff' },
  controls: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round:    { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  roundBig: { width: 84, height: 84, borderRadius: 42, backgroundColor: alpha('#ffffff', 0.22) },
  stats:    { position: 'absolute', left: Spacing.xl, maxWidth: 200, fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)' },
})
