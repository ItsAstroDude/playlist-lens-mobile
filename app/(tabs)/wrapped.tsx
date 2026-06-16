import React, { useCallback, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { FlashList } from '@shopify/flash-list'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useWrapped } from '@/hooks/useWrapped'
import { fmtHours, type WrappedStats, type NameMs, type TrackStat } from '@/utils/wrapped'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { WrappedItemSheet, type WrappedSelection } from '@/components/wrapped/WrappedItemSheet'
import { AddToQueueButton } from '@/components/queue/AddToQueueButton'
import { TopFade } from '@/components/ui/TopFade'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import type { QueueItem } from '@/utils/queueCart'
import type { ArtKind } from '@/hooks/useArtwork'

const PRIVACY_URL = 'https://www.spotify.com/account/privacy/'

type Block =
  | { t: 'hero'; ms: number; since: string }
  | { t: 'pills'; streams: number; artists: number; tracks: number }
  | { t: 'recaps' }
  | { t: 'list'; key: string; title: string; kind: ArtKind; color: string; rows: Row[] }
  | { t: 'clock'; clock: number[] }
  | { t: 'years'; rows: { year: number; ms: number; topArtist: string; frac: number }[] }
  | { t: 'foot'; real: number; skipPct: number; podcast: number }
  | { t: 'manage' }

interface Row { name: string; sub?: string; value: string; frac: number; sel: WrappedSelection; add?: QueueItem }

