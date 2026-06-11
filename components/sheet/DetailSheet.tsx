import React, { useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Pressable,
  BackHandler,
} from 'react-native'
import { Image } from 'expo-image'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, OnDark } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useAnalysis } from '@/hooks/useAnalysis'
import { fmtDuration } from '@/utils/analyze'
import { ensureReadable } from '@/utils/color'
import { Skeleton } from '@/components/ui/Skeleton'
import { RadarChart } from '@/components/ui/RadarChart'
import type { SpotifyPlaylist, PlaylistAnalysis, PlaylistPalette } from '@/types'

const { width: SW, height: SH } = Dimensions.get('window')
const SHEET_H     = SH * 0.90
const HERO_H      = 260
const DISMISS_VEL = 900
const DISMISS_Y   = SHEET_H * 0.26

// ─── Sheet ────────────────────────────────────────────────────────────────────
interface DetailSheetProps {
  playlist: SpotifyPlaylist | null
  palette:  PlaylistPalette | null
  onClose:  () => void
  onGone?:  (id: string) => void
}

export function DetailSheet({ playlist, palette, onClose, onGone }: DetailSheetProps) {
  const insets = useSafeAreaInsets()
  const isOpen = playlist !== null
  const { status, data, error, analyze, reset } = useAnalysis()

  const translateY      = useSharedValue(SHEET_H)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    if (isOpen) {
      translateY.value      = withSpring(0, Spring.sheet)
      backdropOpacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.ease) })
    } else {
      translateY.value      = withSpring(SHEET_H, Spring.sheet)
      backdropOpacity.value = withTiming(0, { duration: 200 })
      const t = setTimeout(reset, 360)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  useEffect(() => {
    if (playlist) {
      analyze(playlist.id, playlist.name, playlist.images?.[0]?.url ?? '', palette,
        { onGone: () => onGone?.(playlist.id) })
    }
  }, [playlist?.id])

  const dismiss = useCallback(() => {
    haptic.light()
    onClose()
  }, [onClose])

  const panGesture = Gesture.Pan()
    .onUpdate(e => { translateY.value = Math.max(0, e.translationY) })
    .onEnd(e => {
      if (e.translationY > DISMISS_Y || e.velocityY > DISMISS_VEL) {
        translateY.value      = withSpring(SHEET_H, Spring.sheet)
        backdropOpacity.value = withTiming(0, { duration: 200 })
        runOnJS(dismiss)()
      } else {
        translateY.value = withSpring(0, Spring.sheet)
      }
    })

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }))

  // Lift dark cover colours to a readable tone (same clamp Compare uses), so the
  // vibe pill / genre chips / bars aren't invisible on near-black covers.
  const accent = ensureReadable(palette?.primary ?? Colors.greenPrimary)

  // While the sheet is open, hardware/gesture back should close it — not pop the
  // navigator (which could otherwise jump away from the current tab).
  useEffect(() => {
    if (!isOpen) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss()
      return true
    })
    return () => sub.remove()
  }, [isOpen, dismiss])

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>

        {/* Drag handle */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          bounces
        >
          {/* ── Hero Section ── */}
          {playlist && <HeroSection playlist={playlist} palette={palette} />}

          {/* ── Analysis states ── */}
          {status === 'loading' && <AnalysisSkeleton accent={accent} />}

          {status === 'error' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                onPress={() => playlist && analyze(playlist.id, playlist.name, playlist.images?.[0]?.url ?? '', palette,
                  { onGone: () => onGone?.(playlist.id) })}
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

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection({ playlist, palette }: { playlist: SpotifyPlaylist; palette: PlaylistPalette | null }) {
  const coverUrl = playlist.images?.[0]?.url

  return (
    <View style={styles.hero}>
      {/* Blurred cover background */}
      {coverUrl && (
        <Image
          source={{ uri: coverUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
      )}
      <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(19,19,21,0.15)', 'rgba(19,19,21,1.0)']}
        locations={[0, 0.85]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Crisp cover art centered */}
      <View style={styles.heroCoverWrap}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.heroCover}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.heroCover, styles.heroCoverFallback]}>
            <Text style={styles.heroCoverEmoji}>🎵</Text>
          </View>
        )}
        {/* Specular highlight on cover */}
        <View style={styles.coverSpecular} />
      </View>

      {/* Playlist info at bottom of hero */}
      <View style={styles.heroInfo}>
        <Text style={styles.heroName} numberOfLines={2}>{playlist.name}</Text>
        <Text style={styles.heroOwner}>{playlist.owner.display_name}</Text>
      </View>
    </View>
  )
}

