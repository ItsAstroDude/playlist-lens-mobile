import React, { useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useWrapped } from '@/hooks/useWrapped'
import { fmtHours, fmtMinutesShort, type WrappedStats } from '@/utils/wrapped'

const PRIVACY_URL = 'https://www.spotify.com/account/privacy/'

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// ─── Bar row (static width — no animated string width) ────────────────────────
function BarRow({ rank, label, sub, value, frac, color = Colors.greenPrimary }: {
  rank?: number; label: string; sub?: string; value: string; frac: number; color?: string
}) {
  return (
    <View style={styles.barRow}>
      {rank != null && <Text style={styles.barRank}>{rank}</Text>}
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={styles.barName} numberOfLines={1}>{label}{sub ? <Text style={styles.barSub}>  {sub}</Text> : null}</Text>
        <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(2, frac * 100)}%`, backgroundColor: color }]} /></View>
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  )
}

// ─── Listening clock (24 hourly bars) ─────────────────────────────────────────
function Clock({ clock }: { clock: number[] }) {
  const max = Math.max(...clock, 1)
  const peak = clock.indexOf(max)
  return (
    <View style={styles.card}>
      <View style={styles.cardSpecular} />
      <Text style={styles.sectionLabel}>LISTENING CLOCK</Text>
      <View style={styles.clockRow}>
        {clock.map((ms, h) => (
          <View key={h} style={styles.clockCol}>
            <View style={styles.clockBarTrack}>
              <View style={[styles.clockBar, { height: `${Math.max(3, (ms / max) * 100)}%`, backgroundColor: h === peak ? Colors.greenPrimary : 'rgba(83,224,118,0.35)' }]} />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.clockLabels}>
        <Text style={styles.clockLabel}>12a</Text>
        <Text style={styles.clockLabel}>6a</Text>
        <Text style={styles.clockLabel}>12p</Text>
        <Text style={styles.clockLabel}>6p</Text>
        <Text style={styles.clockLabel}>11p</Text>
      </View>
      <Text style={styles.clockPeak}>Peak hour: {peak}:00–{peak + 1}:00</Text>
    </View>
  )
}

// ─── Stats dashboard ──────────────────────────────────────────────────────────
function Dashboard({ stats, onReimport, onClear }: {
  stats: WrappedStats; onReimport: () => void; onClear: () => void
}) {
  const since = stats.firstTs ? new Date(stats.firstTs) : null
  const sinceLabel = since ? since.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'
  const maxArtist = stats.topArtists[0]?.ms ?? 1
  const maxTrack  = stats.topTracks[0]?.plays ?? 1
  const maxAlbum  = stats.topAlbums[0]?.ms ?? 1
  const maxYear   = Math.max(...stats.byYear.map(y => y.ms), 1)
  const skipPct   = stats.totalStreams ? Math.round((stats.skipCount / stats.totalStreams) * 100) : 0

  return (
    <>
      {/* Hero total */}
      <View style={styles.heroCard}>
        <View style={styles.cardSpecular} />
        <Text style={styles.heroValue}>{fmtHours(stats.totalMs)}</Text>
        <Text style={styles.heroSub}>of listening since {sinceLabel}</Text>
      </View>

      {/* Stat pills */}
      <View style={styles.statRow}>
        <StatPill label="streams" value={stats.totalStreams.toLocaleString()} />
        <StatPill label="artists" value={stats.uniqueArtists.toLocaleString()} />
        <StatPill label="tracks"  value={stats.uniqueTracks.toLocaleString()} />
      </View>

      {/* Top artists by time */}
      {stats.topArtists.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardSpecular} />
          <Text style={styles.sectionLabel}>TOP ARTISTS · BY TIME</Text>
          {stats.topArtists.slice(0, 10).map((a, i) => (
            <BarRow key={a.name + i} rank={i + 1} label={a.name} value={fmtHours(a.ms)} frac={a.ms / maxArtist} />
          ))}
        </View>
      )}

      {/* Top tracks by plays */}
      {stats.topTracks.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardSpecular} />
          <Text style={styles.sectionLabel}>TOP TRACKS · BY PLAYS</Text>
          {stats.topTracks.slice(0, 10).map((t, i) => (
            <BarRow key={t.name + i} rank={i + 1} label={t.name} sub={t.artist} value={`${t.plays}×`} frac={t.plays / maxTrack} color={Colors.pink} />
          ))}
        </View>
      )}

      {/* Top albums by time */}
      {stats.topAlbums.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardSpecular} />
          <Text style={styles.sectionLabel}>TOP ALBUMS · BY TIME</Text>
          {stats.topAlbums.slice(0, 8).map((a, i) => (
            <BarRow key={a.name + i} rank={i + 1} label={a.name} value={fmtHours(a.ms)} frac={a.ms / maxAlbum} color={Colors.lavender} />
          ))}
        </View>
      )}

      {/* Listening clock */}
      <Clock clock={stats.clock} />

      {/* By year */}
      {stats.byYear.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardSpecular} />
          <Text style={styles.sectionLabel}>BY YEAR</Text>
          {stats.byYear.map(y => (
            <BarRow key={y.year} label={String(y.year)} sub={y.topArtist} value={fmtHours(y.ms)} frac={y.ms / maxYear} />
          ))}
        </View>
      )}

      {/* Footnote */}
      <Text style={styles.foot}>
        {stats.realListens.toLocaleString()} full plays (≥30s) · {skipPct}% skipped
        {stats.podcastStreams > 0 ? ` · ${stats.podcastStreams.toLocaleString()} podcast plays` : ''}
      </Text>

      {/* Manage */}
      <View style={styles.manageRow}>
        <TouchableOpacity style={styles.manageBtn} onPress={onReimport} activeOpacity={0.75}>
          <Text style={styles.manageBtnText}>Re-import</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.manageBtn, styles.manageBtnDanger]} onPress={onClear} activeOpacity={0.75}>
          <Text style={[styles.manageBtnText, { color: Colors.error }]}>Clear</Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

// ─── Empty state (how to import) ──────────────────────────────────────────────
function EmptyState({ onImport }: { onImport: () => void }) {
  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepText}>{children}</Text>
    </View>
  )
  return (
    <View style={styles.card}>
      <View style={styles.cardSpecular} />
      <Text style={styles.emptyTitle}>Import your lifetime history</Text>
      <Text style={styles.emptyDesc}>
        Spotify's API only knows the last year. For your all-time stats, import your{' '}
        <Text style={{ color: Colors.text }}>Extended Streaming History</Text> — it's processed entirely on your device.
      </Text>
      <View style={{ gap: Spacing.sm, marginVertical: Spacing.sm }}>
        <Step n={1}>
          Open <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Spotify Privacy settings →</Text> and request “Extended streaming history”.
        </Step>
        <Step n={2}>Wait for Spotify's email (can take a few days), then download the ZIP.</Step>
        <Step n={3}>Tap Import below and pick that ZIP (or its Streaming_History_Audio_*.json files).</Step>
      </View>
      <TouchableOpacity style={styles.importBtn} onPress={onImport} activeOpacity={0.8}>
        <Text style={styles.importBtnText}>Import history</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WrappedTab() {
  const { stats, status, progress, errorMsg, importHistory, clearHistory } = useWrapped()

  const headerY = useSharedValue(12); const headerO = useSharedValue(0)
  React.useEffect(() => {
    headerY.value = withDelay(60, withSpring(0, Spring.entrance))
    headerO.value = withDelay(60, withTiming(1, { duration: 360 }))
  }, [])
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: headerY.value }], opacity: headerO.value }))

  const onImport = useCallback(() => { haptic.medium(); importHistory() }, [importHistory])
  const onClear  = useCallback(() => {
    Alert.alert('Clear history?', 'Removes your imported listening stats. You can re-import anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { haptic.warning(); clearHistory() } },
    ])
  }, [clearHistory])

  const parsing = status === 'parsing'

  return (
    <View style={styles.container}>
      <View style={styles.ambientViolet} pointerEvents="none" />
      <View style={styles.ambientPink}   pointerEvents="none" />
      <LinearGradient colors={[Colors.auroraTop, Colors.auroraBot]} style={styles.aurora} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.View style={[styles.header, headerStyle]}>
          <Text style={styles.logo}>playlist<Text style={styles.dot}>.</Text>lens</Text>
        </Animated.View>
        <Animated.View style={[styles.titleBlock, headerStyle]}>
          <Text style={styles.title}>wrapped</Text>
          <Text style={styles.sub}>
            {stats ? 'Your lifetime listening' : 'All-time stats from your Spotify export'}
          </Text>
        </Animated.View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {parsing ? (
            <View style={styles.parsing}>
              <ActivityIndicator size="large" color={Colors.greenPrimary} />
              <Text style={styles.parsingText}>
                Crunching your history{progress.total ? `  ${progress.done}/${progress.total}` : ''}…
              </Text>
            </View>
          ) : stats ? (
            <Dashboard stats={stats} onReimport={onImport} onClear={onClear} />
          ) : (
            <EmptyState onImport={onImport} />
          )}

          {status === 'error' && errorMsg && (
            <View style={styles.errorBanner}><Text style={styles.errorText}>{errorMsg}</Text></View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  ambientViolet: { position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.violetGlow },
  ambientPink:   { position: 'absolute', bottom: -100, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: Colors.pinkGlow },
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  safe: { flex: 1, zIndex: 1 },

  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  logo: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, letterSpacing: -1 },
  dot: { color: Colors.greenPrimary },
  titleBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: 3 },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1 },
  sub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },

  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 130, gap: Spacing.md },

  // hero
  heroCard: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', paddingVertical: Spacing.xl, alignItems: 'center', gap: 2 },
  heroValue: { fontFamily: FontFamily.syneBold, fontSize: FontSize['4xl'], color: Colors.greenPrimary, letterSpacing: -2 },
  heroSub: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },

  statRow: { flexDirection: 'row', gap: Spacing.sm },
  statPill: { flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: FontFamily.display, fontSize: 16, fontWeight: '700', color: Colors.text, letterSpacing: -0.5, alignSelf: 'stretch', textAlign: 'center' },
  statLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },

  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.sm },
  cardSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  sectionLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.xs },

  // bars
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 3 },
  barRank: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 18, textAlign: 'right' },
  barName: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  barSub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  barTrack: { height: 4, backgroundColor: Colors.glass, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  barFill: { height: '100%', borderRadius: 2, opacity: 0.8 },
  barValue: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, minWidth: 52, textAlign: 'right' },

  // clock
  clockRow: { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 2 },
  clockCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  clockBarTrack: { height: '100%', justifyContent: 'flex-end' },
  clockBar: { width: '100%', borderRadius: 2, minHeight: 2 },
  clockLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  clockLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.textMuted },
  clockPeak: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },

  foot: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs },

  manageRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  manageBtn: { flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.full, paddingVertical: Spacing.sm, alignItems: 'center' },
  manageBtnDanger: { borderColor: `${Colors.error}40` },
  manageBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary },

  // parsing
  parsing: { alignItems: 'center', paddingTop: Spacing['4xl'], gap: Spacing.lg },
  parsingText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },

  // empty
  emptyTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  emptyDesc: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: FontSize.sm * 1.6 },
  link: { color: Colors.greenPrimary, textDecorationLine: 'underline' },
  step: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(83,224,118,0.12)', borderWidth: 1, borderColor: 'rgba(83,224,118,0.3)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.greenPrimary },
  stepText: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: FontSize.sm * 1.5 },
  importBtn: { backgroundColor: Colors.greenPrimary, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xs },
  importBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.background },

  errorBanner: { backgroundColor: Colors.errorSubtle, borderWidth: 1, borderColor: `${Colors.error}30`, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  errorText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
})
