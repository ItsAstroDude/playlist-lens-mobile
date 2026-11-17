import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BackHandler, Dimensions, Linking, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Sheet, Button } from '@/components/ui'
import { loadTrackIndex } from '@/hooks/useWrapped'
import { fmtMinutesShort, type TrackStat } from '@/utils/wrapped'
import { pokeNowPlaying, type NowPlaying } from '@/hooks/useNowPlaying'
import {
  resumePlayback, pausePlayback, skipNext, skipPrevious,
  classifyPlaybackError, transportErrorMessage, setPlaybackScopeMissing,
} from '@/utils/playback'
import { showToast } from '@/utils/dialog'

// ─── Now-playing stats sheet (v1.3 "Pulse") ──────────────────────────────────
// Tap the live bar → this. The song playing right now + YOUR lifetime numbers
// for it, matched against the imported Wrapped history (by uri, falling back to
// name+artist). Works without an import — it just nudges toward Wrapped instead.

const { height: SH } = Dimensions.get('window')

// The full per-track index is MBs of JSON — parse it once per session, on first
// open (NOT at startup). A fresh import during the same session shows up after
// the next app launch; acceptable for a stats peek.
let _index: TrackStat[] | null | undefined
function getIndex(): TrackStat[] | null {
  if (_index === undefined) _index = loadTrackIndex()
  return _index
}

function findStats(uri: string | null, name: string, artists: string[]) {
  const index = getIndex()
  if (!index) return { imported: false as const, stat: null, rank: null }
  let i = uri ? index.findIndex(t => t.uri === uri) : -1
  if (i < 0) {
    const n = name.trim().toLowerCase()
    const a = (artists[0] ?? '').trim().toLowerCase()
    i = index.findIndex(t => t.name.trim().toLowerCase() === n && t.artist.trim().toLowerCase() === a)
  }
  return i >= 0
    ? { imported: true as const, stat: index[i], rank: i + 1 }
    : { imported: true as const, stat: null, rank: null }
}

function fmtClock(ms: number): string {
  const s = Math.max(Math.floor(ms / 1000), 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function NowPlayingSheet({ np, onClose }: {
  np:      NowPlaying | null
  onClose: () => void
}) {
  const isOpen = np !== null && np.item !== null
  // Keep the last track on screen while the sheet slides closed.
  const lastNp = React.useRef(np)
  if (np?.item) lastNp.current = np
  np = isOpen ? np : lastNp.current
  const item = np?.item ?? null


  // Personal stats — resolved when the sheet opens for a given track.
  const stats = useMemo(
    () => (item ? findStats(item.uri, item.name, item.artists) : null),
    [item?.uri, item?.name],
  )

  // Live mm:ss — ticks locally between polls (np.receivedAt anchors the clock).
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isOpen || !np?.is_playing) return
    const t = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [isOpen, np?.is_playing])

  const dur = item?.duration_ms ?? 0
  const liveMs = np
    ? Math.min((np.progress_ms ?? 0) + (np.is_playing ? Date.now() - np.receivedAt : 0), dur)
    : 0

  // Transport (v1.6) — optimistic play/pause + skip, re-synced by a poke. `override`
  // wins until the next poll lands (effect clears it when the server state changes).
  const [override, setOverride] = useState<boolean | null>(null)
  const [busy, setBusy]         = useState(false)
  const playing = override ?? (np?.is_playing ?? false)
  useEffect(() => { setOverride(null) }, [np?.is_playing, item?.uri])

  const control = useCallback(async (fn: () => Promise<void>, optimistic?: boolean) => {
    if (busy) return
    haptic.light()
    if (optimistic !== undefined) setOverride(optimistic)
    setBusy(true)
    try { await fn() } catch (err) {
      // Snap the optimistic state back now (don't wait for the poll) and say why.
      setOverride(null)
      haptic.warning()
      const kind = classifyPlaybackError(err)
      if (kind === 'scope') setPlaybackScopeMissing(true)
      showToast(transportErrorMessage(kind), 'alert-circle-outline')
    }
    setTimeout(() => { pokeNowPlaying(); setBusy(false) }, 500)
  }, [busy])
  const onPlayPause = () => (playing ? control(pausePlayback, false) : control(resumePlayback, true))
  const onNext = () => control(skipNext)
  const onPrev = () => control(skipPrevious)

  const onOpenSpotify = useCallback(async () => {
    if (!item?.uri) return
    haptic.light()
    const webUrl = item.id ? `https://open.spotify.com/track/${item.id}` : null
    try {
      await Linking.openURL(item.uri)        // spotify: scheme → the app
    } catch {
      if (webUrl) Linking.openURL(webUrl).catch(() => {})
    }
  }, [item?.uri, item?.id])

  const accent = Colors.greenPrimary
  const art = item?.album?.images?.[0]?.url ?? null
  const initial = (item?.name ?? '?').trim().charAt(0).toUpperCase()

  return (
    <>
      <Sheet open={isOpen} onClose={onClose} zIndex={30}>
        <View style={styles.body}>

        {/* Artwork */}
        <View style={[styles.artWrap, { shadowColor: accent }]}>
          {art ? (
            <Image source={{ uri: art }} style={styles.art} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={[`${accent}55`, `${accent}11`]} style={styles.art}>
              <Text style={[styles.initial, { color: accent }]}>{initial}</Text>
            </LinearGradient>
          )}
        </View>

        {/* Track */}
        <Text style={styles.kind}>{np?.is_playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
        <Text style={styles.name} numberOfLines={2}>{item?.name}</Text>
        {!!item?.artists?.length && (
          <Text style={styles.artist} numberOfLines={1}>{item.artists.join(', ')}</Text>
        )}
        {dur > 0 && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.min(liveMs / dur, 1) * 100}%` }]} />
            </View>
            <Text style={styles.clock}>{fmtClock(liveMs)} / {fmtClock(dur)}</Text>
          </View>
        )}

        {/* Transport controls (v1.6) — drive the active Spotify device */}
        <View style={styles.controls}>
          <Pressable onPress={onPrev} disabled={busy} hitSlop={8} style={styles.ctrlBtn} accessibilityRole="button" accessibilityLabel="Previous track">
            <Ionicons name="play-skip-back" size={22} color={Colors.text} />
          </Pressable>
          <Pressable onPress={onPlayPause} disabled={busy} style={[styles.ctrlPlay, { backgroundColor: accent }]} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
            <Ionicons name={playing ? 'pause' : 'play'} size={26} color={Colors.background} />
          </Pressable>
          <Pressable onPress={onNext} disabled={busy} hitSlop={8} style={styles.ctrlBtn} accessibilityRole="button" accessibilityLabel="Next track">
            <Ionicons name="play-skip-forward" size={22} color={Colors.text} />
          </Pressable>
        </View>

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
    </>
  )
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', paddingHorizontal: Spacing.xs, paddingTop: Spacing.xs },
  artWrap: {
    width: 148, height: 148, borderRadius: Radius.xl, overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 14,
  },
  art: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: FontFamily.syneBold, fontSize: 64 },
  kind: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, marginTop: Spacing.lg },
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
})
