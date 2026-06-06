import React, { useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, FlatList, Image, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, FadeIn,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { useAnalysis } from '@/hooks/useAnalysis'
import { usePlaylists } from '@/hooks/useSpotify'
import { usePalette } from '@/hooks/usePalette'
import { ensureReadable, vibeColor } from '@/utils/color'
import type { SpotifyPlaylist, PlaylistAnalysis } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMs(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function pct(n: number) { return `${Math.round(n * 100)}%` }

// ─── Playlist picker modal ────────────────────────────────────────────────────
function PlaylistPicker({
  playlists, onSelect, onClose, exclude,
}: {
  playlists: SpotifyPlaylist[]
  onSelect:  (pl: SpotifyPlaylist) => void
  onClose:   () => void
  exclude?:  string
}) {
  const items = playlists.filter(p => p.id !== exclude)
  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>Choose a playlist</Text>
        <FlatList
          data={items}
          keyExtractor={p => p.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const thumb = item.images?.[0]?.url
            return (
              <TouchableOpacity style={styles.pickerRow} onPress={() => { onSelect(item); onClose() }}>
                {thumb
                  ? <Image source={{ uri: thumb }} style={styles.pickerThumb} />
                  : <View style={[styles.pickerThumb, { backgroundColor: Colors.glass }]} />
                }
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.pickerName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.pickerCount}>{item.tracks.total} tracks</Text>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      </View>
    </Modal>
  )
}

// ─── Slot button ──────────────────────────────────────────────────────────────
function SlotButton({
  playlist, color, onPress, loading,
}: {
  playlist?: SpotifyPlaylist
  color:     string
  onPress:   () => void
  loading?:  boolean
}) {
  const thumb = playlist?.images?.[0]?.url
  return (
    <TouchableOpacity
      style={[styles.slot, { borderColor: `${color}40` }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.slotAccent, { backgroundColor: color }]} />
      {thumb
        ? <Image source={{ uri: thumb }} style={styles.slotThumb} />
        : <View style={[styles.slotThumb, { backgroundColor: Colors.glass }]} />
      }
      <Text style={[styles.slotName, playlist && { color: '#e0e0e0' }]} numberOfLines={2}>
        {loading ? 'Analysing…' : playlist ? playlist.name : 'Tap to choose'}
      </Text>
      {playlist && (
        <Text style={styles.slotCount}>{playlist.tracks.total} tracks</Text>
      )}
    </TouchableOpacity>
  )
}

// ─── Stat row ─────────────────────────────────────────────────────────────────
function StatRow({
  label, a, b, colorA, colorB, winner,
}: {
  label:   string
  a:       string
  b:       string
  colorA:  string
  colorB:  string
  winner?: 'a' | 'b' | 'tie'
}) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statVal, { color: colorA, fontWeight: winner === 'a' ? '700' : '400' }]}>
        {a}
      </Text>
      <View style={styles.statMid}>
        <Text style={styles.statLabel}>{label}</Text>
        {winner === 'tie' && <Text style={styles.tieChip}>tie</Text>}
      </View>
      <Text style={[styles.statVal, { color: colorB, fontWeight: winner === 'b' ? '700' : '400', textAlign: 'right' }]}>
        {b}
      </Text>
    </View>
  )
}

