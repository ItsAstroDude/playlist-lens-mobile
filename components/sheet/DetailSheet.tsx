import { setTabBarHidden } from '@/utils/tabBar'
import { useIsCover } from '@/hooks/useScreen'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
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
import { WrappedItemSheet, type WrappedSelection } from '@/components/wrapped/WrappedItemSheet'
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

type TileId = 'sound' | 'artists' | 'eras' | 'fame' | 'genres'
const TILE_TITLE: Record<TileId, string> = {
  sound: 'Audio DNA', artists: 'Top artists', eras: 'Eras', fame: 'Fame', genres: 'Micro-genres',
}

/**
 * The playlist lens (2.0.39, "L2 bento"): a compact header — cover, name, size, Play —
 * then the analysis as tiles: sound, top artist, eras, fame, how much of it you played
 * this month, and the genres. Tap a tile to open it in full (its own small sheet).
 * A full-height, edge-to-edge Sheet (`bleed`) — swipe the handle, tap the backdrop or
 * press back to close.
 */
export function DetailSheet({ playlist, palette, onClose, onGone, coverHidden = false }: DetailSheetProps) {
  const insets = useSafeAreaInsets()
  const gutter = useNowPlayingGutter()
  const isOpen = playlist !== null
  // Flip cover screen: the tab strip steps aside while the lens is open, and the
  // content gets room to scroll clear of the cameras (bottom-right).
  const cover = useIsCover()
  useEffect(() => {
    if (!cover) return
    setTabBarHidden(isOpen)
    return () => { if (isOpen) setTabBarHidden(false) }
  }, [cover, isOpen])
  const { status, data, error, analyze, reset } = useAnalysis()
  // Tap a top artist → expand the same item sheet Wrapped uses (mounted beside the
  // sheet, not inside the ScrollView, so it anchors to the screen).
  const [sel, setSel] = useState<WrappedSelection | null>(null)
  const [tile, setTile] = useState<TileId | null>(null)
  const lastTile = useRef<TileId>('sound')
  if (tile) lastTile.current = tile

  // Keep showing the last playlist (and palette) while the sheet slides closed.
  const last = useRef({ playlist, palette })
  if (playlist) last.current = { playlist, palette }
  const shown        = playlist ?? last.current.playlist
  const shownPalette = playlist ? palette : last.current.palette

  useEffect(() => {
    if (isOpen) return
    setSel(null); setTile(null)
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

          {status === 'success' && data && <Bento data={data} accent={accent} onOpen={setTile} />}
        </ScrollView>
      </Sheet>

      {/* A tile, in full. */}
      <Sheet open={!!tile && isOpen} onClose={() => setTile(null)} title={TILE_TITLE[lastTile.current]} zIndex={11} maxHeight={0.72}>
        {data && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl, gap: Spacing.sm }}>
            <TileDetail id={lastTile.current} data={data} accent={accent}
              onSelectArtist={s => { setTile(null); setSel(s) }} />
          </ScrollView>
        )}
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
function Bento({ data, accent, onOpen }: { data: PlaylistAnalysis; accent: string; onOpen: (t: TileId) => void }) {
  const af = data.audioFeatures
  const topArtist = data.topArtists[0]
  const decTotal = data.decades.reduce((n, d) => n + d.count, 0)
  const topDec = data.decades.slice().sort((a, b) => b.count - a.count)[0]
  const decMax = Math.max(1, ...data.decades.map(d => d.count))
  const fame = data.avgPop
  const fameWord = fame < 35 ? 'mostly deep cuts' : fame < 60 ? 'a bit of both' : 'mostly hits'
  const played = usePlayedThisMonth(data)

  return (
    <View style={styles.grid}>
      {af && (
        <Tile wide onPress={() => onOpen('sound')} label={`Sound: ${data.vibe ?? 'audio profile'}. Energy ${Math.round(af.energy * 100)}, danceable ${Math.round(af.danceability * 100)}. Open`}>
          <View style={styles.soundRow}>
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
      <View style={styles.pair}>
        {topArtist && (
          <Tile onPress={() => onOpen('artists')} label={`Top artist ${topArtist.name}, ${topArtist.count} songs. Open`}>
            <Text style={styles.tileLabel}>TOP ARTIST</Text>
            <ArtThumb kind="artist" name={topArtist.name} size={52} />
            <View>
              <Text style={styles.tileName} numberOfLines={1}>{withMemorialMark(topArtist.name)}</Text>
              <Text style={styles.tileSub} numberOfLines={1}>
                {topArtist.count === 1 ? '1 song' : `${topArtist.count} songs`}{data.artistCount > 1 ? ` · +${data.artistCount - 1} more` : ''}
              </Text>
            </View>
          </Tile>
        )}
        {data.decades.length > 0 && (
          <Tile onPress={() => onOpen('eras')} label={`Eras: ${topDec ? `${Math.round(100 * topDec.count / decTotal)}% from the ${topDec.label}` : ''}. Open`}>
            <Text style={styles.tileLabel}>ERAS</Text>
            <View style={styles.decBars}>
              {data.decades.slice(-5).map(d => (
                <View key={d.label} style={styles.decCol}>
                  <View style={[styles.decBar, { height: 6 + 58 * (d.count / decMax), backgroundColor: d === topDec ? accent : `${accent}55` }]} />
                  <Text style={styles.decLabel} numberOfLines={1}>{d.label.replace(/^\d\d(\d\d)s$/, '$1s')}</Text>
                </View>
              ))}
            </View>
            {topDec && <Text style={styles.tileSub} numberOfLines={1}>{Math.round(100 * topDec.count / decTotal)}% from the {topDec.label}</Text>}
          </Tile>
        )}
      </View>
      <View style={styles.pair}>
        <Tile onPress={() => onOpen('fame')} label={`Fame ${fame}, ${fameWord}. Open`}>
          <Text style={styles.tileLabel}>FAME</Text>
          <Text style={[styles.tileBig, { color: '#FFB347' }]}>{fame}</Text>
          <Text style={styles.tileSub}>{fameWord}</Text>
        </Tile>
        <Tile label={played == null ? 'You played: nothing tracked yet' : `You played ${played}% of it this month`}>
          <Text style={styles.tileLabel}>YOU PLAYED</Text>
          <Text style={[styles.tileBig, { color: Colors.lavender }]}>{played == null ? '—' : `${played}%`}</Text>
          <Text style={styles.tileSub}>{played == null ? 'turn on tracking to see' : 'of it this month'}</Text>
        </Tile>
      </View>
      {data.topGenres.length > 0 && (
        <Tile wide onPress={() => onOpen('genres')} label={`Genres: ${data.topGenres.slice(0, 4).map(g => g.genre).join(', ')}. Open`}>
          <View style={styles.genreCloud}>
            {data.topGenres.slice(0, 4).map((g, i) => (
              <View key={g.genre} style={[styles.genrePill, i === 0
                ? { backgroundColor: `${accent}22`, borderColor: `${accent}99` }
                : { backgroundColor: Colors.glass, borderColor: Colors.glassBorder }]}>
                <Text style={[styles.genrePillText, { color: i === 0 ? accent : Colors.textSecondary }]}>{g.genre}</Text>
              </View>
            ))}
            {data.topGenres.length > 4 && (
              <View style={[styles.genrePill, { backgroundColor: Colors.glass, borderColor: Colors.glassBorder }]}>
                <Text style={[styles.genrePillText, { color: Colors.textSecondary }]}>+{data.topGenres.length - 4}</Text>
              </View>
            )}
          </View>
        </Tile>
      )}
      <Text style={styles.tapHint}>tap a tile to open it</Text>
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

function Tile({ children, wide, onPress, label }: { children: React.ReactNode; wide?: boolean; onPress?: () => void; label: string }) {
  const body = <View style={[styles.tile, wide && styles.tileWide]}>{children}</View>
  if (!onPress) return <View style={wide ? undefined : { flex: 1 }} accessible accessibilityLabel={label}>{body}</View>
  return (
    <Pressable onPress={() => { haptic.light(); onPress() }} style={({ pressed }) => [wide ? undefined : { flex: 1 }, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="button" accessibilityLabel={label}>
      {body}
    </Pressable>
  )
}

// ─── A tile, in full ──────────────────────────────────────────────────────────
function TileDetail({ id, data, accent, onSelectArtist }: {
  id: TileId; data: PlaylistAnalysis; accent: string; onSelectArtist: (s: WrappedSelection) => void
}) {
  if (id === 'sound' && data.audioFeatures) {
    const af = data.audioFeatures
    return (
      <GlassPanel title={data.vibe ?? 'Audio DNA'}>
        <View style={styles.radarWrap}>
          <RadarChart acousticness={af.acousticness} danceability={af.danceability} energy={af.energy}
            valence={af.valence} instrumentalness={af.instrumentalness} liveness={af.liveness} color={accent} size={200} />
        </View>
        <View style={styles.bpmRow}>
          <Text style={styles.bpmLabel}>BPM AVG</Text>
          <Text style={[styles.bpmValue, { color: accent }]}>{Math.round(af.avgTempo)}</Text>
        </View>
      </GlassPanel>
    )
  }
  if (id === 'artists') {
    return (
      <GlassPanel title={`${data.artistCount} artists`}>
        {data.topArtists.slice(0, 10).map((artist, i) => (
          <BarRow key={artist.id} label={withMemorialMark(artist.name)} count={artist.count} max={data.topArtists[0].count}
            color={accent} valueLabel={artist.count === 1 ? '1 track' : `${artist.count} tracks`} delay={i * 50}
            onPress={() => onSelectArtist({ kind: 'artist', name: artist.name, rank: i + 1, tracks: artist.count, accent })} />
        ))}
      </GlassPanel>
    )
  }
  if (id === 'eras') {
    const max = Math.max(...data.decades.map(x => x.count))
    return (
      <GlassPanel title="By decade">
        {data.decades.map((d, i) => (
          <BarRow key={d.label} label={d.label} count={d.count} max={max} color={accent}
            valueLabel={d.count === 1 ? '1 track' : `${d.count} tracks`} delay={i * 50} />
        ))}
      </GlassPanel>
    )
  }
  if (id === 'fame') {
    const buckets = data.popBuckets.filter(b => b.count > 0)
    const max = Math.max(1, ...data.popBuckets.map(x => x.count))
    return (
      <GlassPanel title={`Average popularity ${data.avgPop}`}>
        {buckets.map((b, i) => (
          <BarRow key={b.label} label={b.label} count={b.count} max={max} color={accent}
            valueLabel={b.count === 1 ? '1 track' : `${b.count} tracks`} delay={i * 45} />
        ))}
      </GlassPanel>
    )
  }
  return (
    <GlassPanel title={`${data.topGenres.length} genres`}>
      <View style={styles.genreCloud}>
        {data.topGenres.slice(0, 24).map((g, i) => {
          const pct = g.count / data.topGenres[0].count
          const chipColor = [accent, Colors.pink, Colors.lavender][i % 3]
          return (
            <View key={g.genre} style={[styles.genrePill, {
              backgroundColor: `${chipColor}14`,
              borderColor: `${chipColor}${Math.round(40 + pct * 60).toString(16).padStart(2, '0')}`,
            }]}>
              <Text style={[styles.genrePillText, { color: `${chipColor}${Math.round(160 + pct * 95).toString(16).padStart(2, '0')}` }]}>{g.genre}</Text>
            </View>
          )
        })}
      </View>
    </GlassPanel>
  )
}

// ─── Glass Panel ──────────────────────────────────────────────────────────────
function GlassPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelSpecular} />
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  )
}

// ─── Bar Row ──────────────────────────────────────────────────────────────────
function BarRow({ label, count, max, color, valueLabel, delay, onPress }: {
  label:      string
  count:      number
  max:        number
  color:      string
  valueLabel: string
  delay:      number
  onPress?:   () => void
}) {
  const barW = useSharedValue(0)
  const pct  = max > 0 ? count / max : 0
  const { width: SW } = useWindowDimensions()
  const BAR_FULL = SW - Spacing.lg * 2 - Spacing['2xl'] * 2 - 130

  useEffect(() => {
    barW.value = withDelay(delay, withSpring(pct * BAR_FULL, { mass: 1, damping: 18, stiffness: 110 }))
  }, [pct])

  const fillStyle = useAnimatedStyle(() => ({ width: barW.value }))

  const inner = (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: color }, fillStyle]} />
      </View>
      <Text style={styles.barValue}>{valueLabel}</Text>
    </View>
  )
  return onPress ? <Pressable onPress={onPress} hitSlop={6}>{inner}</Pressable> : inner
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
  tapHint:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs },

  // Glass panel
  panel: {
    backgroundColor: Colors.glass,
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    overflow:        'hidden',
    paddingHorizontal: Spacing.lg,
    paddingBottom:   Spacing.lg,
    gap:             Spacing.sm,
  },
  panelSpecular: {
    width:           '100%',
    height:          1,
    backgroundColor: Colors.glassHighlight,
    marginBottom:    Spacing.sm,
  },
  panelTitle: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // Radar wrap + BPM row
  radarWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  bpmRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'baseline',
    gap:            Spacing.sm,
    paddingTop:     Spacing.xs,
  },
  bpmLabel: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bpmValue: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize.xl,
    letterSpacing: -0.5,
  },

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

  // Bar rows
  barRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
  },
  barLabel: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
    width:      90,
  },
  barTrack: {
    flex:            1,
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    overflow:        'hidden',
  },
  barFill: {
    height:       '100%',
    borderRadius: 3,
  },
  barValue: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
    width:      64,
    textAlign:  'right',
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
