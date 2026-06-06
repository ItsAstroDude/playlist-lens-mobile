import React, { useEffect, useCallback, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay,
  withTiming, withRepeat, Easing,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useTasteProfile } from '@/hooks/useTasteProfile'
import { usePlaylists } from '@/hooks/useSpotify'
import { RadarChart } from '@/components/ui/RadarChart'
import { vibeColor } from '@/utils/color'
import type { TasteProfile } from '@/types'

// ─── Sub-components ───────────────────────────────────────────────────────────

function VibePill({ vibe }: { vibe: string }) {
  const color = vibeColor(vibe)
  const pulse = useSharedValue(1)
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.35, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    )
  }, [])
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  return (
    <View style={[vibe_styles.pill, { backgroundColor: `${color}14`, borderColor: `${color}40` }]}>
      <Animated.View style={[vibe_styles.dot, dotStyle, { backgroundColor: color }]} />
      <Text style={[vibe_styles.text, { color }]}>{vibe}</Text>
    </View>
  )
}
const vibe_styles = StyleSheet.create({
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.sm,
    alignSelf:         'center',
    backgroundColor:   Colors.greenSubtle,
    borderWidth:       1,
    borderColor:       'rgba(83,224,118,0.25)',
    borderRadius:      Radius.full,
    paddingVertical:   Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.greenPrimary,
  },
  text: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.greenPrimary,
  },
})

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={stat_styles.pill}>
      <Text style={stat_styles.value}>{value}</Text>
      <Text style={stat_styles.label}>{label}</Text>
    </View>
  )
}
const stat_styles = StyleSheet.create({
  pill: {
    flex:              1,
    backgroundColor:   Colors.glass,
    borderWidth:       1,
    borderColor:       Colors.glassBorder,
    borderRadius:      Radius.md,
    paddingVertical:   Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems:        'center',
    gap:               2,
  },
  value: {
    fontFamily:    FontFamily.display,
    fontSize:      FontSize.md,
    fontWeight:    '700',
    color:         Colors.text,
    letterSpacing: -0.5,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
})

// ─── Share teaser ─────────────────────────────────────────────────────────────
// Code generation + sharing lives on the Share tab (single source of truth).
// The taste tab just surfaces the code (if any) and points there.
function ShareTeaser({ code, onPress }: { code: string | null; onPress: () => void }) {
  return (
    <TouchableOpacity style={share_styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={share_styles.specular} />
      <Text style={share_styles.heading}>SHARE YOUR TASTE</Text>
      {code ? (
        <View style={share_styles.codeBox}>
          <Text style={share_styles.codeText}>{code}</Text>
        </View>
      ) : (
        <Text style={share_styles.desc}>
          Create a code on the Share tab so friends can view your taste profile.
        </Text>
      )}
      <Text style={share_styles.cta}>Open Share tab  →</Text>
    </TouchableOpacity>
  )
}
const share_styles = StyleSheet.create({
  card: {
    backgroundColor:  Colors.glass,
    borderWidth:      1,
    borderColor:      Colors.glassBorder,
    borderRadius:     Radius.xl,
    overflow:         'hidden',
    padding:          Spacing.lg,
    gap:              Spacing.md,
    alignItems:       'center',
  },
  specular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: Colors.glassHighlight,
  },
  heading: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  codeBox: {
    backgroundColor:   'rgba(83,224,118,0.08)',
    borderWidth:       1,
    borderColor:       'rgba(83,224,118,0.25)',
    borderRadius:      Radius.md,
    paddingVertical:   Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
  },
  codeText: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      28,
    color:         Colors.greenPrimary,
    letterSpacing: 6,
  },
  hint: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
    textAlign:  'center',
  },
  desc: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: FontSize.sm * 1.6,
  },
  cta: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
    color:      Colors.greenPrimary,
  },
  btn: {
    backgroundColor: Colors.greenPrimary,
    borderRadius:    Radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
    alignItems:      'center',
    minWidth:        160,
    minHeight:       36,
    justifyContent:  'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
    color:      Colors.background,
  },
})

