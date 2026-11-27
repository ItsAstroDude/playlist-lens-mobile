import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { router } from 'expo-router'
import { ArtThumb } from '@/components/ui'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useWeekGlance } from '@/hooks/useWeekGlance'
import { useNowPlayingModel, fmtClock } from '@/components/nowplaying/useNowPlayingModel'
import { emitOpenNowPlaying } from '@/utils/overlayEvents'
import { fmtHours } from '@/utils/wrapped'
import { bentoSizes } from '@/utils/bento'

/**
 * Lenses on the Flip's cover screen (2.0.26): a bento above the playlist tiles.
 *
 *   ┌───────────────┬───────┐
 *   │  now playing  │ week  │
 *   │  (2 × 2)      ├───────┤
 *   │               │ top + │
 *   └───────────────┴───────┘
 *   [lens] [lens] [lens]          ← the playlists, three across (PlaylistCard 'tile')
 *
 * The big tile is the song (tap = Now playing, the button = play/pause); with nothing
 * playing it says so. The week tiles read the tracked plays (nothing tracked = a nudge).
 */
export function CoverBento() {
  // Sized by the width the list actually gives it, the same width the tiles below are
  // cut from (the window Android reports can be stale after Samsung's resize).
  const [W, setW] = useState(0)
  const { tile, big, gap } = bentoSizes(W)
  return (
    <View onLayout={e => setW(Math.round(e.nativeEvent.layout.width))}>
      {W > 0 && (
        <View style={[styles.wrap, { gap }]}>
          <NowTile size={big} />
          <View style={{ gap }}>
            <WeekTiles size={tile} gap={gap} />
          </View>
        </View>
      )}
    </View>
  )
}

function NowTile({ size }: { size: number }) {
  const { np } = useNowPlaying()
  const isTrack = !!np?.item && np.type === 'track'
  const m = useNowPlayingModel(isTrack ? np : null, isTrack)
  if (!isTrack) {
    return (
      <View style={[styles.now, styles.nowEmpty, { width: size, height: size }]}>
        <Ionicons name="musical-notes-outline" size={28} color={Colors.textMuted} />
        <Text style={styles.emptyText}>Nothing playing</Text>
        <Text style={styles.emptyHint}>Play something on Spotify and it shows up here.</Text>
      </View>
    )
  }
  const pct = m.dur > 0 ? Math.min(m.liveMs / m.dur, 1) : 0
  return (
    <Pressable onPress={() => { haptic.light(); emitOpenNowPlaying() }}
      style={[styles.now, { width: size, height: size }]}
      accessibilityRole="button" accessibilityLabel={`Now playing: ${m.item?.name ?? ''}. Open`}>
      {m.art
        ? <Image source={{ uri: m.art }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.card }]} />}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.nowFoot}>
        <View style={styles.nowText}>
          <Text style={styles.overline}>{m.playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
          <Text style={styles.nowTitle} numberOfLines={2}>{m.item?.name}</Text>
          <Text style={styles.nowSub} numberOfLines={1}>{m.item?.artists?.[0]}{m.dur > 0 ? ` · ${fmtClock(m.liveMs)} / ${fmtClock(m.dur)}` : ''}</Text>
        </View>
        <Pressable onPress={m.onPlayPause} disabled={m.busy} hitSlop={6} style={styles.playBtn}
          accessibilityRole="button" accessibilityLabel={m.playing ? 'Pause' : 'Play'}>
          <Ionicons name={m.playing ? 'pause' : 'play'} size={20} color="#000" />
        </Pressable>
      </View>
      <View style={styles.nowTrack}><View style={[styles.nowFill, { width: `${pct * 100}%` }]} /></View>
    </Pressable>
  )
}

function WeekTiles({ size, gap }: { size: number; gap: number }) {
  const { loaded, week, streak, tracking } = useWeekGlance()

  const box = { width: size, height: size }
  // Nothing tracked yet: one tall tile (not an empty one under it) with the way in.
  if (!loaded || !week || !week.plays) {
    return (
      <View style={[styles.tile, { width: size, height: size * 2 + gap }]}>
        <Text style={styles.overline}>THIS WEEK</Text>
        <View style={{ gap: Spacing.md }}>
          <Text style={styles.tileHint} numberOfLines={6} adjustsFontSizeToFit minimumFontScale={0.7}>{!loaded ? 'Adding up…'
            : tracking ? 'No plays this week yet. They show up here after the next sync.'
            : 'Nothing tracked yet. Turn on tracking to see your hours, top artist and streak here.'}</Text>
          {loaded && !tracking && (
            <Pressable onPress={() => { haptic.light(); router.push('/settings') }} style={styles.cta}
              accessibilityRole="button" accessibilityLabel="Open Settings to turn on tracking">
              <Text style={styles.ctaText}>Settings</Text>
            </Pressable>
          )}
        </View>
      </View>
    )
  }
  const artist = week.topArtists[0]
  return (
    <>
      <View style={[styles.tile, box]} accessible accessibilityLabel={`This week: ${fmtHours(week.ms)}, ${week.plays} plays`}>
        <Text style={styles.overline}>THIS WEEK</Text>
        <View>
          <Text style={styles.big}>{fmtHours(week.ms)}</Text>
          <Text style={styles.tileSub}>{week.plays.toLocaleString()} plays · {week.activeDays}/7 days</Text>
        </View>
      </View>
      <View style={[styles.tile, box]} accessible
        accessibilityLabel={`${artist ? `Top artist ${artist.name}. ` : ''}${streak > 1 ? `${streak}-day streak` : ''}`}>
        {artist ? <ArtThumb kind="artist" name={artist.name} size={40} /> : <View />}
        <View>
          <Text style={styles.tileSub}>top artist</Text>
          <Text style={styles.tileName} numberOfLines={1}>{artist?.name ?? '—'}</Text>
          {streak > 1 && <Text style={styles.streak}>{streak}-day streak</Text>}
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  wrap:      { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  now:       { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: Colors.card },
  nowEmpty:  { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass },
  emptyText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  emptyHint: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  nowFoot:   { position: 'absolute', left: Spacing.md + 2, right: Spacing.md + 2, bottom: Spacing.md + 6, flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  nowText:   { flex: 1, minWidth: 0 },
  overline:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, letterSpacing: 2, color: 'rgba(255,255,255,0.8)' },
  nowTitle:  { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg + 2, letterSpacing: -0.5, lineHeight: 23, color: '#fff', marginTop: 2 },
  nowSub:    { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  playBtn:   { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  nowTrack:  { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  nowFill:   { height: 3, backgroundColor: '#fff' },
  tile:      { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass, padding: Spacing.md, justifyContent: 'space-between' },
  cta:       { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.4), backgroundColor: alpha(Colors.greenPrimary, 0.08) },
  ctaText:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.greenPrimary },
  tileHint:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  big:       { fontFamily: FontFamily.syneBold, fontSize: 30, letterSpacing: -1, lineHeight: 32, color: Colors.text },
  tileSub:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  tileName:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text, marginTop: 2 },
  streak:    { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: alpha('#FFB347', 1), marginTop: 4 },
})