// ─── Audio bar ────────────────────────────────────────────────────────────────
// NOTE: Reanimated cannot animate string values like '50%'. We measure the bar
// track's pixel width via onLayout, then animate absolute pixel values instead.
function AudioBar({ label, valA, valB, colorA, colorB }: {
  label: string; valA: number; valB: number; colorA: string; colorB: string
}) {
  const wA   = useSharedValue(0)
  const wB   = useSharedValue(0)
  const [barW, setBarW] = useState(0)

  React.useEffect(() => {
    if (barW === 0) return
    wA.value = withSpring(valA * barW, { mass: 1, damping: 18, stiffness: 110 })
    wB.value = withSpring(valB * barW, { mass: 1, damping: 18, stiffness: 110 })
  }, [valA, valB, barW])

  const styleA = useAnimatedStyle(() => ({ width: wA.value }))
  const styleB = useAnimatedStyle(() => ({ width: wB.value }))

  return (
    <View style={styles.audioRow}>
      <Text style={[styles.audioLabel, { textAlign: 'right', color: colorA }]}>{pct(valA)}</Text>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.barTrack} onLayout={e => setBarW(e.nativeEvent.layout.width)}>
          <Animated.View style={[styles.barFill, { backgroundColor: colorA }, styleA]} />
        </View>
        <Text style={styles.audioBarLabel}>{label}</Text>
        <View style={[styles.barTrack, { flexDirection: 'row-reverse' }]}>
          <Animated.View style={[styles.barFill, { backgroundColor: colorB }, styleB]} />
        </View>
      </View>
      <Text style={[styles.audioLabel, { color: colorB }]}>{pct(valB)}</Text>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CompareTab() {
  const { fetch: fetchPlaylists, ...plState } = usePlaylists()
  const { analyze }                           = useAnalysis()
  const { palettes, extract }                 = usePalette()

  const [plA,      setPlA]      = useState<SpotifyPlaylist | undefined>()
  const [plB,      setPlB]      = useState<SpotifyPlaylist | undefined>()
  const [dataA,    setDataA]    = useState<PlaylistAnalysis | null>(null)
  const [dataB,    setDataB]    = useState<PlaylistAnalysis | null>(null)
  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)
  const [picker,   setPicker]   = useState<'a' | 'b' | null>(null)

  const playlists = plState.data ?? []

  // Keep each playlist's cover hue, but lift any that's too dark to read on the
  // #131315 background (e.g. a near-black maroon cover → a legible rose).
  const colorA = ensureReadable((plA ? palettes[plA.id]?.primary : null) ?? Colors.compareA)
  const colorB = ensureReadable((plB ? palettes[plB.id]?.primary : null) ?? Colors.compareB)

  const openPicker = useCallback(async (slot: 'a' | 'b') => {
    if (!playlists.length) await fetchPlaylists()
    setPicker(slot)
  }, [playlists, fetchPlaylists])

  const onSelect = useCallback(async (slot: 'a' | 'b', pl: SpotifyPlaylist) => {
    if (slot === 'a') { setPlA(pl); setDataA(null); setLoadingA(true) }
    else              { setPlB(pl); setDataB(null); setLoadingB(true) }

    // Kick off palette extraction alongside analysis
    const url = pl.images?.[0]?.url ?? ''
    if (url && !palettes[pl.id]) extract(pl.id, url)

    const result = await analyze(pl.id, pl.name, url, null)

    if (slot === 'a') { setDataA(result ?? null); setLoadingA(false) }
    else              { setDataB(result ?? null); setLoadingB(false) }
  }, [analyze, palettes, extract])

  const sharedGenres = useMemo(() => {
    if (!dataA || !dataB) return []
    const setB = new Set(dataB.topGenres.map(g => g.genre))
    return dataA.topGenres.filter(g => setB.has(g.genre)).slice(0, 8)
  }, [dataA, dataB])

  const hasResult = dataA && dataB

  return (
    <View style={styles.container}>
      {/* Ambient glows — match the taste / share tabs */}
      <View style={styles.ambientViolet} pointerEvents="none" />
      <View style={styles.ambientPink}   pointerEvents="none" />
      <LinearGradient
        colors={[Colors.auroraTop, Colors.auroraBot]}
        style={styles.aurora}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {picker !== null && playlists.length > 0 && (
          <PlaylistPicker
            playlists={playlists}
            exclude={picker === 'a' ? plB?.id : plA?.id}
            onSelect={pl => onSelect(picker, pl)}
            onClose={() => setPicker(null)}
          />
        )}

        {/* Branded header */}
        <View style={styles.header}>
          <Text style={styles.logo}>
            playlist<Text style={styles.dot}>.</Text>lens
          </Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>compare</Text>
          <Text style={styles.sub}>Side-by-side playlist analysis</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Slot selectors ── */}
        <View style={styles.slots}>
          <SlotButton playlist={plA} color={colorA} loading={loadingA} onPress={() => openPicker('a')} />
          <Text style={styles.vs}>vs</Text>
          <SlotButton playlist={plB} color={colorB} loading={loadingB} onPress={() => openPicker('b')} />
        </View>

        {/* ── Results ── */}
        {hasResult && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.results}>

            {/* Vibes */}
            {(dataA.vibe || dataB.vibe) && (
              <View style={styles.vibeRow}>
                {dataA.vibe
                  ? <Text style={[styles.vibeChip, { borderColor: `${vibeColor(dataA.vibe)}40`, color: vibeColor(dataA.vibe) }]}>{dataA.vibe}</Text>
                  : <View style={{ flex: 1 }} />}
                {dataB.vibe
                  ? <Text style={[styles.vibeChip, { borderColor: `${vibeColor(dataB.vibe)}40`, color: vibeColor(dataB.vibe) }]}>{dataB.vibe}</Text>
                  : <View style={{ flex: 1 }} />}
              </View>
            )}

            {/* Key stats */}
            <View style={styles.card}>
              <View style={styles.cardSpecular} />
              <View style={styles.colHeaders}>
                <Text style={[styles.colHead, { color: colorA }]} numberOfLines={1}>{dataA.playlistName}</Text>
                <Text style={[styles.colHead, { color: colorB, textAlign: 'right' }]} numberOfLines={1}>{dataB.playlistName}</Text>
              </View>
              <StatRow label="tracks"     a={dataA.tracks.length.toLocaleString()} b={dataB.tracks.length.toLocaleString()} colorA={colorA} colorB={colorB} winner={dataA.tracks.length > dataB.tracks.length ? 'a' : dataB.tracks.length > dataA.tracks.length ? 'b' : 'tie'} />
              <StatRow label="artists"    a={dataA.artistCount.toString()} b={dataB.artistCount.toString()} colorA={colorA} colorB={colorB} winner={dataA.artistCount > dataB.artistCount ? 'a' : dataB.artistCount > dataA.artistCount ? 'b' : 'tie'} />
              <StatRow label="total time" a={fmtMs(dataA.totalMs)} b={fmtMs(dataB.totalMs)} colorA={colorA} colorB={colorB} />
              <StatRow label="avg pop"    a={`${dataA.avgPop}/100`} b={`${dataB.avgPop}/100`} colorA={colorA} colorB={colorB} winner={dataA.avgPop > dataB.avgPop ? 'a' : dataB.avgPop > dataA.avgPop ? 'b' : 'tie'} />
              {dataA.audioFeatures && dataB.audioFeatures && (
                <StatRow label="avg bpm" a={dataA.audioFeatures.avgTempo.toString()} b={dataB.audioFeatures.avgTempo.toString()} colorA={colorA} colorB={colorB} />
              )}
            </View>

            {/* Audio profile bars */}
            {dataA.audioFeatures && dataB.audioFeatures && (
              <View style={styles.card}>
                <View style={styles.cardSpecular} />
                <Text style={styles.sectionLabel}>audio profile</Text>
                {([
                  ['Danceability', dataA.audioFeatures.danceability,     dataB.audioFeatures.danceability],
                  ['Energy',       dataA.audioFeatures.energy,           dataB.audioFeatures.energy],
                  ['Positivity',   dataA.audioFeatures.valence,          dataB.audioFeatures.valence],
                  ['Acousticness', dataA.audioFeatures.acousticness,     dataB.audioFeatures.acousticness],
                  ['Liveness',     dataA.audioFeatures.liveness,         dataB.audioFeatures.liveness],
                ] as [string, number, number][]).map(([lbl, a, b]) => (
                  <AudioBar key={lbl} label={lbl} valA={a} valB={b} colorA={colorA} colorB={colorB} />
                ))}
              </View>
            )}

            {/* Shared genres */}
            {sharedGenres.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardSpecular} />
                <Text style={styles.sectionLabel}>shared genres</Text>
                <View style={styles.tagWrap}>
                  {sharedGenres.map(g => (
                    <View key={g.genre} style={[styles.genreTag, { borderColor: `${colorA}40` }]}>
                      <Text style={styles.genreTagText}>{g.genre}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Top artists side-by-side */}
            <View style={styles.card}>
              <View style={styles.cardSpecular} />
              <Text style={styles.sectionLabel}>top artists</Text>
              <View style={styles.artistCols}>
                <View style={{ flex: 1 }}>
                  {dataA.topArtists.slice(0, 5).map((a, i) => (
                    <Text key={a.id} style={[styles.artistName, { color: i === 0 ? colorA : Colors.textMuted }]} numberOfLines={1}>
                      {i + 1}. {a.name}
                    </Text>
                  ))}
                </View>
                <View style={[styles.artistDivider, { backgroundColor: Colors.glassBorder }]} />
                <View style={{ flex: 1 }}>
                  {dataB.topArtists.slice(0, 5).map((b, i) => (
                    <Text key={b.id} style={[styles.artistName, { color: i === 0 ? colorB : Colors.textMuted, textAlign: 'right' }]} numberOfLines={1}>
                      {b.name} .{i + 1}
                    </Text>
                  ))}
                </View>
              </View>
            </View>

          </Animated.View>
        )}

        {/* Empty state */}
        {!hasResult && !loadingA && !loadingB && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>◎</Text>
            <Text style={styles.emptyText}>Pick two playlists above{'\n'}to see how they stack up</Text>
          </View>
        )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safe:      { flex: 1, zIndex: 1 },
  scroll:    { paddingHorizontal: Spacing.lg, paddingBottom: 120 },

  // Ambient glows (match taste / share)
  ambientViolet: {
    position: 'absolute', top: -80, left: -80, width: 300, height: 300,
    borderRadius: 150, backgroundColor: Colors.violetGlow,
  },
  ambientPink: {
    position: 'absolute', bottom: -100, right: -80, width: 260, height: 260,
    borderRadius: 130, backgroundColor: Colors.pinkGlow,
  },
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },

  // Branded header
  header: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs,
  },
  logo: {
    fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, letterSpacing: -1,
  },
  dot: { color: Colors.greenPrimary },
  titleBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: 3 },
  title: {
    fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1,
  },
  sub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },

  // Slots
  slots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
  slot: {
    flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderRadius: Radius.lg,
    padding: Spacing.sm, alignItems: 'center', gap: Spacing.xs, overflow: 'hidden',
    minHeight: 120, justifyContent: 'center',
  },
  slotAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.7 },
  slotThumb:  { width: 56, height: 56, borderRadius: Radius.sm },
  slotName:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  slotCount:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, opacity: 0.5 },
  vs: { fontFamily: FontFamily.display, fontSize: FontSize.lg, fontWeight: '800', color: Colors.textMuted, letterSpacing: -1 },

  // Results
  results:  { gap: Spacing.md },
  vibeRow:  { flexDirection: 'row', gap: Spacing.sm },
  vibeChip: {
    flex: 1, textAlign: 'center', fontFamily: FontFamily.mono, fontSize: FontSize.xs,
    borderWidth: 1, borderRadius: Radius.full, paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm, backgroundColor: Colors.glass,
  },

  // Cards
  card: {
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: Radius.xl, padding: Spacing.lg, overflow: 'hidden', gap: Spacing.sm,
  },
  cardSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  colHeaders:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs, gap: Spacing.sm },
  colHead:      { flex: 1, fontFamily: FontFamily.display, fontSize: FontSize.sm, fontWeight: '700' },
  sectionLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: Spacing.xs },

  // Stat rows
  statRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 3 },
  statVal:   { flex: 1, fontFamily: FontFamily.display, fontSize: 18, letterSpacing: -0.5 },
  statMid:   { alignItems: 'center', gap: 2, minWidth: 80 },
  statLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1.5 },
  tieChip:   { fontFamily: FontFamily.mono, fontSize: 8, color: Colors.textMuted, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.full, paddingHorizontal: 4, paddingVertical: 1 },

  // Audio bars
  audioRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  audioLabel:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, width: 36, color: Colors.textMuted },
  audioBarLabel:{ fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  barTrack:     { height: 6, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  barFill:      { height: '100%', borderRadius: 4 },

  // Shared genres
  tagWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  genreTag:     { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, backgroundColor: Colors.glass },
  genreTagText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },

  // Artist cols
  artistCols:    { flexDirection: 'row', gap: Spacing.md },
  artistDivider: { width: 1, alignSelf: 'stretch' },
  artistName:    { fontFamily: FontFamily.mono, fontSize: FontSize.sm, paddingVertical: 3 },

  // Picker modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet:    { backgroundColor: '#0f0f18', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderTopWidth: 1, borderColor: Colors.glassBorder, maxHeight: '75%', paddingTop: Spacing.sm },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, alignSelf: 'center', marginBottom: Spacing.md },
  modalTitle:    { fontFamily: FontFamily.display, fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, letterSpacing: -0.5 },
  pickerRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderColor: Colors.glassBorder },
  pickerThumb:   { width: 44, height: 44, borderRadius: Radius.sm },
  pickerName:    { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.text },
  pickerCount:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyIcon:  { fontSize: 48, color: Colors.glassBorder },
  emptyText:  { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: FontSize.sm * 1.7 },
})
