import React, { useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useAnalysis } from '@/hooks/useAnalysis'
import { fmtDuration } from '@/utils/analyze'
import { Skeleton } from '@/components/ui/Skeleton'
import type { SpotifyPlaylist, PlaylistAnalysis, PlaylistPalette } from '@/types'

const { width: SW, height: SH } = Dimensions.get('window')
const SHEET_H     = SH * 0.88
const BAR_W       = SW * 0.40
const DISMISS_VEL = 900
const DISMISS_Y   = SHEET_H * 0.28

// ─── Sheet ────────────────────────────────────────────────────────────────────
interface DetailSheetProps {
  playlist: SpotifyPlaylist | null
  palette:  PlaylistPalette | null
  onClose:  () => void
}

export function DetailSheet({ playlist, palette, onClose }: DetailSheetProps) {
  const insets = useSafeAreaInsets()
  const isOpen = playlist !== null
  const { status, data, error, analyze, reset } = useAnalysis()

  // ── Sheet & backdrop animation ──
  const translateY      = useSharedValue(SHEET_H)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    if (isOpen) {
      translateY.value      = withSpring(0, Spring.sheet)
      backdropOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) })
    } else {
      translateY.value      = withSpring(SHEET_H, Spring.sheet)
      backdropOpacity.value = withTiming(0, { duration: 220 })
      const t = setTimeout(reset, 380)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // ── Trigger analysis when playlist changes ──
  useEffect(() => {
    if (playlist) {
      analyze(playlist.id, playlist.name, playlist.images?.[0]?.url ?? '', palette)
    }
  }, [playlist?.id])

  // ── Dismiss helpers ──
  const dismiss = useCallback(() => {
    haptic.light()
    onClose()
  }, [onClose])

  // ── Pan gesture on handle only ──
  const panGesture = Gesture.Pan()
    .onUpdate(e => { translateY.value = Math.max(0, e.translationY) })
    .onEnd(e => {
      if (e.translationY > DISMISS_Y || e.velocityY > DISMISS_VEL) {
        translateY.value      = withSpring(SHEET_H, Spring.sheet)
        backdropOpacity.value = withTiming(0, { duration: 220 })
        runOnJS(dismiss)()
      } else {
        translateY.value = withSpring(0, Spring.sheet)
      }
    })

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }))

  const accent = palette?.primary ?? Colors.green

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>

        {/* Drag handle */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        {/* Scrollable content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          bounces
        >
          {playlist && <SheetHeader playlist={playlist} palette={palette} />}

          {status === 'loading' && <AnalysisSkeleton />}

          {status === 'error' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                onPress={() => playlist && analyze(playlist.id, playlist.name, playlist.images?.[0]?.url ?? '', palette)}
                style={[styles.retryBtn, { borderColor: accent }]}
              >
                <Text style={[styles.retryBtnText, { color: accent }]}>Retry</Text>
              </Pressable>
            </View>
          )}

          {status === 'success' && data && (
            <AnalysisContent data={data} accent={accent} trackTotal={playlist?.tracks.total} />
          )}
        </ScrollView>
      </Animated.View>
    </>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function SheetHeader({ playlist, palette }: { playlist: SpotifyPlaylist; palette: PlaylistPalette | null }) {
  const coverUrl = playlist.images?.[0]?.url
  const tint     = palette?.primary ? `${palette.primary}16` : Colors.glass

  return (
    <View style={[styles.header, { backgroundColor: tint, borderColor: Colors.glassBorder }]}>
      {/* Glass specular on header panel */}
      <View style={styles.headerSpecular} />

      <View style={styles.headerInner}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.cover}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Text style={styles.coverEmoji}>🎵</Text>
          </View>
        )}

        <View style={styles.headerInfo}>
          <Text style={styles.playlistName} numberOfLines={2}>{playlist.name}</Text>
          <Text style={styles.ownerName} numberOfLines={1}>{playlist.owner.display_name}</Text>
          <View style={styles.trackBadge}>
            <Text style={styles.trackBadgeText}>{playlist.tracks.total} tracks</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