// ─── Analysis Content ─────────────────────────────────────────────────────────
function AnalysisContent({ data, accent, trackTotal }: { data: PlaylistAnalysis; accent: string; trackTotal?: number }) {
  // Only the backend's 500-track cap is a real truncation worth estimating
  // around (and we flag it with "~"). For everything else show the exact summed
  // duration of the tracks we analysed — extrapolating over a few unavailable
  // tracks was inflating the number.
  const TRACK_CAP     = 500
  const displayTotal  = trackTotal ?? data.tracks.length
  const isCapped      = trackTotal != null && trackTotal > TRACK_CAP && data.tracks.length > 0
  const durationValue = isCapped
    ? '~' + fmtDuration((data.totalMs / data.tracks.length) * trackTotal)
    : fmtDuration(data.totalMs)

  return (
    <View style={styles.content}>

      {/* Vibe label — pulsing dot + text */}
      {data.vibe && <VibePill vibe={data.vibe} accent={accent} />}

      {/* Quick stats row */}
      <View style={styles.quickStats}>
        <QuickStat label="tracks"   value={displayTotal.toLocaleString()} />
        <QuickStat label="artists"  value={data.artistCount.toString()} />
        <QuickStat label="duration" value={durationValue} />
        <QuickStat label="avg pop"  value={`${data.avgPop}`} />
      </View>

      {/* Audio DNA radar chart */}
      {data.audioFeatures && (
        <GlassPanel title="Audio DNA">
          <View style={styles.radarWrap}>
            <RadarChart
              acousticness={data.audioFeatures.acousticness}
              danceability={data.audioFeatures.danceability}
              energy={data.audioFeatures.energy}
              valence={data.audioFeatures.valence}
              instrumentalness={data.audioFeatures.instrumentalness}
              liveness={data.audioFeatures.liveness}
              color={accent}
              size={200}
            />
          </View>
          {/* BPM row beneath radar */}
          <View style={styles.bpmRow}>
            <Text style={styles.bpmLabel}>BPM AVG</Text>
            <Text style={[styles.bpmValue, { color: accent }]}>
              {Math.round(data.audioFeatures.avgTempo)}
            </Text>
          </View>
        </GlassPanel>
      )}

      {/* Micro-Genres */}
      {data.topGenres.length > 0 && (
        <GlassPanel title="Micro-Genres">
          <View style={styles.genreCloud}>
            {data.topGenres.slice(0, 12).map((g, i) => {
              const max  = data.topGenres[0].count
              const pct  = g.count / max
              // alternate accent colors: primary → pink → lavender
              const chipColors = [accent, Colors.pink, Colors.lavender]
              const chipColor  = chipColors[i % chipColors.length]
              return (
                <View
                  key={g.genre}
                  style={[
                    styles.genrePill,
                    {
                      backgroundColor: `${chipColor}14`,
                      borderColor:     `${chipColor}${Math.round(40 + pct * 60).toString(16).padStart(2,'0')}`,
                    },
                  ]}
                >
                  <Text style={[styles.genrePillText, { color: `${chipColor}${Math.round(160 + pct * 95).toString(16).padStart(2,'0')}` }]}>
                    {g.genre}
                  </Text>
                </View>
              )
            })}
          </View>
        </GlassPanel>
      )}

      {/* Top Artists */}
      {data.topArtists.length > 0 && (
        <GlassPanel title="Top Artists">
          {data.topArtists.slice(0, 6).map((artist, i) => (
            <BarRow
              key={artist.id}
              label={artist.name}
              count={artist.count}
              max={data.topArtists[0].count}
              color={accent}
              valueLabel={artist.count === 1 ? '1 track' : `${artist.count} tracks`}
              delay={i * 50}
            />
          ))}
        </GlassPanel>
      )}

      {/* Popularity */}
      {data.popBuckets.some(b => b.count > 0) && (
        <GlassPanel title="Popularity">
          {data.popBuckets.filter(b => b.count > 0).map((b, i) => (
            <BarRow
              key={b.label}
              label={b.label}
              count={b.count}
              max={Math.max(...data.popBuckets.map(x => x.count))}
              color={accent}
              valueLabel={b.count === 1 ? '1 track' : `${b.count} tracks`}
              delay={i * 45}
            />
          ))}
        </GlassPanel>
      )}

      {/* By Decade */}
      {data.decades.length > 0 && (
        <GlassPanel title="By Decade">
          {data.decades.map((d, i) => (
            <BarRow
              key={d.label}
              label={d.label}
              count={d.count}
              max={Math.max(...data.decades.map(x => x.count))}
              color={accent}
              valueLabel={d.count === 1 ? '1 track' : `${d.count} tracks`}
              delay={i * 50}
            />
          ))}
        </GlassPanel>
      )}

    </View>
  )
}

