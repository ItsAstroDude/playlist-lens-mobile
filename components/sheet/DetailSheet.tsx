import { useIsCover } from '@/hooks/useScreen'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { ArtThumb } from '@/components/ui/ArtThumb'
import { emitOpenStartQueue } from '@/utils/overlayEvents'
import { playCounts, playedOf } from '@/utils/playDb'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { fmtDuration } from '@/utils/analyze'
import { ensureReadable } from '@/utils/color'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { RadarChart } from '@/components/ui/RadarChart'
import { WrappedItemSheet, openSelection, type WrappedSelection } from '@/components/wrapped/WrappedItemSheet'
import { withMemorialMark } from '@/utils/tribute'
import type { SpotifyPlaylist, PlaylistAnalysis, PlaylistPalette } from '@/types'

// Sizes come from the live window (the Flip's cover screen is a different shape from
// the main screen), never from the one the app launched on.
const SHEET_MAX = 0.9
const COVER = 76

/** Where the sheet's header cover sits once open (window coordinates) — the target for
 *  the Lenses "card opens into the lens" flight. Sheet top + its grab area + padding. */
export function detailCoverRect() {
  const { height: SH } = Dimensions.get('window')
  const grab = Spacing.sm + 4 + Spacing.md + Spacing.sm
  return { x: Spacing.lg, y: SH * (1 - SHEET_MAX) + grab + Spacing.lg, w: COVER, h: COVER }
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
interface DetailSheetProps {
  playlist: SpotifyPlaylist | null
  palette:  PlaylistPalette | null
  onClose:  () => void
  onGone?:  (id: string) => void
  /** Hide the header cover while a cover is flying in from the tapped card. */
  coverHidden?: boolean
}


/**
 * The playlist lens (2.0.39, "L2 bento"): a compact header — cover, name, size, Play —
 * then the analysis as tiles, each showing all it has (2.0.46: nothing to open): sound,
 * top artists, fame, how much of it you played this month, eras and the genres.
 * A full-height, edge-to-edge Sheet (`bleed`) — swipe the handle, tap the backdrop or
 * press back to close.
 */
export function DetailSheet({ playlist, palette, onClose, onGone, coverHidden = false }: DetailSheetProps) {
  const insets = useSafeAreaInsets()
  const gutter = useNowPlayingGutter()
  const isOpen = playlist !== null
  // Flip cover screen: the content gets room to scroll clear of the cameras
  // (bottom-right). The tab bar / strip steps aside on its own (every open Sheet hides it).
  const cover = useIsCover()
  const { status, data, error, analyze, reset } = useAnalysis()
  // Tap a top artist → expand the same item sheet Wrapped uses (mounted beside the
  // sheet, not inside the ScrollView, so it anchors to the screen).
  const [sel, setSel] = useState<WrappedSelection | null>(null)

  // Keep showing the last playlist (and palette) while the sheet slides closed.
  const last = useRef({ playlist, palette })
  if (playlist) last.current = { playlist, palette }
  const shown        = playlist ?? last.current.playlist
  const shownPalette = playlist ? palette : last.current.palette

  useEffect(() => {
    if (isOpen) return
    setSel(null)
    const t = setTimeout(reset, 360)
    return () => clearTimeout(t)
  }, [isOpen])

  useEffect(() => {
    if (playlist) {
      analyze(playlist.id, playlist.name, playlist.images?.[0]?.url ?? '', palette,
        { onGone: () => onGone?.(playlist.id) })
    }
  }, [playlist?.id])

  // Lift dark cover colours to a readable tone (same clamp Compare uses), so the
  // chips / bars / numbers aren't invisible on near-black covers.
  const accent = ensureReadable(shownPalette?.primary ?? Colors.greenPrimary)

  const play = () => {
    if (!data) return
    const items = data.tracks.filter(t => t.uri?.startsWith('spotify:track:')).map(t => ({
      uri: t.uri!, name: t.name, artist: t.artists?.[0]?.name ?? '', image: t.album?.images?.[0]?.url,
    }))
    if (!items.length) return
    haptic.medium()
    emitOpenStartQueue(items)
  }

  return (
    <>
      <Sheet open={isOpen} onClose={onClose} bleed maxHeight={SHEET_MAX} zIndex={10}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: cover ? 150 : insets.bottom + 96 + gutter }}
          bounces
        >
          {shown && <Header playlist={shown} data={status === 'success' ? data : null} accent={accent}
            coverHidden={coverHidden} onPlay={status === 'success' && data ? play : undefined} />}

          {status === 'loading' && <BentoSkeleton />}

          {status === 'error' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                onPress={() => playlist && analyze(playlist.id, playlist.name, playlist.images?.[0]?.url ?? '', palette,
                  { onGone: () => onGone?.(playlist.id) })}
                style={[styles.retryBtn, { borderColor: accent }]}
                accessibilityRole="button"
              >
                <Text style={[styles.retryBtnText, { color: accent }]}>Retry</Text>
              </Pressable>
            </View>
          )}

          {status === 'success' && data && <Bento data={data} accent={accent} onSelectArtist={x => openSelection(x, setSel)} />}
        </ScrollView>
      </Sheet>

      <WrappedItemSheet selection={sel} onClose={() => setSel(null)} />
    </>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ playlist, data, accent, coverHidden, onPlay }: {
  playlist: SpotifyPlaylist; data: PlaylistAnalysis | null; accent: string; coverHidden: boolean; onPlay?: () => void
}) {
  const coverUrl = playlist.images?.[0]?.url
  const total = playlist.tracks?.total ?? data?.tracks.length ?? 0
  const TRACK_CAP = 500
  const capped = data && total > TRACK_CAP && data.tracks.length > 0
  const dur = data ? (capped ? '~' + fmtDuration((data.totalMs / data.tracks.length) * total) : fmtDuration(data.totalMs)) : null
  // While a cover is flying in from the tapped card, the header's own cover waits.
  const reveal = useSharedValue(coverHidden ? 0 : 1)
  useEffect(() => { reveal.value = withTiming(coverHidden ? 0 : 1, { duration: coverHidden ? 0 : 180 }) }, [coverHidden])
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }))
  return (
    <View style={styles.header}>
      <LinearGradient colors={[`${accent}33`, `${accent}00`]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Animated.View style={[styles.cover, revealStyle]}>
        {coverUrl
          ? <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" transition={200} />
          : <View style={[styles.cover, styles.coverFallback]}><Text style={styles.coverEmoji}>🎵</Text></View>}
      </Animated.View>
      <View style={styles.headText}>
        <Text style={styles.name} numberOfLines={2}>{playlist.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {total.toLocaleString()} songs{dur ? ` · ${dur}` : ''}{playlist.owner?.display_name ? ` · ${playlist.owner.display_name}` : ''}
        </Text>
      </View>
      <Pressable onPress={onPlay} disabled={!onPlay} style={[styles.play, { backgroundColor: accent }, !onPlay && { opacity: 0.4 }]}
        accessibilityRole="button" accessibilityLabel={`Play ${playlist.name}`} accessibilityState={{ disabled: !onPlay }}>
        <Ionicons name="play" size={22} color={Colors.background} />
      </Pressable>
    </View>
  )
}

// ─── Bento ────────────────────────────────────────────────────────────────────
// 2.0.46 "L3": nothing to open. Every tile shows its whole story (they used to open a
// second sheet each, and the lens looked empty): top artists as a list (one tap to an
// artist's page when you've played them), every decade, fame and its spread, the full
// genre cloud, and the sound when Spotify gives it.
const TOP_ARTISTS = 8

function Bento({ data, accent, onSelectArtist }: { data: PlaylistAnalysis; accent: string; onSelectArtist: (s: WrappedSelection) => void }) {
  const af = data.audioFeatures
  const decTotal = data.decades.reduce((n, d) => n + d.count, 0)
  const topDec = data.decades.slice().sort((a, b) => b.count - a.count)[0]
  const decMax = Math.max(1, ...data.decades.map(d => d.count))
  const fame = data.avgPop
  const fameWord = fame < 35 ? 'mostly deep cuts' : fame < 60 ? 'a bit of both' : 'mostly hits'
  const popMax = Math.max(1, ...data.popBuckets.map(b => b.count))
  const popTop = data.popBuckets.reduce((best, b, i, all) => (b.count > all[best].count ? i : best), 0)
  const played = usePlayedThisMonth(data)
  const artists = data.topArtists.slice(0, TOP_ARTISTS)
  const artistMax = Math.max(1, artists[0]?.count ?? 1)
  const genreMax = Math.max(1, data.topGenres[0]?.count ?? 1)

  return (
    <View style={styles.grid}>
      {af && (
        <Tile wide>
          <View style={styles.soundRow} accessible
            accessibilityLabel={`Sound: ${data.vibe ?? 'audio profile'}. Energy ${Math.round(af.energy * 100)}, danceable ${Math.round(af.danceability * 100)}, ${Math.round(af.avgTempo)} bpm`}>
            <RadarChart acousticness={af.acousticness} danceability={af.danceability} energy={af.energy}
              valence={af.valence} instrumentalness={af.instrumentalness} liveness={af.liveness}
              color={accent} size={112} labels={false} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.tileLabel}>SOUND</Text>
              <Text style={styles.soundHead} numberOfLines={2}>{data.vibe ?? 'Your mix'}</Text>
              <Text style={styles.tileSub}>energy {Math.round(af.energy * 100)} · dance {Math.round(af.danceability * 100)}</Text>
              <Text style={styles.tileSub}>{Math.round(af.avgTempo)} bpm on average</Text>
            </View>
          </View>
        </Tile>
      )}

      {artists.length > 0 && (
        <Tile wide>
          <View style={styles.tileHead}>
            <Text style={styles.tileLabel}>TOP ARTISTS</Text>
            <Text style={styles.tileCount}>{data.artistCount.toLocaleString()} in all</Text>
          </View>
          {artists.map((a, i) => (
            <Pressable key={a.id || a.name}
              onPress={() => onSelectArtist({ kind: 'artist', name: a.name, rank: i + 1, tracks: a.count, accent })}
              style={({ pressed }) => [styles.artistRow, pressed && { opacity: 0.6 }]}
              accessibilityRole="button" accessibilityLabel={`${i + 1}. ${a.name}, ${a.count} ${a.count === 1 ? 'song' : 'songs'}`}>
              <Text style={styles.artistRank}>{i + 1}</Text>
              <ArtThumb kind="artist" name={a.name} size={34} />
              <View style={styles.artistText}>
                <Text style={styles.tileName} numberOfLines={1}>{withMemorialMark(a.name)}</Text>
                <View style={styles.artistTrack}>
                  <View style={[styles.artistFill, { width: `${Math.max(4, (a.count / artistMax) * 100)}%`, backgroundColor: accent }]} />
                </View>
              </View>
              <Text style={styles.artistCount}>{a.count}</Text>
            </Pressable>
          ))}
          {data.artistCount > artists.length && (
            <Text style={styles.tileSub}>+{(data.artistCount - artists.length).toLocaleString()} more · counted in songs</Text>
          )}
        </Tile>
      )}

      <View style={styles.pair}>
        <Tile>
          <View accessible accessibilityLabel={`Fame ${fame} out of 100, ${fameWord}`}>
            <Text style={styles.tileLabel}>FAME</Text>
            <Text style={[styles.tileBig, { color: '#FFB347' }]}>{fame}</Text>
            <Text style={styles.tileSub}>{fameWord}</Text>
          </View>
          <View style={styles.miniBars} accessible accessibilityLabel={`Songs by popularity: ${data.popBuckets.map(b => `${b.label}: ${b.count}`).join(', ')}`}>
            {data.popBuckets.map((b, i) => (
              <View key={b.label} style={styles.miniCol}>
                <View style={[styles.miniBar, { height: 3 + 31 * (b.count / popMax), backgroundColor: i === popTop ? '#FFB347' : 'rgba(255,179,71,0.35)' }]} />
              </View>
            ))}
          </View>
          <View style={styles.miniAxis}><Text style={styles.decLabel}>deep cuts</Text><Text style={styles.decLabel}>hits</Text></View>
        </Tile>
        <Tile>
          <View accessible accessibilityLabel={played == null ? 'You played: nothing tracked yet' : `You played ${played}% of it this month`}>
            <Text style={styles.tileLabel}>YOU PLAYED</Text>
            <Text style={[styles.tileBig, { color: Colors.lavender }]}>{played == null ? '—' : `${played}%`}</Text>
            <Text style={styles.tileSub}>{played == null ? 'turn on tracking to see' : 'of its songs this month'}</Text>
          </View>
          {played != null && (
            <View style={styles.playedTrack}><View style={[styles.playedFill, { width: `${Math.max(2, played)}%` }]} /></View>
          )}
        </Tile>
      </View>

      {data.decades.length > 0 && (
        <Tile wide>
          <View style={styles.tileHead}>
            <Text style={styles.tileLabel}>ERAS</Text>
            {topDec && <Text style={styles.tileCount}>{Math.round(100 * topDec.count / decTotal)}% from the {topDec.label}</Text>}
          </View>
          <View style={styles.decBars} accessible
            accessibilityLabel={`Songs by decade: ${data.decades.map(d => `${d.label}: ${d.count}`).join(', ')}`}>
            {data.decades.map(d => (
              <View key={d.label} style={styles.decCol}>
                <Text style={styles.decCount}>{d.count}</Text>
                <View style={[styles.decBar, { height: 4 + 54 * (d.count / decMax), backgroundColor: d === topDec ? accent : `${accent}55` }]} />
                <Text style={styles.decLabel} numberOfLines={1}>{d.label.replace(/^\d\d(\d\d)s$/, '$1s')}</Text>
              </View>
            ))}
          </View>
        </Tile>
      )}

      {data.topGenres.length > 0 && (
        <Tile wide>
          <View style={styles.tileHead}>
            <Text style={styles.tileLabel}>GENRES</Text>
            <Text style={styles.tileCount}>{data.topGenres.length}</Text>
          </View>
          <View style={styles.genreCloud}>
            {data.topGenres.slice(0, 24).map((g, i) => {
              const pct = g.count / genreMax
              const c = [accent, Colors.pink, Colors.lavender][i % 3]
              return (
                <View key={g.genre} style={[styles.genrePill, {
                  backgroundColor: `${c}14`,
                  borderColor: `${c}${Math.round(40 + pct * 60).toString(16).padStart(2, '0')}`,
                }]}>
                  <Text style={[styles.genrePillText, { color: `${c}${Math.round(160 + pct * 95).toString(16).padStart(2, '0')}` }]}>{g.genre}</Text>
                </View>
              )
            })}
          </View>
        </Tile>
      )}
    </View>
  )
}

