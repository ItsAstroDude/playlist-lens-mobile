import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useMotionReduced } from '@/components/motion'
import { ArtThumb } from '@/components/ui'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useWeekGlance } from '@/hooks/useWeekGlance'
import { fmtClock, useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'
import { requestTabletop } from '@/utils/coverMode'
import { fmtHours } from '@/utils/wrapped'

/**
 * Lenses, half-folded (2.0.31): the "stage" on the half that stands up, between the
 * header and the hinge — the playlists scroll on the flat half below.
 *  · A song playing: its cover, title, progress and play/pause. Tap it for the full
 *    half-folded view (now · 1 · 2).
 *  · Nothing playing: this week — hours, plays, top artist, streak.
 * Rises in on the entrance spring when the phone folds.
 */
export function HalfFoldStage({ height }: { height: number }) {
  const reduced = useMotionReduced()
  const { np } = useNowPlaying()
  const isTrack = !!np?.item && np.type === 'track'
  const k = useSharedValue(reduced ? 1 : 0)
  useEffect(() => { if (!reduced) k.value = withSpring(1, Spring.entrance) }, [])
  const enter = useAnimatedStyle(() => ({ opacity: Math.min(1, k.value * 1.3), transform: [{ translateY: (1 - k.value) * 24 }] }))
  const compact = height < 170
  return (
    <Animated.View style={[styles.wrap, { height }, enter]}>
      {isTrack ? <Song compact={compact} /> : <Week compact={compact} />}
    </Animated.View>
  )
}

function Song({ compact }: { compact: boolean }) {
  const { np } = useNowPlaying()
  const m = useNowPlayingModel(np, true)
  const art = compact ? 72 : 112
  const pct = m.dur > 0 ? Math.min(m.liveMs / m.dur, 1) : 0
  return (
    <Pressable onPress={() => { haptic.light(); requestTabletop() }} style={styles.card}
      accessibilityRole="button" accessibilityLabel={`Now playing: ${m.item?.name ?? ''}. Open the half-folded view`}>
      {m.art ? <Image source={{ uri: m.art }} style={{ width: art, height: art, borderRadius: Radius.lg }} contentFit="cover" transition={200} />
             : <View style={[{ width: art, height: art, borderRadius: Radius.lg }, styles.empty]} />}
      <View style={styles.text}>
        <Text style={styles.overline}>{m.playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
        <Text style={styles.title} numberOfLines={compact ? 1 : 2}>{m.item?.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{m.item?.artists?.join(', ')}</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%` }]} /></View>
        <Text style={styles.clock}>{fmtClock(m.liveMs)} / {fmtClock(m.dur)}</Text>
      </View>
      <Pressable onPress={m.onPlayPause} disabled={m.busy} hitSlop={8} style={styles.play}
        accessibilityRole="button" accessibilityLabel={m.playing ? 'Pause' : 'Play'}>
        <Ionicons name={m.playing ? 'pause' : 'play'} size={22} color={Colors.background} />
      </Pressable>
    </Pressable>
  )
}

function Week({ compact }: { compact: boolean }) {
  const { loaded, week, streak } = useWeekGlance()
  if (!loaded) return <View style={styles.card} />
  if (!week) {
    return (
      <View style={[styles.card, styles.quiet]}>
        <Ionicons name="musical-notes-outline" size={22} color={Colors.textMuted} />
        <Text style={styles.sub}>Nothing playing. Play something on Spotify and it shows up here.</Text>
      </View>
    )
  }
  const artist = week.topArtists[0]
  return (
    <View style={styles.card} accessible
      accessibilityLabel={`This week: ${fmtHours(week.ms)}, ${week.plays} plays${artist ? `, top artist ${artist.name}` : ''}${streak > 1 ? `, ${streak}-day streak` : ''}`}>
      <View style={styles.text}>
        <Text style={styles.overline}>THIS WEEK</Text>
        <Text style={[styles.big, compact && { fontSize: 32, lineHeight: 34 }]}>{fmtHours(week.ms)}</Text>
        <Text style={styles.sub}>{week.plays.toLocaleString()} plays · {week.activeDays} of 7 days</Text>
      </View>
      <View style={styles.side}>
        {artist && (
          <View style={styles.artist}>
            <ArtThumb kind="artist" name={artist.name} size={compact ? 36 : 48} />
            <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
          </View>
        )}
        {streak > 1 && <Text style={styles.streak}>{streak}-day streak</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:     { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, justifyContent: 'flex-end' },
  card:     {
    flex: 1, maxHeight: 180, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, padding: Spacing.lg,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass,
  },
  quiet:    { justifyContent: 'center', gap: Spacing.md },
  empty:    { backgroundColor: Colors.card },
  text:     { flex: 1, minWidth: 0 },
  overline: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, letterSpacing: 2, color: Colors.textMuted },
  title:    { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg + 2, letterSpacing: -0.5, lineHeight: 24, color: Colors.text, marginTop: 4 },
  sub:      { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, flexShrink: 1 },
  track:    { height: 3, borderRadius: 2, backgroundColor: alpha(Colors.greenPrimary, 0.18), marginTop: Spacing.sm, overflow: 'hidden' },
  fill:     { height: 3, borderRadius: 2, backgroundColor: Colors.greenPrimary },
  clock:    { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  play:     { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.greenPrimary },
  big:      { fontFamily: FontFamily.syneBold, fontSize: 44, letterSpacing: -1.5, lineHeight: 46, color: Colors.text, marginTop: 2 },
  side:     { alignItems: 'flex-end', gap: Spacing.sm, maxWidth: 140 },
  artist:   { alignItems: 'center', gap: 4 },
  artistName: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.text },
  streak:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: '#FFB347' },
})