// ─── Artist row ───────────────────────────────────────────────────────────────
function ArtistBar({ name, count, maxCount, rank }: {
  name: string; count: number; maxCount: number; rank: number
}) {
  const w      = useSharedValue(0)
  const frac   = count / Math.max(maxCount, 1)
  const barStyle = useAnimatedStyle(() => ({ width: `${w.value}%` as any }))

  useEffect(() => {
    w.value = withDelay(rank * 60, withSpring(frac * 100, { mass: 1, damping: 20, stiffness: 100 }))
  }, [frac])

  return (
    <View style={artist_styles.row}>
      <Text style={artist_styles.rank}>{rank}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={artist_styles.name} numberOfLines={1}>{name}</Text>
        <View style={artist_styles.track}>
          <Animated.View style={[artist_styles.fill, barStyle]} />
        </View>
      </View>
      <Text style={artist_styles.count}>{count}</Text>
    </View>
  )
}
const artist_styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 3 },
  rank:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 16, textAlign: 'right' },
  name:  { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  track: { height: 3, backgroundColor: Colors.glass, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  fill:  { height: '100%', backgroundColor: Colors.greenPrimary, borderRadius: 2, opacity: 0.7 },
  count: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 28, textAlign: 'right' },
})

// ─── Profile view ─────────────────────────────────────────────────────────────
function ProfileContent({
  profile, shareCode, onOpenShare,
}: {
  profile:     TasteProfile
  shareCode:   string | null
  onOpenShare: () => void
}) {
  const maxArtistCount = profile.topArtists[0]?.count ?? 1
  const genreAccents   = [Colors.greenPrimary, Colors.pink, Colors.lavender]
  // True distinct-artist count (older cached profiles fall back to the list).
  const artistCount    = profile.artistCount ?? profile.topArtists.length

  return (
    <>
      {/* Stat pills */}
      <View style={styles.statRow}>
        <StatPill value={profile.playlistCount.toString()} label="lenses" />
        <StatPill value={profile.trackCount.toLocaleString()} label="tracks" />
        <StatPill value={artistCount.toLocaleString()} label="artists" />
      </View>

      {/* Vibe */}
      {profile.vibe && <VibePill vibe={profile.vibe} />}

      {/* Radar chart */}
      {profile.af && (
        <View style={styles.radarWrap}>
          <View style={styles.card}>
            <View style={styles.cardSpecular} />
            <Text style={styles.sectionLabel}>AUDIO FINGERPRINT</Text>
            <View style={{ alignItems: 'center' }}>
              <RadarChart
                acousticness={profile.af.acousticness}
                danceability={profile.af.danceability}
                energy={profile.af.energy}
                valence={profile.af.valence}
                instrumentalness={profile.af.instrumentalness}
                liveness={profile.af.liveness}
                color={Colors.greenPrimary}
                size={200}
              />
            </View>
            {profile.af.avgTempo > 0 && (
              <Text style={styles.bpmText}>
                {Math.round(profile.af.avgTempo)} BPM avg
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Genre cloud */}
      {profile.topGenres.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardSpecular} />
          <Text style={styles.sectionLabel}>TOP GENRES</Text>
          <View style={styles.genreCloud}>
            {profile.topGenres.map((g, i) => (
              <View
                key={g.genre}
                style={[
                  styles.genrePill,
                  { borderColor: `${genreAccents[i % 3]}30` },
                ]}
              >
                <Text style={[styles.genreText, { color: genreAccents[i % 3] }]}>
                  {g.genre}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Top artists */}
      {profile.topArtists.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardSpecular} />
          <Text style={styles.sectionLabel}>CORE ARCHITECTS</Text>
          {profile.topArtists.slice(0, 10).map((a, i) => (
            <ArtistBar
              key={a.id}
              rank={i + 1}
              name={a.name}
              count={a.count}
              maxCount={maxArtistCount}
            />
          ))}
        </View>
      )}

      {/* Share teaser → links to the Share tab */}
      <ShareTeaser code={shareCode} onPress={onOpenShare} />
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>◎</Text>
      <Text style={styles.emptyTitle}>No data yet</Text>
      <Text style={styles.emptyDesc}>
        Open some playlists in the Lenses tab to build{'\n'}your taste profile.
      </Text>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ProfileTab() {
  const { fetch: fetchPlaylists, data: playlists } = usePlaylists()
  const {
    profile, shareCode, status, errorMsg, scanProgress,
    buildFromCache, scanAll,
  } = useTasteProfile()

  const [scanBtnVisible, setScanBtnVisible] = useState(false)

  // Entrance animation
  const headerY       = useSharedValue(12)
  const headerOpacity = useSharedValue(0)
  useEffect(() => {
    headerY.value       = withDelay(60, withSpring(0, Spring.entrance))
    headerOpacity.value = withDelay(60, withTiming(1, { duration: 360 }))
  }, [])
  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerY.value }],
    opacity:   headerOpacity.value,
  }))

  // Build profile from cache on mount, fetch playlists to know uncached count
  useEffect(() => {
    buildFromCache()
    fetchPlaylists().then(pls => {
      if (pls && pls.length > 0) setScanBtnVisible(true)
    })
  }, [])

  // How many playlists haven't been analyzed yet
  const uncachedCount = useMemo(() => {
    if (!playlists || !profile) return playlists?.length ?? 0
    return Math.max(0, playlists.length - profile.playlistCount)
  }, [playlists, profile])

  const handleScanAll = useCallback(async () => {
    if (!playlists) return
    haptic.medium()
    await scanAll(playlists)
  }, [playlists, scanAll])

  const handleOpenShare = useCallback(() => {
    haptic.light()
    router.push('/(tabs)/friends')
  }, [])

  const isScanning = status === 'scanning'

  return (
    <View style={styles.container}>
      {/* Ambient glows */}
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
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <Text style={styles.logo}>
            playlist<Text style={styles.dot}>.</Text>lens
          </Text>
        </Animated.View>

        <Animated.View style={[styles.titleBlock, headerStyle]}>
          <Text style={styles.title}>taste</Text>
          <Text style={styles.sub}>
            {profile
              ? `Aggregated from ${profile.playlistCount} playlist${profile.playlistCount !== 1 ? 's' : ''}`
              : 'Your sonic identity across all playlists'}
          </Text>
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Scan progress */}
          {isScanning && (
            <View style={styles.scanBanner}>
              <ActivityIndicator size="small" color={Colors.greenPrimary} />
              <Text style={styles.scanText}>
                Scanning {scanProgress.done}/{scanProgress.total} playlists…
              </Text>
            </View>
          )}

          {/* Error */}
          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Main content or empty state */}
          {profile ? (
            <ProfileContent
              profile={profile}
              shareCode={shareCode}
              onOpenShare={handleOpenShare}
            />
          ) : !isScanning ? (
            <EmptyState />
          ) : null}

          {/* Scan more button */}
          {!isScanning && scanBtnVisible && uncachedCount > 0 && (
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={handleScanAll}
              activeOpacity={0.75}
            >
              <Text style={styles.scanBtnText}>
                ⟳  Scan {uncachedCount} more playlist{uncachedCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  ambientViolet: {
    position:        'absolute',
    top:             -80,
    left:            -80,
    width:           300,
    height:          300,
    borderRadius:    150,
    backgroundColor: Colors.violetGlow,
  },
  ambientPink: {
    position:        'absolute',
    bottom:          -100,
    right:           -80,
    width:           260,
    height:          260,
    borderRadius:    130,
    backgroundColor: Colors.pinkGlow,
  },
  aurora: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    height:   200,
  },
  safe: {
    flex:   1,
    zIndex: 1,
  },

  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.sm,
    paddingBottom:     Spacing.xs,
  },
  logo: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize.xl,
    color:         Colors.text,
    letterSpacing: -1,
  },
  dot: { color: Colors.greenPrimary },

  titleBlock: {
    paddingHorizontal: Spacing.lg,
    paddingBottom:     Spacing.lg,
    gap:               3,
  },
  title: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize['2xl'],
    color:         Colors.text,
    letterSpacing: -1,
  },
  sub: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom:     140,
    gap:               Spacing.md,
  },

  statRow: {
    flexDirection: 'row',
    gap:           Spacing.sm,
  },

  radarWrap: {},

  card: {
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    borderRadius:    Radius.xl,
    overflow:        'hidden',
    padding:         Spacing.lg,
    gap:             Spacing.sm,
  },
  cardSpecular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: Colors.glassHighlight,
  },
  sectionLabel: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom:  Spacing.xs,
  },
  bpmText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
    textAlign:  'center',
    marginTop:  Spacing.xs,
  },

  genreCloud: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
  },
  genrePill: {
    borderWidth:       1,
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   3,
    backgroundColor:   Colors.glass,
  },
  genreText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
  },

  scanBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing.sm,
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  scanText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.textMuted,
  },

  errorBanner: {
    backgroundColor: Colors.errorSubtle,
    borderWidth:     1,
    borderColor:     `${Colors.error}30`,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
  },
  errorText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.error,
    textAlign:  'center',
  },

  scanBtn: {
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     'rgba(83,224,118,0.2)',
    borderRadius:    Radius.full,
    paddingVertical: Spacing.sm,
    alignItems:      'center',
    marginTop:       Spacing.xs,
  },
  scanBtnText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.greenPrimary,
  },

  emptyWrap: {
    alignItems:   'center',
    paddingTop:   Spacing['4xl'],
    gap:          Spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
    color:    Colors.glassBorder,
  },
  emptyTitle: {
    fontFamily:    FontFamily.display,
    fontSize:      FontSize.xl,
    color:         Colors.textSecondary,
    letterSpacing: -0.5,
  },
  emptyDesc: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: FontSize.sm * 1.7,
  },
})