// ─── Vibe Pill ────────────────────────────────────────────────────────────────
function VibePill({ vibe, accent }: { vibe: string; accent: string }) {
  const dotScale   = useSharedValue(1)
  const pillOpacity = useSharedValue(0)
  const pillY       = useSharedValue(10)

  useEffect(() => {
    pillOpacity.value = withDelay(60, withTiming(1, { duration: 320 }))
    pillY.value       = withDelay(60, withSpring(0, Spring.snappy))
    // Pulsing dot
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [])

  const pillStyle = useAnimatedStyle(() => ({
    opacity:   pillOpacity.value,
    transform: [{ translateY: pillY.value }],
  }))
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }))

  return (
    <Animated.View style={[styles.vibePill, { borderColor: `${accent}40`, backgroundColor: `${accent}10` }, pillStyle]}>
      <Animated.View style={[styles.vibeDot, { backgroundColor: accent }, dotStyle]} />
      <Text style={[styles.vibeText, { color: accent }]}>{vibe.toUpperCase()}</Text>
    </Animated.View>
  )
}

// ─── Quick Stat ───────────────────────────────────────────────────────────────
function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.quickStatCard}>
      <View style={styles.quickStatSpecular} />
      <Text
        style={styles.quickStatValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {value}
      </Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
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
function BarRow({ label, count, max, color, valueLabel, delay }: {
  label:      string
  count:      number
  max:        number
  color:      string
  valueLabel: string
  delay:      number
}) {
  const barW = useSharedValue(0)
  const pct  = max > 0 ? count / max : 0
  const BAR_FULL = SW - Spacing.lg * 2 - Spacing['2xl'] * 2 - 130

  useEffect(() => {
    barW.value = withDelay(delay, withSpring(pct * BAR_FULL, { mass: 1, damping: 18, stiffness: 110 }))
  }, [pct])

  const fillStyle = useAnimatedStyle(() => ({ width: barW.value }))

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

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function AnalysisSkeleton({ accent }: { accent: string }) {
  return (
    <View style={styles.content}>
      <Skeleton height={32} width="45%" borderRadius={Radius.full} style={{ marginBottom: Spacing.lg }} />
      <View style={styles.quickStats}>
        {[0,1,2,3].map(i => (
          <Skeleton key={i} height={68} width={(SW - Spacing.lg * 2 - Spacing.sm * 3) / 4} borderRadius={Radius.md} />
        ))}
      </View>
      <Skeleton height={240} width="100%" borderRadius={Radius.xl} style={{ marginTop: Spacing.xl }} />
      <Skeleton height={120} width="100%" borderRadius={Radius.xl} style={{ marginTop: Spacing.md }} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 10,
  },

  // Sheet
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    height:               SHEET_H,
    backgroundColor:      Colors.sheet,
    borderTopLeftRadius:  Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    borderTopWidth:       1,
    borderLeftWidth:      1,
    borderRightWidth:     1,
    borderColor:          Colors.glassBorder,
    zIndex:               11,
    overflow:             'hidden',
  },

  // Drag handle
  handleArea: {
    alignItems:      'center',
    paddingVertical: Spacing.md,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    Radius.full,
    backgroundColor: Colors.glassBorder,
  },

  // ── Hero ──
  hero: {
    height:   HERO_H,
    width:    SW,
    overflow: 'hidden',
  },
  heroCoverWrap: {
    alignSelf:  'center',
    marginTop:  Spacing.xl,
    borderRadius: Radius.xl,
    overflow:   'hidden',
    width:      132,
    height:     132,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  heroCover: {
    width:  132,
    height: 132,
  },
  heroCoverFallback: {
    backgroundColor: Colors.card,
    alignItems:      'center',
    justifyContent:  'center',
  },
  heroCoverEmoji: { fontSize: 36 },
  coverSpecular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: Colors.glassHighlight,
  },
  heroInfo: {
    position: 'absolute',
    bottom:   Spacing.lg,
    left:     Spacing.lg,
    right:    Spacing.lg,
  },
  heroName: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize['2xl'],
    color:         OnDark.text,   // hero sits on the dark blurred-cover gradient
    letterSpacing: -1,
    lineHeight:    FontSize['2xl'] * 1.15,
  },
  heroOwner: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      OnDark.textMuted,
    marginTop:  3,
  },

  // ── Content ──
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.lg,
    gap:               Spacing.md,
  },

  // Vibe pill
  vibePill: {
    alignSelf:         'flex-start',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.sm,
    borderRadius:      Radius.full,
    borderWidth:       1,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.sm,
  },
  vibeDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  vibeText: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.xs,
    letterSpacing: 1.5,
  },

  // Quick stats
  quickStats: {
    flexDirection: 'row',
    gap:           Spacing.sm,
  },
  quickStatCard: {
    flex:            1,
    backgroundColor: Colors.glass,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    overflow:        'hidden',
    alignItems:      'center',
    paddingBottom:   Spacing.sm,
  },
  quickStatSpecular: {
    width:           '100%',
    height:          1,
    backgroundColor: Colors.glassHighlight,
    marginBottom:    Spacing.sm,
  },
  quickStatValue: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      16,
    color:         Colors.text,
    letterSpacing: -0.5,
    alignSelf:     'stretch',
    textAlign:     'center',
    paddingHorizontal: 2,
  },
  quickStatLabel: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },

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
