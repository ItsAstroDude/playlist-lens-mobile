import React, { useEffect, useState } from 'react'
import { BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { Aurora } from '@/components/motion/Aurora'
import { useMotionReduced } from '@/components/motion'
import { fmtMinutesShort } from '@/utils/wrapped'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { usePosture } from '@/hooks/usePosture'
import { useIsCover } from '@/hooks/useScreen'
import { tabletopSplit } from '@/utils/posture'
import { onFoldSettings, setTabletopLayout, tabletopEnabled, tabletopLayout, type TabletopLayout } from '@/utils/settings'
import { UpNextPad, UpNextStrip, UpNextTop, useUpNext } from './UpNext'
import { requestTabletop, setTabletopActive, useTabletopRequested } from '@/utils/coverMode'
import { fmtClock, useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'

/**
 * Half-folded on the main screen (Flex mode / tabletop): stand the phone on the desk and
 * Now Playing splits at the hinge — the cover and the song on the half that stands up,
 * big controls and your numbers for the song on the half lying flat. Open the phone
 * flat (or tap the arrow) and it springs away, back to wherever you were.
 *
 * Shows while a song is playing and the hinge runs across the screen: by itself when you
 * fold (Labs switch, on by default), or when asked for (Lenses' cover button, folded).
 * Labs also has "simulate" to try it flat.
 */
export function TabletopNowPlaying() {
  const { width: W, height: H } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduced = useMotionReduced()
  const posture = usePosture()
  const cover = useIsCover()
  const { np } = useNowPlaying()

  const [enabled, setEnabled] = useState(tabletopEnabled)
  useEffect(() => onFoldSettings(() => setEnabled(tabletopEnabled())), [])

  // Dismissed with the arrow: stays away until the phone leaves the half fold.
  const [dismissed, setDismissed] = useState(false)
  const half = posture.state === 'half'
  const asked = useTabletopRequested()
  useEffect(() => { if (!half) { setDismissed(false); requestTabletop(false) } }, [half])

  const split = cover ? null : tabletopSplit(posture, H)
  const isTrack = !!np?.item && np.type === 'track'
  // By itself when you fold (Labs switch), or when asked for (cover button / stage).
  const show = !!split && isTrack && (asked || (enabled && !dismissed))

  // Stay mounted through the exit, then unmount (the aurora redraws every frame).
  const [mounted, setMounted] = useState(show)
  const vis = useSharedValue(0)
  useEffect(() => {
    if (show) {
      setMounted(true)
      haptic.light()
      vis.value = reduced ? withTiming(1, { duration: 180 }) : withSpring(1, Spring.entrance)
    } else {
      vis.value = withTiming(0, { duration: 200 }, done => { if (done) runOnJS(setMounted)(false) })
    }
  }, [show])
  useEffect(() => { setTabletopActive(show) }, [show])
  useEffect(() => () => setTabletopActive(false), [])

  useEffect(() => {
    if (!show) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setDismissed(true); requestTabletop(false); return true })
    return () => sub.remove()
  }, [show])

  // Keep the last song + split on screen while it springs away.
  const lastNp = React.useRef(np)
  if (isTrack) lastNp.current = np
  const lastSplit = React.useRef(split)
  if (split) lastSplit.current = split
  const m = useNowPlayingModel(isTrack ? np : lastNp.current, mounted)

  // Which layout: Now playing, or up next as C+D 1 (deck + strip) / C+D 2 (deck on pad).
  const [layout, setLayout] = useState<TabletopLayout>(tabletopLayout)
  useEffect(() => onFoldSettings(() => setLayout(tabletopLayout())), [])
  const upNext = useUpNext(m.item?.id, mounted && layout !== 'now')

  // A new song: the cover pops in on the bouncy spring.
  const pop = useSharedValue(1)
  useEffect(() => {
    if (!mounted || reduced || !m.item?.id) return
    pop.value = withSequence(withTiming(0.9, { duration: 90 }), withSpring(1, Spring.bouncy))
  }, [m.item?.id])

  // The standing half drops in from above, the flat half rises from below.
  const rootStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, vis.value) }))
  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateY: reduced ? 0 : (1 - vis.value) * -56 }] }))
  const bottomStyle = useAnimatedStyle(() => ({ transform: [{ translateY: reduced ? 0 : (1 - vis.value) * 72 }] }))
  const artStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }))

  // Keep the last song's colours while the new cover's are worked out: dropping them
  // swapped the aurora for a plain fill and back, a grey flash on every song change.
  const lastAurora = React.useRef(m.auroraColors)
  if (m.auroraColors) lastAurora.current = m.auroraColors
  const s = split ?? lastSplit.current
  if (!mounted || !s) return null

  const topH = s.top, bottomH = s.bottom
  const accent = Colors.greenPrimary
  const titleBlock = 96                      // kind + two title lines + artist
  const artSize = Math.max(96, Math.min(topH - insets.top - titleBlock - Spacing['2xl'], W * 0.6, 300))
  const { item, stats, dur, liveMs, playing, busy, art, initial } = m
  const auroraColors = lastAurora.current
  const pct = dur > 0 ? Math.min(liveMs / dur, 1) : 0

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents={show ? 'auto' : 'none'}
      accessibilityViewIsModal={show}>
      {auroraColors
        ? <Aurora colors={auroraColors} base={Colors.background} dim={0.48} style={StyleSheet.absoluteFill} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.background }]} />}

      {layout !== 'now' ? (
        <>
          <Animated.View style={topStyle}>
            <UpNextTop m={m} state={upNext.state} W={W} height={topH} padTop={insets.top + 56} skipFirst={layout === 'pad'} />
          </Animated.View>
          <Animated.View style={bottomStyle}>
            {layout === 'strip'
              ? <UpNextStrip m={m} state={upNext.state} refresh={upNext.refresh} W={W} height={bottomH} padBottom={Math.max(insets.bottom, Spacing.lg)} />
              : <UpNextPad m={m} state={upNext.state} refresh={upNext.refresh} W={W} height={bottomH} padBottom={Math.max(insets.bottom, Spacing.lg)} />}
          </Animated.View>
        </>
      ) : (<>
      {/* ── the half that stands up ── */}
      <Animated.View style={[styles.top, { height: topH, paddingTop: insets.top + Spacing.md }, topStyle]}>
        <Animated.View style={[styles.artWrap, { width: artSize, height: artSize, shadowColor: accent }, artStyle]}>
          {art ? (
            <Image source={{ uri: art }} style={styles.art} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={[`${accent}55`, `${accent}11`]} style={styles.art}>
              <Text style={[styles.initial, { color: accent, fontSize: artSize * 0.42 }]}>{initial}</Text>
            </LinearGradient>
          )}
        </Animated.View>
        <Text style={styles.kind}>{playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
        <Text style={styles.name} numberOfLines={2}>{item?.name}</Text>
        {!!item?.artists?.length && <Text style={styles.artist} numberOfLines={1}>{item.artists.join(', ')}</Text>}
      </Animated.View>

      {/* ── the half lying flat: controls within thumb reach ── */}
      <Animated.View style={[styles.bottom, { height: bottomH, paddingBottom: Math.max(insets.bottom, Spacing.lg) }, bottomStyle]}>
        {dur > 0 && (
          <View style={styles.progress}>
            <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%` }]} /></View>
            <View style={styles.clocks}>
              <Text style={styles.clock}>{fmtClock(liveMs)}</Text>
              <Text style={styles.clock}>{fmtClock(dur)}</Text>
            </View>
          </View>
        )}

        <View style={styles.controls}>
          <Pressable onPress={m.onPrev} disabled={busy} hitSlop={10} style={styles.ctrlBtn} accessibilityRole="button" accessibilityLabel="Previous track">
            <Ionicons name="play-skip-back" size={30} color={Colors.text} />
          </Pressable>
          <Pressable onPress={m.onPlayPause} disabled={busy} style={[styles.play, { backgroundColor: accent }]} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
            <Ionicons name={playing ? 'pause' : 'play'} size={34} color={Colors.background} />
          </Pressable>
          <Pressable onPress={m.onNext} disabled={busy} hitSlop={10} style={styles.ctrlBtn} accessibilityRole="button" accessibilityLabel="Next track">
            <Ionicons name="play-skip-forward" size={30} color={Colors.text} />
          </Pressable>
        </View>

        {stats?.stat ? (
          <View style={styles.statRow}>
            <View style={styles.chip}>
              <Text style={[styles.chipVal, { color: accent }]}>{stats.stat.plays.toLocaleString()}</Text>
              <Text style={styles.chipLbl}>your plays</Text>
            </View>
            <View style={styles.chip}>
              <Text style={[styles.chipVal, { color: accent }]}>{fmtMinutesShort(stats.stat.ms)}</Text>
              <Text style={styles.chipLbl}>listened</Text>
            </View>
            {stats.rank != null && (
              <View style={styles.chip}>
                <Text style={[styles.chipVal, { color: accent }]}>#{stats.rank.toLocaleString()}</Text>
                <Text style={styles.chipLbl}>all time</Text>
              </View>
            )}
          </View>
        ) : stats?.imported ? <Text style={styles.hint}>no plays in your history yet — first listen?</Text> : null}

        <Pressable onPress={m.onOpenSpotify} hitSlop={8} style={styles.spotify} accessibilityRole="button" accessibilityLabel="Open in Spotify">
          <Ionicons name="open-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.spotifyText}>open in spotify</Text>
        </Pressable>
      </Animated.View>
      </>)}

      {/* ── layout switch + close, top right of the standing half ── */}
      <View style={[styles.chrome, { top: insets.top + Spacing.sm }]}>
        <View style={styles.switch} accessibilityRole="radiogroup" accessibilityLabel="Half-folded layout">
          {LAYOUTS.map(o => {
            const on = layout === o.id
            return (
              <Pressable key={o.id} onPress={() => { if (!on) { haptic.light(); setTabletopLayout(o.id) } }}
                style={[styles.switchItem, on && styles.switchItemOn]} accessibilityRole="radio"
                accessibilityState={{ selected: on }} accessibilityLabel={o.label}>
                <Text style={[styles.switchText, on && styles.switchTextOn]}>{o.short}</Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable onPress={() => { haptic.light(); setDismissed(true); requestTabletop(false) }} hitSlop={12} style={styles.close}
          accessibilityRole="button" accessibilityLabel="Close tabletop view">
          <Ionicons name="chevron-down" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  )
}

const LAYOUTS: { id: TabletopLayout; short: string; label: string }[] = [
  { id: 'now',   short: 'now', label: 'Now playing' },
  { id: 'strip', short: '1',   label: 'Up next: deck over a touch strip' },
  { id: 'pad',   short: '2',   label: 'Up next: deck on the pad' },
]

const styles = StyleSheet.create({
  root:    { zIndex: 60, elevation: 60 },
  top:     { alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  artWrap: {
    borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md,
    shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.5, shadowRadius: 26, elevation: 16,
  },
  art:     { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: FontFamily.syneBold },
  kind:    { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2 },
  name:    { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, textAlign: 'center', letterSpacing: -0.5, marginTop: 2 },
  artist:  { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  close:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.glass },
  chrome:  { position: 'absolute', right: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, zIndex: 5 },
  switch:  { flexDirection: 'row', padding: 3, gap: 2, borderRadius: Radius.full, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder },
  switchItem:   { minWidth: 36, height: 34, paddingHorizontal: 10, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  switchItemOn: { backgroundColor: Colors.text },
  switchText:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  switchTextOn: { color: Colors.background },

  bottom:  { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, justifyContent: 'space-evenly' },
  progress: { gap: 6 },
  track:   { height: 5, borderRadius: 3, backgroundColor: alpha(Colors.greenPrimary, 0.18), overflow: 'hidden' },
  fill:    { height: 5, borderRadius: 3, backgroundColor: Colors.greenPrimary },
  clocks:  { flexDirection: 'row', justifyContent: 'space-between' },
  clock:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing['3xl'] },
  ctrlBtn: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  play:    {
    width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.greenPrimary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  statRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  chip:    {
    flex: 1, maxWidth: 120, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  chipVal: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, letterSpacing: -0.5 },
  chipLbl: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  hint:    { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  spotify: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center' },
  spotifyText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
})