/** % of the lens's songs you've played since the 1st of this month (null: nothing tracked). */
function usePlayedThisMonth(data: PlaylistAnalysis): number | null {
  return useMemo(() => {
    try {
      if (!playCounts().total) return null
      const now = new Date()
      const since = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000)
      const uris = data.tracks.map(t => t.uri ?? '').filter(Boolean)
      if (!uris.length) return null
      return Math.round((100 * playedOf(uris, since)) / uris.length)
    } catch { return null }
  }, [data.playlistId, data.cachedAt])
}

function Tile({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <View style={[styles.tile, wide ? styles.tileWide : { flex: 1 }]}>{children}</View>
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function BentoSkeleton() {
  return (
    <View style={styles.grid}>
      <Skeleton height={150} width="100%" borderRadius={Radius.xl} />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}><Skeleton height={150} width="100%" borderRadius={Radius.xl} /></View>
        <View style={{ flex: 1 }}><Skeleton height={150} width="100%" borderRadius={Radius.xl} /></View>
      </View>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}><Skeleton height={120} width="100%" borderRadius={Radius.xl} /></View>
        <View style={{ flex: 1 }}><Skeleton height={120} width="100%" borderRadius={Radius.xl} /></View>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Header ──
  header:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md + 2, padding: Spacing.lg, paddingBottom: Spacing.md },
  cover:    { width: COVER, height: COVER, borderRadius: Radius.lg, overflow: 'hidden' },
  coverFallback: { backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 28 },
  headText: { flex: 1, minWidth: 0 },
  name:     { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl + 2, color: Colors.text, letterSpacing: -0.5, lineHeight: (FontSize.xl + 2) * 1.12 },
  meta:     { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  play:     { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },

  // ── Bento ──
  grid:     { paddingHorizontal: Spacing.lg, gap: Spacing.sm + 2 },
  pair:     { flexDirection: 'row', gap: Spacing.sm + 2 },
  tile:     {
    minHeight: 132, padding: Spacing.md + 2, gap: Spacing.sm, justifyContent: 'space-between',
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass,
  },
  tileWide: { minHeight: 0 },
  tileLabel: { fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 2, color: Colors.textMuted },
  tileName: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  tileSub:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  tileBig:  { fontFamily: FontFamily.syneBold, fontSize: 34, letterSpacing: -1 },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  soundHead: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg + 2, color: Colors.text, letterSpacing: -0.5, marginTop: 6, marginBottom: 4, textTransform: 'capitalize' },
  decBars:  { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 82 },
  decCol:   { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  decBar:   { width: '100%', borderRadius: 4 },
  decLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.textMuted },
  decCount: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.textSecondary },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm },
  tileCount: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textSecondary },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2, paddingVertical: 3 },
  artistRank: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 14, textAlign: 'right' },
  artistText: { flex: 1, minWidth: 0, gap: 5 },
  artistTrack: { height: 3, borderRadius: 2, backgroundColor: Colors.glass, overflow: 'hidden' },
  artistFill: { height: 3, borderRadius: 2, opacity: 0.85 },
  artistCount: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textSecondary, minWidth: 22, textAlign: 'right' },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 34, marginTop: Spacing.sm },
  miniCol:  { flex: 1, justifyContent: 'flex-end' },
  miniBar:  { width: '100%', borderRadius: 3 },
  miniAxis: { flexDirection: 'row', justifyContent: 'space-between' },
  playedTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(204,189,255,0.15)', overflow: 'hidden', marginTop: Spacing.sm },
  playedFill:  { height: 6, borderRadius: 3, backgroundColor: Colors.lavender },

  // Micro-genres cloud
  genreCloud: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.sm,
  },
  genrePill: {
    borderRadius:      Radius.full,
    borderWidth:       1,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.xs + 1,
  },
  genrePillText: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.xs,
    textTransform: 'lowercase',
  },

  // Error state
  errorBox: {
    alignItems: 'center',
    gap:        Spacing.md,
    paddingTop: Spacing['3xl'],
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.error,
    textAlign:  'center',
  },
  retryBtn: {
    borderWidth:       1,
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.sm,
  },
  retryBtnText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
  },
})
