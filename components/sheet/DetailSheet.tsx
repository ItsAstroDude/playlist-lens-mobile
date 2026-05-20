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
const BAR_W       = SW * 0.42
const DISMISS_VEL = 900
const DISMISS_Y   = SHEET_H * 0.28

// ─── Sheet ────────────────────────────────────────────────────────────────────
interface DetailSheetProps {
  playlist: SpotifyPlaylist | null
  palette:  PlaylistPalette | null
  onClose:  () => void
}

export function DetailSheet({ playlist, palette, onClose }: DetailSheetProps) {
  const insets   = useSafeAreaInsets()
  const isOpen   = playlist !== null
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
      // Clear analysis state after exit animation finishes
      const t = setTimeout(reset, 380)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // ── Fetch analysis when playlist changes ──
  useEffect(() => {
    if (playlist) {
      analyze(
        playlist.id,
        playlist.name,
        playlist.images?.[0]?.url ?? '',
        palette,
      )
    }
  }, [playlist?.id])

  // ── Dismiss helpers (called from worklet via runOnJS) ──
  const dismiss = useCallback(() => {
    haptic.light()
    onClose()
  }, [onClose])

  // ── Pan gesture on handle only ──
  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      translateY.value = Math.max(0, e.translationY)
    })
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
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          bounces
        >
          {/* Header */}
          {playlist && (
            <SheetHeader playlist={playlist} palette={palette} />
          )}

          {/* Loading skeletons */}
          {status === 'loading' && <AnalysisSkeleton />}

          {/* Error */}
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

          {/* Analysis content */}
          {status === 'success' && data && (
            <AnalysisContent data={data} accent={accent} />
          )}
        </ScrollView>
      </Animated.View>
    </>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function SheetHeader({ playlist, palette }: { playlist: SpotifyPlaylist; palette: PlaylistPalette | null }) {
  const coverUrl = playlist.images?.[0]?.url
  const tint     = palette?.primary ? `${palette.primary}18` : Colors.card

  return (
    <View style={[styles.header, { backgroundColor: tint }]}>
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
  )
}

// ─── Analysis Content ─────────────────────────────────────────────────────────
function AnalysisContent({ data, accent }: { data: PlaylistAnalysis; accent: string }) {
  return (
    <View style={styles.content}>
      {/* Vibe */}
      {data.vibe && <VibeChip vibe={data.vibe} accent={accent} />}

      {/* Stats */}
      <StatsRow data={data} />

      {/* Top Artists */}
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

      {/* Audio features */}
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
            Avg tempo: {Math.round(data.audioFeatures.avgTempo)} BPM
          </Text>
        </Section>
      )}

      {/* Popularity distribution */}
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

      {/* Decades */}
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

      {/* Genre cloud */}
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
  const scale   = useSharedValue(0.85)

  useEffect(() => {
    opacity.value = withDelay(100, withTiming(1, { duration: 300 }))
    scale.value   = withDelay(100, withSpring(1, Spring.snappy))
  }, [])

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={[styles.vibeChip, { borderColor: `${accent}44`, backgroundColor: `${accent}12` }, style]}>
      <Text style={[styles.vibeText, { color: accent }]}>{vibe}</Text>
    </Animated.View>
  )
}

// ─── Stats row ────────────────────────────────────────────────────────────────
function StatsRow({ data }: { data: PlaylistAnalysis }) {
  const stats = [
    { label: 'tracks',   value: data.tracks.length.toString() },
    { label: 'artists',  value: data.artistCount.toString() },
    { label: 'duration', value: fmtDuration(data.totalMs) },
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
  const translateY = useSharedValue(10)

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
    barW.value = withDelay(delay, withSpring(pct * BAR_W, { ...Spring.default, stiffness: 120 }))
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
      {genres.map((g, i) => {
        const prominence = g.count / max
        const opacity    = 0.45 + prominence * 0.55
        return (
          <View
            key={g.genre}
            style={[
              styles.genreTag,
              {
                backgroundColor: `${accent}${Math.round(opacity * 0.18 * 255).toString(16).padStart(2, '0')}`,
                borderColor:     `${accent}${Math.round(opacity * 0.35 * 255).toString(16).padStart(2, '0')}`,
              },
            ]}
          >
            <Text style={[styles.genreText, { opacity, color: accent }]}>{g.genre}</Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

// ─── Loading skeletons ────────────────────────────────────────────────────────
function AnalysisSkeleton() {
  return (
    <View style={styles.content}>
      <Skeleton height={32} width="50%" borderRadius={Radius.full} style={{ marginBottom: Spacing.lg }} />
      <View style={styles.statsRow}>
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} height={64} width={(SW - Spacing.lg * 2 - Spacing.sm * 3) / 4} borderRadius={Radius.md} />
        ))}
      </View>
      <Skeleton height={14} width="35%" borderRadius={4} style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }} />
      {[80, 65, 50, 45, 30].map((w, i) => (
        <View key={i} style={[styles.barRow, { marginBottom: Spacing.md }]}>
          <Skeleton height={10} width={70} borderRadius={4} />
          <Skeleton height={6}  width={w * 1.5} borderRadius={3} />
          <Skeleton height={10} width={36} borderRadius={4} />
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },

  // ── Sheet ──
  sheet: {
    position:           'absolute',
    bottom:             0,
    left:               0,
    right:              0,
    height:             SHEET_H,
    backgroundColor:    Colors.background,
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth:     1,
    borderLeftWidth:    1,
    borderRightWidth:   1,
    borderColor:        Colors.border,
    zIndex:             11,
    overflow:           'hidden',
  },

  // ── Handle ──
  handleArea: {
    alignItems:     'center',
    paddingVertical: Spacing.md,
  },
  handle: {
    width:        36,
    height:       4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
  },

  // ── Header ──
  header: {
    flexDirection:  'row',
    gap:            Spacing.md,
    padding:        Spacing.md,
    borderRadius:   Radius.lg,
    marginBottom:   Spacing.lg,
  },
  cover: {
    width:        88,
    height:       88,
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
    gap:            4,
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
    marginTop:         Spacing.xs,
    backgroundColor:   Colors.card,
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       Colors.border,
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
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.xs,
    marginBottom:      Spacing.md,
  },
  vibeText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    gap:           Spacing.sm,
    marginBottom:  Spacing.lg,
  },
  statCard: {
    flex:            1,
    backgroundColor: Colors.card,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.sm,
    alignItems:      'center',
    gap:             2,
  },
  statValue: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize.md,
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
    marginBottom: Spacing.xl,
    gap:          Spacing.md,
  },
  sectionTitle: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── Bar rows ──
  barRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing.sm,
  },
  barLabel: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
    width:      96,
  },
  barTrack: {
    flex:            1,
    height:          5,
    borderRadius:    3,
    backgroundColor: Colors.card,
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
    width:      52,
    textAlign:  'right',
  },
  tempoNote: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
    marginTop:  Spacing.xs,
  },

  // ── Genre cloud ──
  genreCloud: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
  },
  genreTag: {
    borderRadius:    Radius.full,
    borderWidth:     1,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   3,
  },
  genreText: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.xs,
    textTransform: 'lowercase',
  },

  // ── Error ──
  errorBox: {
    alignItems:  'center',
    gap:         Spacing.md,
    paddingTop:  Spacing['3xl'],
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