// ─── Analysis Content ─────────────────────────────────────────────────────────
function AnalysisContent({ data, accent, trackTotal }: { data: PlaylistAnalysis; accent: string; trackTotal?: number }) {
  return (
    <View style={styles.content}>

      {data.vibe && <VibeChip vibe={data.vibe} accent={accent} />}

      <StatsRow data={data} trackTotal={trackTotal} />

      {data.topArtists.length > 0 && (
        <Section title="Top Artists">
          {data.topArtists.slice(0, 6).map((artist, i) => (
            <BarRow
              key={artist.id}
              label={artist.name}
              count={artist.count}
              max={data.topArtists[0].count}
              color={accent}
              valueSuffix={artist.count === 1 ? 'track' : 'tracks'}
              delay={i * 50}
            />
          ))}
        </Section>
      )}

      {data.audioFeatures && (
        <Section title="Audio Profile">
          {([
            ['Danceability',     data.audioFeatures.danceability],
            ['Energy',           data.audioFeatures.energy],
            ['Happiness',        data.audioFeatures.valence],
            ['Acousticness',     data.audioFeatures.acousticness],
            ['Instrumentalness', data.audioFeatures.instrumentalness],
            ['Liveness',         data.audioFeatures.liveness],
          ] as [string, number][]).map(([label, val], i) => (
            <BarRow
              key={label}
              label={label}
              count={val}
              max={1}
              color={accent}
              valueSuffix={Math.round(val * 100).toString()}
              delay={i * 40}
              format="pct"
            />
          ))}
          <Text style={styles.tempoNote}>
            Avg tempo — {Math.round(data.audioFeatures.avgTempo)} BPM
          </Text>
        </Section>
      )}

      {data.popBuckets.some(b => b.count > 0) && (
        <Section title="Popularity">
          {data.popBuckets.filter(b => b.count > 0).map((b, i) => (
            <BarRow
              key={b.label}
              label={b.label}
              count={b.count}
              max={Math.max(...data.popBuckets.map(x => x.count))}
              color={accent}
              valueSuffix={b.count === 1 ? 'track' : 'tracks'}
              delay={i * 45}
            />
          ))}
        </Section>
      )}

      {data.decades.length > 0 && (
        <Section title="By Decade">
          {data.decades.map((d, i) => (
            <BarRow
              key={d.label}
              label={d.label}
              count={d.count}
              max={Math.max(...data.decades.map(x => x.count))}
              color={accent}
              valueSuffix={d.count === 1 ? 'track' : 'tracks'}
              delay={i * 50}
            />
          ))}
        </Section>
      )}

      {data.topGenres.length > 0 && (
        <Section title="Genres">
          <GenreCloud genres={data.topGenres} accent={accent} />
        </Section>
      )}
    </View>
  )
}

// ─── Vibe chip ────────────────────────────────────────────────────────────────
function VibeChip({ vibe, accent }: { vibe: string; accent: string }) {
  const opacity = useSharedValue(0)
  const scale   = useSharedValue(0.82)

  useEffect(() => {
    opacity.value = withDelay(80,  withTiming(1, { duration: 320 }))
    scale.value   = withDelay(80,  withSpring(1, Spring.snappy))
  }, [])

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      style={[
        styles.vibeChip,
        { borderColor: `${accent}50`, backgroundColor: `${accent}14` },
        style,
      ]}
    >
      <Text style={[styles.vibeText, { color: accent }]}>{vibe}</Text>
    </Animated.View>
  )
}

// ─── Stats row ────────────────────────────────────────────────────────────────
function StatsRow({ data, trackTotal }: { data: PlaylistAnalysis; trackTotal?: number }) {
  // Use the real Spotify-reported total for display; data.tracks.length is capped
  // at 500 by the backend so it would be misleading on large playlists.
  const displayTotal   = trackTotal ?? data.tracks.length
  const isTruncated    = trackTotal != null && data.tracks.length < trackTotal
  const durationValue  = isTruncated
    // Extrapolate duration: avg track length × real total
    ? fmtDuration((data.totalMs / data.tracks.length) * trackTotal)
    : fmtDuration(data.totalMs)

  const stats = [
    { label: 'tracks',   value: displayTotal.toLocaleString() },
    { label: 'artists',  value: data.artistCount.toString() },
    { label: 'duration', value: durationValue },
    { label: 'avg pop',  value: `${data.avgPop}` },
  ]
  return (
    <View style={styles.statsRow}>
      {stats.map((s, i) => (
        <StatCard key={s.label} label={s.label} value={s.value} delay={i * 60} />
      ))}
    </View>
  )
}