// ─── Rows ─────────────────────────────────────────────────────────────────────
// `addItem` (track rows only) renders the queue ＋ as a sibling of the pressable
// body, so tapping it adds to the queue cart without also opening the item sheet.
const BarRow = React.memo(function BarRow({ rank, name, sub, value, frac, color, onPress, addItem }: {
  rank?: number; name: string; sub?: string; value: string; frac: number; color: string; onPress?: () => void; addItem?: QueueItem
}) {
  const body = (
    <View style={styles.barBody}>
      {rank != null && <Text style={styles.barRank}>{rank}</Text>}
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={styles.barName} numberOfLines={1}>{name}{sub ? <Text style={styles.barSub}>  {sub}</Text> : null}</Text>
        <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(2, frac * 100)}%`, backgroundColor: color }]} /></View>
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  )
  return (
    <View style={styles.barRow}>
      {onPress
        ? <TouchableOpacity style={styles.barFlex} onPress={onPress} activeOpacity={0.6}>{body}</TouchableOpacity>
        : <View style={styles.barFlex}>{body}</View>}
      {addItem ? <AddToQueueButton item={addItem} /> : null}
    </View>
  )
})

const Clock = React.memo(function Clock({ clock }: { clock: number[] }) {
  const max = Math.max(...clock, 1)
  const peak = clock.indexOf(max)
  return (
    <View style={styles.card}>
      <View style={styles.cardSpecular} />
      <Text style={styles.sectionLabel}>LISTENING CLOCK</Text>
      <View style={styles.clockRow}>
        {clock.map((ms, h) => (
          <View key={h} style={styles.clockCol}>
            <View style={[styles.clockBar, { height: `${Math.max(3, (ms / max) * 100)}%`, backgroundColor: h === peak ? Colors.greenPrimary : alpha(Colors.greenPrimary, 0.35) }]} />
          </View>
        ))}
      </View>
      <View style={styles.clockLabels}>
        <Text style={styles.clockLabel}>12a</Text><Text style={styles.clockLabel}>6a</Text>
        <Text style={styles.clockLabel}>12p</Text><Text style={styles.clockLabel}>6p</Text><Text style={styles.clockLabel}>11p</Text>
      </View>
      <Text style={styles.clockPeak}>Peak hour: {peak}:00–{peak + 1}:00</Text>
    </View>
  )
})

// ─── Build blocks from stats ──────────────────────────────────────────────────
function buildBlocks(stats: WrappedStats): Block[] {
  const since = stats.firstTs ? new Date(stats.firstTs).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'
  const maxA = stats.topArtists[0]?.ms ?? 1
  const maxT = stats.topTracks[0]?.plays ?? 1
  const maxL = stats.topAlbums[0]?.ms ?? 1
  const maxY = Math.max(...stats.byYear.map(y => y.ms), 1)

  const artistRows: Row[] = stats.topArtists.slice(0, 10).map((a, i) => ({
    name: a.name, value: fmtHours(a.ms), frac: a.ms / maxA,
    sel: { kind: 'artist', name: a.name, rank: i + 1, ms: a.ms, plays: a.plays, accent: Colors.greenPrimary },
  }))
  const trackRows: Row[] = stats.topTracks.slice(0, 10).map((t, i) => ({
    name: t.name, sub: t.artist, value: `${t.plays}×`, frac: t.plays / maxT,
    sel: { kind: 'track', name: t.name, artist: t.artist, rank: i + 1, ms: t.ms, plays: t.plays, accent: Colors.pink },
    add: t.uri ? { uri: t.uri, name: t.name, artist: t.artist } : undefined,   // ＋ to queue (v1.5)
  }))
  const albumRows: Row[] = stats.topAlbums.slice(0, 8).map((a, i) => ({
    name: a.name, value: fmtHours(a.ms), frac: a.ms / maxL,
    sel: { kind: 'album', name: a.name, rank: i + 1, ms: a.ms, accent: Colors.lavender },
  }))

  const blocks: Block[] = [
    { t: 'hero', ms: stats.totalMs, since },
    { t: 'pills', streams: stats.totalStreams, artists: stats.uniqueArtists, tracks: stats.uniqueTracks },
  ]
  blocks.push({ t: 'recaps' })
  if (artistRows.length) blocks.push({ t: 'list', key: 'artists', title: 'TOP ARTISTS · BY TIME', kind: 'artist', color: Colors.greenPrimary, rows: artistRows })
  if (trackRows.length)  blocks.push({ t: 'list', key: 'tracks',  title: 'TOP TRACKS · BY PLAYS', kind: 'track', color: Colors.pink, rows: trackRows })
  if (albumRows.length)  blocks.push({ t: 'list', key: 'albums',  title: 'TOP ALBUMS · BY TIME', kind: 'album', color: Colors.lavender, rows: albumRows })
  blocks.push({ t: 'clock', clock: stats.clock })
  if (stats.byYear.length) blocks.push({ t: 'years', rows: stats.byYear.map(y => ({ year: y.year, ms: y.ms, topArtist: y.topArtist, frac: y.ms / maxY })) })
  const skipPct = stats.totalStreams ? Math.round((stats.skipCount / stats.totalStreams) * 100) : 0
  blocks.push({ t: 'foot', real: stats.realListens, skipPct, podcast: stats.podcastStreams })
  blocks.push({ t: 'manage' })
  return blocks
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WrappedTab() {
  const { stats, status, progress, errorMsg, importHistory, clearHistory } = useWrapped()
  const [sel, setSel] = useState<WrappedSelection | null>(null)
  const gutter = useNowPlayingGutter()
  const scrollY = useSharedValue(0)

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
  const onSelect = useCallback((s: WrappedSelection) => { haptic.light(); setSel(s) }, [])

  const renderBlock = useCallback(({ item }: { item: Block }) => {
    switch (item.t) {
      case 'hero':
        return (
          <View style={styles.heroCard}>
            <View style={styles.cardSpecular} />
            <Text style={styles.heroValue}>{fmtHours(item.ms)}</Text>
            <Text style={styles.heroSub}>of listening since {item.since}</Text>
          </View>
        )
      case 'pills':
        return (
          <View style={styles.statRow}>
            <Pill label="streams" value={item.streams.toLocaleString()} />
            <Pill label="artists" value={item.artists.toLocaleString()} />
            <Pill label="tracks"  value={item.tracks.toLocaleString()} />
          </View>
        )
      case 'recaps':
        return (
          <TouchableOpacity style={styles.recapsBtn} onPress={() => { haptic.light(); router.push('/recaps') }} activeOpacity={0.85}>
            <View style={styles.cardSpecular} />
            <View style={{ flex: 1 }}>
              <Text style={styles.recapsTitle}>Recaps</Text>
              <Text style={styles.recapsSub}>Weekly · monthly · seasonal · yearly</Text>
            </View>
            <Text style={styles.recapsArrow}>→</Text>
          </TouchableOpacity>
        )
      case 'list':
        return (
          <View style={styles.card}>
            <View style={styles.cardSpecular} />
            <Text style={styles.sectionLabel}>{item.title}</Text>
            {item.rows.map((r, i) => (
              <BarRow key={r.name + i} rank={i + 1} name={r.name} sub={r.sub} value={r.value} frac={r.frac} color={item.color} onPress={() => onSelect(r.sel)} addItem={r.add} />
            ))}
          </View>
        )
      case 'clock':
        return <Clock clock={item.clock} />
      case 'years':
        return (
          <View style={styles.card}>
            <View style={styles.cardSpecular} />
            <Text style={styles.sectionLabel}>BY YEAR</Text>
            {item.rows.map(y => (
              <BarRow key={y.year} name={String(y.year)} sub={y.topArtist} value={fmtHours(y.ms)} frac={y.frac} color={Colors.greenPrimary} />
            ))}
          </View>
        )
      case 'foot':
        return (
          <Text style={styles.foot}>
            {item.real.toLocaleString()} full plays (≥30s) · {item.skipPct}% skipped{item.podcast > 0 ? ` · ${item.podcast.toLocaleString()} podcast plays` : ''}
          </Text>
        )
      case 'manage':
        return (
          <View style={styles.manageRow}>
            <TouchableOpacity style={styles.manageBtn} onPress={onImport} activeOpacity={0.75}><Text style={styles.manageBtnText}>Re-import</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.manageBtn, styles.manageBtnDanger]} onPress={onClear} activeOpacity={0.75}><Text style={[styles.manageBtnText, { color: Colors.error }]}>Clear</Text></TouchableOpacity>
          </View>
        )
    }
  }, [onImport, onClear, onSelect])

  const parsing = status === 'parsing'
  const blocks = useMemo(() => (stats ? buildBlocks(stats) : []), [stats])

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.View style={[styles.header, headerStyle]}>
          <Text style={styles.logo}>playlist<Text style={styles.dot}>.</Text>lens</Text>
        </Animated.View>
        <Animated.View style={[styles.titleBlock, headerStyle]}>
          <Text style={styles.title}>wrapped</Text>
          <Text style={styles.sub}>{stats ? 'Your lifetime listening' : 'All-time stats from your Spotify export'}</Text>
        </Animated.View>

        {parsing ? (
          <View style={styles.parsing}>
            <ActivityIndicator size="large" color={Colors.greenPrimary} />
            <Text style={styles.parsingText}>Crunching your history{progress.total ? `  ${progress.done}/${progress.total}` : ''}…</Text>
          </View>
        ) : stats ? (
          <View style={{ flex: 1 }}>
            <FlashList
              data={blocks}
              renderItem={renderBlock}
              keyExtractor={(item, i) => item.t + i}
              getItemType={item => item.t}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 130 + gutter }}
              showsVerticalScrollIndicator={false}
              onScroll={e => { scrollY.value = e.nativeEvent.contentOffset.y }}
              scrollEventThrottle={16}
            />
            <TopFade scrollY={scrollY} />
          </View>
        ) : (
          <View style={styles.scrollPad}>
            <EmptyState onImport={onImport} />
            {status === 'error' && errorMsg && <View style={styles.errorBanner}><Text style={styles.errorText}>{errorMsg}</Text></View>}
          </View>
        )}
      </SafeAreaView>

      <WrappedItemSheet selection={sel} onClose={() => setSel(null)} />
    </View>
  )
}

// ─── Small pieces ─────────────────────────────────────────────────────────────
function Pill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

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
        <Text style={{ color: Colors.text }}>Extended Streaming History</Text> — processed entirely on your device.
      </Text>
      <View style={{ gap: Spacing.sm, marginVertical: Spacing.sm }}>
        <Step n={1}>Open <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Spotify Privacy settings →</Text> and request “Extended streaming history”.</Step>
        <Step n={2}>Wait for Spotify's email (can take a few days), then download the ZIP.</Step>
        <Step n={3}>Tap Import below and pick that ZIP (or its Streaming_History_Audio_*.json files).</Step>
      </View>
      <TouchableOpacity style={styles.importBtn} onPress={onImport} activeOpacity={0.8}><Text style={styles.importBtnText}>Import history</Text></TouchableOpacity>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1, zIndex: 1 },

  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  logo: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, letterSpacing: -1 },
  dot: { color: Colors.greenPrimary },
  titleBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: 3 },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1 },
  sub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 130 },
  scrollPad: { flex: 1, paddingHorizontal: Spacing.lg },

  heroCard: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', paddingVertical: Spacing.xl, alignItems: 'center', gap: 2, marginBottom: Spacing.md },
  heroValue: { fontFamily: FontFamily.syneBold, fontSize: FontSize['4xl'], color: Colors.greenPrimary, letterSpacing: -2 },
  heroSub: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },

  statRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  recapsBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.glass, borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.28), borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, marginBottom: Spacing.md },
  recapsTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  recapsSub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  recapsArrow: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.greenPrimary },
  statPill: { flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: FontFamily.display, fontSize: 16, fontWeight: '700', color: Colors.text, letterSpacing: -0.5, alignSelf: 'stretch', textAlign: 'center' },
  statLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },

  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  cardSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  sectionLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.xs },

  barRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  barFlex: { flex: 1, minWidth: 0 },
  barRank: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 18, textAlign: 'right' },
  barName: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  barSub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  barTrack: { height: 4, backgroundColor: Colors.glass, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  barFill: { height: '100%', borderRadius: 2, opacity: 0.85 },
  barValue: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, minWidth: 52, textAlign: 'right' },

  clockRow: { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 2 },
  clockCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  clockBar: { width: '100%', borderRadius: 2, minHeight: 2 },
  clockLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  clockLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.textMuted },
  clockPeak: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },

  foot: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginVertical: Spacing.xs },
  manageRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  manageBtn: { flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.full, paddingVertical: Spacing.sm, alignItems: 'center' },
  manageBtnDanger: { borderColor: `${Colors.error}40` },
  manageBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary },

  parsing: { alignItems: 'center', paddingTop: Spacing['4xl'], gap: Spacing.lg },
  parsingText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },

  emptyTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  emptyDesc: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: FontSize.sm * 1.6 },
  link: { color: Colors.greenPrimary, textDecorationLine: 'underline' },
  step: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: alpha(Colors.greenPrimary, 0.12), borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.3), alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.greenPrimary },
  stepText: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: FontSize.sm * 1.5 },
  importBtn: { backgroundColor: Colors.greenPrimary, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xs },
  importBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.background },
  errorBanner: { backgroundColor: Colors.errorSubtle, borderWidth: 1, borderColor: `${Colors.error}30`, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  errorText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
})
