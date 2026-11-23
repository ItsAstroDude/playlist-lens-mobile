import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Sheet, Button } from '@/components/ui'
import { Aurora } from '@/components/motion/Aurora'
import { fmtMinutesShort } from '@/utils/wrapped'
import type { NowPlaying } from '@/hooks/useNowPlaying'
import { useIsCover } from '@/hooks/useScreen'
import { fmtClock, useNowPlayingModel } from './useNowPlayingModel'

// ─── Now-playing stats sheet (v1.3 "Pulse") ──────────────────────────────────
// Tap the live bar → this. The song playing right now + YOUR lifetime numbers
// for it, matched against the imported Wrapped history (by uri, falling back to
// name+artist). Works without an import — it just nudges toward Wrapped instead.
//
// On the Flip's cover screen (≈474×524 dp, cameras bottom-right) the same sheet
// uses a compact layout: cover beside the title, stats on one line, Spotify as an
// icon (or hold the cover), so it all fits above the cameras.

export function NowPlayingSheet({ np, onClose }: {
  np:      NowPlaying | null
  onClose: () => void
}) {
  const isOpen = np !== null && np.item !== null
  // Keep the last track on screen while the sheet slides closed.
  const lastNp = React.useRef(np)
  if (np?.item) lastNp.current = np
  np = isOpen ? np : lastNp.current
  const cover = useIsCover()

  const {
    item, stats, dur, liveMs, playing, busy, art, auroraColors, initial,
    onPlayPause, onNext, onPrev, onOpenSpotify,
  } = useNowPlayingModel(np, isOpen)
  const accent = Colors.greenPrimary

  const artView = art ? (
    <Image source={{ uri: art }} style={styles.art} contentFit="cover" transition={200} />
  ) : (
    <LinearGradient colors={[`${accent}55`, `${accent}11`]} style={styles.art}>
      <Text style={[styles.initial, cover && styles.initialSm, { color: accent }]}>{initial}</Text>
    </LinearGradient>
  )

  const progress = dur > 0 ? (
    <View style={[styles.progressWrap, cover && styles.progressWrapSm]}>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${Math.min(liveMs / dur, 1) * 100}%` }]} />
      </View>
      <Text style={styles.clock}>{fmtClock(liveMs)} / {fmtClock(dur)}</Text>
    </View>
  ) : null

  // Transport controls (v1.6) — drive the active Spotify device
  const controls = (
    <View style={[styles.controls, cover && styles.controlsSm]}>
      <Pressable onPress={onPrev} disabled={busy} hitSlop={8} style={styles.ctrlBtn} accessibilityRole="button" accessibilityLabel="Previous track">
        <Ionicons name="play-skip-back" size={22} color={Colors.text} />
      </Pressable>
      <Pressable onPress={onPlayPause} disabled={busy} style={[styles.ctrlPlay, cover && styles.ctrlPlaySm, { backgroundColor: accent }]} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
        <Ionicons name={playing ? 'pause' : 'play'} size={cover ? 22 : 26} color={Colors.background} />
      </Pressable>
      <Pressable onPress={onNext} disabled={busy} hitSlop={8} style={styles.ctrlBtn} accessibilityRole="button" accessibilityLabel="Next track">
        <Ionicons name="play-skip-forward" size={22} color={Colors.text} />
      </Pressable>
    </View>
  )

  const aurora = auroraColors && isOpen ? (   // only while open — it redraws every frame
    <View style={styles.aurora} pointerEvents="none">
      <Aurora colors={auroraColors} base={Colors.sheet} dim={0.5} style={StyleSheet.absoluteFill} />
    </View>
  ) : null

  if (cover) {
    const line = stats?.stat
      ? `${stats.stat.plays.toLocaleString()} plays · ${fmtMinutesShort(stats.stat.ms)}${stats.rank != null ? ` · your #${stats.rank.toLocaleString()}` : ''}`
      : stats?.imported ? 'first listen?' : null
    return (
      <Sheet open={isOpen} onClose={onClose} zIndex={30}>
        {aurora}
        <View style={styles.bodySm}>
          <View style={styles.headRow}>
            <Pressable onLongPress={() => { haptic.medium(); onOpenSpotify() }} delayLongPress={400}
              accessibilityRole="image" accessibilityLabel="Cover. Hold to open in Spotify"
              style={[styles.artWrap, styles.artWrapSm, { shadowColor: accent }]}>
              {artView}
            </Pressable>
            <View style={styles.headText}>
              <Text style={styles.kind}>{np?.is_playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
              <Text style={[styles.name, styles.nameSm]} numberOfLines={2}>{item?.name}</Text>
              {!!item?.artists?.length && (
                <Text style={styles.artist} numberOfLines={1}>{item.artists.join(', ')}</Text>
              )}
            </View>
            <Pressable onPress={onOpenSpotify} hitSlop={10} style={styles.openBtn}
              accessibilityRole="button" accessibilityLabel="Open in Spotify">
              <Ionicons name="open-outline" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          {progress}
          {controls}
          {line ? <Text style={styles.statLine} numberOfLines={1}>{line}</Text> : null}
        </View>
      </Sheet>
    )
  }

  return (
    <Sheet open={isOpen} onClose={onClose} zIndex={30}>
      {aurora}
      <View style={styles.body}>
        <View style={[styles.artWrap, { shadowColor: accent }]}>{artView}</View>

        {/* Track */}
        <Text style={[styles.kind, styles.kindGap]}>{np?.is_playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
        <Text style={styles.name} numberOfLines={2}>{item?.name}</Text>
        {!!item?.artists?.length && (
          <Text style={styles.artist} numberOfLines={1}>{item.artists.join(', ')}</Text>
        )}
        {progress}
        {controls}

        {/* Personal stats from the imported history */}
        {stats?.stat ? (
          <>
            <View style={styles.statRow}>
              <View style={styles.statChip}>
                <Text style={[styles.statVal, { color: accent }]}>{stats.stat.plays.toLocaleString()}</Text>
                <Text style={styles.statLbl}>your plays</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={[styles.statVal, { color: accent }]}>{fmtMinutesShort(stats.stat.ms)}</Text>
                <Text style={styles.statLbl}>listened</Text>
              </View>
            </View>
            {stats.rank != null && (
              <Text style={styles.rankLine}>your #{stats.rank.toLocaleString()} most played song</Text>
            )}
          </>
        ) : (
          <Text style={styles.hint}>
            {stats?.imported
              ? 'No plays for this one in your imported history — first listen?'
              : 'Import your lifetime history in Wrapped to see your stats for this song.'}
          </Text>
        )}

        <Button label="Open in Spotify" icon="open-outline" onPress={onOpenSpotify} style={styles.spotifyBtn} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  aurora: { ...StyleSheet.absoluteFillObject, zIndex: -1, borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'], overflow: 'hidden' },
  body: { alignItems: 'center', paddingHorizontal: Spacing.xs, paddingTop: Spacing.xs },
  artWrap: {
    width: 148, height: 148, borderRadius: Radius.xl, overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 14,
  },
  art: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: FontFamily.syneBold, fontSize: 64 },
  kind: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2 },
  kindGap: { marginTop: Spacing.lg },
  name: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, textAlign: 'center', letterSpacing: -0.5, marginTop: 2 },
  artist: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  clock: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  progressWrap: { alignSelf: 'stretch', alignItems: 'center', gap: 7, marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  progressBarTrack: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: alpha(Colors.greenPrimary, 0.16), overflow: 'hidden' },
  progressBarFill: { height: 4, borderRadius: 2, backgroundColor: Colors.greenPrimary },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing['2xl'], marginTop: Spacing.lg },
  ctrlBtn:  { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  ctrlPlay: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.greenPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  statRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  statChip: {
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
    alignItems: 'center', minWidth: 110,
  },
  statVal: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, letterSpacing: -0.5 },
  statLbl: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  rankLine: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md },
  hint: {
    fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted,
    textAlign: 'center', marginTop: Spacing.lg, lineHeight: 19, maxWidth: 280,
  },
  spotifyBtn: { marginTop: Spacing.xl, minWidth: 200 },

  // ── cover screen (compact) ──
  bodySm:         { paddingTop: 0 },
  headRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  artWrapSm:      { width: 88, height: 88, borderRadius: Radius.lg },
  initialSm:      { fontSize: 40 },
  headText:       { flex: 1, minWidth: 0 },
  nameSm:         { fontSize: FontSize.lg, textAlign: 'left' },
  openBtn:        { alignSelf: 'flex-start', padding: 4 },
  progressWrapSm: { marginTop: Spacing.md, paddingHorizontal: 0, gap: 4 },
  controlsSm:     { marginTop: Spacing.sm, gap: Spacing.xl },
  ctrlPlaySm:     { width: 52, height: 52, borderRadius: 26 },
  statLine:       { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
})