function StatCard({ label, value, delay }: { label: string; value: string; delay: number }) {
  const opacity    = useSharedValue(0)
  const translateY = useSharedValue(12)

  useEffect(() => {
    opacity.value    = withDelay(delay, withTiming(1, { duration: 300 }))
    translateY.value = withDelay(delay, withSpring(0, Spring.entrance))
  }, [])

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View style={[styles.statCard, style]}>
      {/* Glass specular on each stat card */}
      <View style={styles.statSpecular} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  )
}

// ─── Animated bar row ─────────────────────────────────────────────────────────
interface BarRowProps {
  label:       string
  count:       number
  max:         number
  color:       string
  valueSuffix: string
  delay:       number
  format?:     'count' | 'pct'
}

function BarRow({ label, count, max, color, valueSuffix, delay, format = 'count' }: BarRowProps) {
  const barW = useSharedValue(0)
  const pct  = max > 0 ? count / max : 0

  useEffect(() => {
    barW.value = withDelay(delay, withSpring(pct * BAR_W, { mass: 1, damping: 18, stiffness: 110 }))
  }, [pct])

  const fillStyle = useAnimatedStyle(() => ({ width: barW.value }))

  const valueLabel = format === 'pct'
    ? `${valueSuffix}%`
    : `${count} ${valueSuffix}`

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: color }, fillStyle]} />
      </View>
      <Text style={styles.barValue}>{valueLabel}</Text>
    </View>
  )
}

