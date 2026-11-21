import { setTabBarHidden } from '@/utils/tabBar'
import { useIsCover } from '@/hooks/useScreen'
import React, { useEffect, useRef, useState } from 'react'
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
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, OnDark } from '@/constants/theme'
import { Spring } from '@/constants/animation'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { fmtDuration } from '@/utils/analyze'
import { ensureReadable } from '@/utils/color'
import { Sheet } from '@/components/ui/Sheet'
import { useCollapsingCover } from '@/components/motion/CollapsingCover'
import { Skeleton } from '@/components/ui/Skeleton'
import { RadarChart } from '@/components/ui/RadarChart'
import { WrappedItemSheet, type WrappedSelection } from '@/components/wrapped/WrappedItemSheet'
import { withMemorialMark } from '@/utils/tribute'
import type { SpotifyPlaylist, PlaylistAnalysis, PlaylistPalette } from '@/types'

// Sizes come from the live window (the Flip's cover screen is a different shape from
// the main screen), never from the one the app launched on.
const HERO_H = 260
const SHEET_MAX = 0.9
const COVER = 132

/** Where the sheet's hero cover sits once open (window coordinates) — the target for
 *  the Lenses "card opens into the lens" flight. Sheet top + its grab area + margin. */
export function detailCoverRect() {
  const { width: SW, height: SH } = Dimensions.get('window')
  const grab = Spacing.sm + 4 + Spacing.md + Spacing.sm
  return { x: (SW - COVER) / 2, y: SH * (1 - SHEET_MAX) + grab + Spacing.xl, w: COVER, h: COVER }
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
interface DetailSheetProps {
  playlist: SpotifyPlaylist | null
  palette:  PlaylistPalette | null
  onClose:  () => void
  onGone?:  (id: string) => void
  /** Hide the hero cover while a cover is flying in from the tapped card. */
  coverHidden?: boolean
}

/**
 * The playlist lens: hero + full analysis. A full-height, edge-to-edge design-system
 * Sheet (`bleed`) — swipe the handle, tap the backdrop or press back to close.
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
  // vibe pill / genre chips / bars aren't invisible on near-black covers.
  const accent = ensureReadable(shownPalette?.primary ?? Colors.greenPrimary)
  const cc = useCollapsingCover(HERO_H)

  return (
    <>
      <Sheet open={isOpen} onClose={onClose} bleed maxHeight={SHEET_MAX} zIndex={10}>
        <View style={{ flex: 1 }}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: cover ? 150 : insets.bottom + 96 + gutter }}
          bounces
          onScroll={cc.onScroll}
          scrollEventThrottle={16}
        >
          {/* ── Hero Section (collapses as you scroll) ── */}
          {shown && <HeroSection playlist={shown} palette={shownPalette} cc={cc} coverHidden={coverHidden} />}

          {/* ── Analysis states ── */}
          {status === 'loading' && <AnalysisSkeleton accent={accent} />}

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

          {status === 'success' && data && (
            <AnalysisContent data={data} accent={accent} trackTotal={shown?.tracks.total} onSelectArtist={setSel} />
          )}
        </Animated.ScrollView>
        {/* compact title bar, fades in once the hero has scrolled away */}
        <Animated.View style={[styles.miniBar, cc.bar]} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <Text style={styles.miniBarText} numberOfLines={1}>{shown?.name}</Text>
        </Animated.View>
        </View>
      </Sheet>

      <WrappedItemSheet selection={sel} onClose={() => setSel(null)} />
    </>
  )
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection({ playlist, palette, cc, coverHidden }: { playlist: SpotifyPlaylist; palette: PlaylistPalette | null; cc: ReturnType<typeof useCollapsingCover>; coverHidden: boolean }) {
  const coverUrl = playlist.images?.[0]?.url
  // While a cover is flying in from the tapped card, the hero's own cover and its big
  // backdrop wait; the backdrop then fades in under the landed cover.
  const reveal = useSharedValue(coverHidden ? 0 : 1)
  useEffect(() => { reveal.value = withTiming(coverHidden ? 0 : 1, { duration: coverHidden ? 0 : 380 }) }, [coverHidden])
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }))

  return (
    <View style={styles.hero}>
      {/* Blurred cover background — scrolls at half speed, stretches on overscroll.
          (Its own wrapper fades it in: cc.backdrop sets the transform.) */}
      <Animated.View style={[StyleSheet.absoluteFillObject, revealStyle]}>
        <Animated.View style={[StyleSheet.absoluteFillObject, cc.backdrop]}>
          {coverUrl && (
            <Image
              source={{ uri: coverUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              blurRadius={40}
            />
          )}
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFillObject} />
        </Animated.View>
      </Animated.View>
      <LinearGradient
        colors={['rgba(19,19,21,0.15)', 'rgba(19,19,21,1.0)']}
        locations={[0, 0.85]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Crisp cover art centered */}
      {/* Hidden by an OUTER wrapper: cc.cover animates opacity on the inner view and
          would override a plain opacity there. */}
      <View style={{ alignSelf: 'center', opacity: coverHidden ? 0 : 1 }}>
      <Animated.View style={[styles.heroCoverWrap, cc.cover]}>
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
      </Animated.View>
      </View>

      {/* Playlist info at bottom of hero */}
      <Animated.View style={[styles.heroInfo, cc.title]}>
        <Text style={styles.heroName} numberOfLines={2}>{playlist.name}</Text>
        <Text style={styles.heroOwner}>{playlist.owner.display_name}</Text>
      </Animated.View>
    </View>
  )
}

// ─── Analysis Content ─────────────────────────────────────────────────────────
function AnalysisContent({ data, accent, trackTotal, onSelectArtist }: { data: PlaylistAnalysis; accent: string; trackTotal?: number; onSelectArtist: (s: WrappedSelection) => void }) {
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
              label={withMemorialMark(artist.name)}
              count={artist.count}
              max={data.topArtists[0].count}
              color={accent}
              valueLabel={artist.count === 1 ? '1 track' : `${artist.count} tracks`}
              delay={i * 50}
              onPress={() => onSelectArtist({ kind: 'artist', name: artist.name, rank: i + 1, tracks: artist.count, accent })}
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
      {/* Fixed-height centering box so an auto-shrunk value (e.g. "10h 34m")
          stays vertically aligned with the full-size numbers beside it. */}
      <View style={styles.quickStatValueBox}>
        <Text
          style={styles.quickStatValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {value}
        </Text>
      </View>
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
function AnalysisSkeleton({ accent }: { accent: string }) {
  const { width: SW } = useWindowDimensions()
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
  // Compact bar over the top of the sheet once the hero has scrolled away
  miniBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 48,
    justifyContent: 'center', paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.sheet,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  miniBarText: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text, letterSpacing: -0.3 },

  // ── Hero ──
  hero: {
    height:   HERO_H,
    width:    '100%',
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
  quickStatValueBox: {
    alignSelf:       'stretch',
    height:          22,
    justifyContent:  'center',
  },
  quickStatValue: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      16,
    color:         Colors.text,
    letterSpacing: -0.5,
    alignSelf:     'stretch',
    textAlign:     'center',
    paddingHorizontal:  2,
    includeFontPadding: false,  // Android: drop the extra glyph padding that skews centering
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