// ─── Genre cloud ──────────────────────────────────────────────────────────────
function GenreCloud({ genres, accent }: { genres: { genre: string; count: number }[]; accent: string }) {
  const max = genres[0]?.count ?? 1
  return (
    <View style={styles.genreCloud}>
      {genres.map(g => {
        const prominence = g.count / max
        const alpha      = Math.round((0.4 + prominence * 0.6) * 255).toString(16).padStart(2, '0')
        const bgAlpha    = Math.round((0.06 + prominence * 0.12) * 255).toString(16).padStart(2, '0')
        return (
          <View
            key={g.genre}
            style={[
              styles.genreTag,
              {
                backgroundColor: `${accent}${bgAlpha}`,
                borderColor:     `${accent}${alpha}40`,
              },
            ]}
          >
            <Text style={[styles.genreText, { color: `${accent}${alpha}` }]}>{g.genre}</Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
// Title is flanked by thin glass lines — classic premium divider style.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLine} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionLine} />
      </View>
      {children}
    </View>
  )
}

// ─── Loading skeletons ────────────────────────────────────────────────────────
function AnalysisSkeleton() {
  return (
    <View style={styles.content}>
      <Skeleton height={36} width="52%" borderRadius={Radius.full} style={{ marginBottom: Spacing.lg }} />
      <View style={styles.statsRow}>
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} height={72} width={(SW - Spacing.lg * 2 - Spacing.sm * 3) / 4} borderRadius={Radius.md} />
        ))}
      </View>
      <Skeleton height={12} width="35%" borderRadius={4} style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }} />
      {[80, 65, 50, 45, 30].map((w, i) => (
        <View key={i} style={[styles.barRow, { marginBottom: Spacing.md }]}>
          <Skeleton height={10} width={72} borderRadius={4} />
          <Skeleton height={7}  width={w * 1.5} borderRadius={4} />
          <Skeleton height={10} width={38} borderRadius={4} />
        </View>
      ))}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Backdrop ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.60)',
    zIndex: 10,
  },

  // ── Sheet ──
  sheet: {
    position:               'absolute',
    bottom:                 0,
    left:                   0,
    right:                  0,
    height:                 SHEET_H,
    backgroundColor:        Colors.background,
    borderTopLeftRadius:    Radius['2xl'],
    borderTopRightRadius:   Radius['2xl'],
    borderTopWidth:         1,
    borderLeftWidth:        1,
    borderRightWidth:       1,
    borderColor:            Colors.glassBorder,
    zIndex:                 11,
    overflow:               'hidden',
  },

  // ── Drag handle ──
  handleArea: {
    alignItems:      'center',
    paddingVertical: Spacing.md,
  },
  handle: {
    width:           44,
    height:          5,
    borderRadius:    Radius.full,
    backgroundColor: Colors.glassBorder,
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
  },

  // ── Header panel ──
  header: {
    borderRadius:   Radius.xl,
    borderWidth:    1,
    overflow:       'hidden',
    marginBottom:   Spacing.xl,
  },
  // Glass specular runs across the very top of the header panel
  headerSpecular: {
    height:          1,
    backgroundColor: Colors.glassHighlight,
  },
  headerInner: {
    flexDirection: 'row',
    gap:           Spacing.md,
    padding:       Spacing.md,
  },
  cover: {
    width:        96,
    height:       96,
    borderRadius: Radius.md,
  },
  coverFallback: {
    backgroundColor: Colors.card,
    alignItems:      'center',
    justifyContent:  'center',
  },
  coverEmoji: { fontSize: 32 },
  headerInfo: {
    flex:           1,
    justifyContent: 'center',
    gap:            5,
  },
  playlistName: {
    fontFamily: FontFamily.syneBold,
    fontSize:   FontSize.lg,
    color:      Colors.text,
    lineHeight: FontSize.lg * 1.2,
  },
  ownerName: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },
  trackBadge: {
    alignSelf:         'flex-start',
    marginTop:         2,
    backgroundColor:   Colors.glass,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       Colors.glassBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   3,
  },
  trackBadgeText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
  },

  // ── Content ──
  content: {
    gap: Spacing.xs,
  },

  // ── Vibe chip ──
  vibeChip: {
    alignSelf:         'flex-start',
    borderRadius:      Radius.full,
    borderWidth:       1,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.sm,
    marginBottom:      Spacing.lg,
  },
  vibeText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.base,
    letterSpacing: 0.2,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    gap:           Spacing.sm,
    marginBottom:  Spacing.xl,
  },
  statCard: {
    flex:             1,
    backgroundColor:  Colors.glass,
    borderRadius:     Radius.md,
    borderWidth:      1,
    borderColor:      Colors.glassBorder,
    overflow:         'hidden',
    alignItems:       'center',
    gap:              3,
    paddingBottom:    Spacing.sm,
  },
  // Glass specular across the very top of the stat card
  statSpecular: {
    width:           '100%',
    height:          1,
    backgroundColor: Colors.glassHighlight,
    marginBottom:    Spacing.sm,
  },
  statValue: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize.lg,
    color:         Colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },

  // ── Section ──
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
    marginBottom:  Spacing.md,
  },
  sectionLine: {
    flex:            1,
    height:          1,
    backgroundColor: Colors.glassBorder,
  },
  sectionTitle: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },

  // ── Bar rows ──
  barRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
    marginBottom:  Spacing.sm,
  },
  barLabel: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
    width:      96,
  },
  barTrack: {
    flex:            1,
    height:          7,
    borderRadius:    4,
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    overflow:        'hidden',
  },
  barFill: {
    height:       '100%',
    borderRadius: 4,
  },
  barValue: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
    width:      58,
    textAlign:  'right',
  },
  tempoNote: {
    fontFamily:  FontFamily.mono,
    fontSize:    FontSize.xs,
    color:       Colors.textMuted,
    marginTop:   Spacing.sm,
    letterSpacing: 0.2,
  },

  // ── Genre cloud ──
  genreCloud: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
  },
  genreTag: {
    borderRadius:      Radius.full,
    borderWidth:       1,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   4,
  },
  genreText: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.xs,
    textTransform: 'lowercase',
  },

  // ── Error ──
  errorBox: {
    alignItems: 'center',
    gap:        Spacing.md,
    paddingTop: Spacing['3xl'],
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
