import React, { useCallback, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { FlashList } from '@shopify/flash-list'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useWrapped } from '@/hooks/useWrapped'
import { fmtHours, fmtMinutesShort, type WrappedStats, type StreamRow } from '@/utils/wrapped'
import { comparePeriods, periodTitle, bucketLabels, periodRange, type SummaryKind, type PeriodComparison } from '@/utils/listening'
import { loadBuffer } from '@/utils/recents'
import { trackingEnrolled } from '@/utils/tracking'
import { Chip, Stat, EmptyState as DSEmptyState, ListRow, Card, TabHeader, RankRow } from '@/components/ui'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { WrappedItemSheet, type WrappedSelection } from '@/components/wrapped/WrappedItemSheet'
import { AddToQueueButton } from '@/components/queue/AddToQueueButton'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import type { QueueItem } from '@/utils/queueCart'
import { confirmDialog } from '@/utils/dialog'
import type { ArtKind } from '@/hooks/useArtwork'
import { Icon } from '@/components/ui/Icon'
import { useLoadTime, useRenderStart } from '@/utils/perf'
import { RollingNumber, RackFocus, LiquidFill } from '@/components/motion'

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
  // ── Period views (v1.8): this week / month / year from the play buffer ──
  | { t: 'pHero'; kind: SummaryKind; title: string; ms: number; delta: number | null }
  | { t: 'pTiles'; plays: number; playsDelta: number | null; artists: number; tracks: number }
  | { t: 'pBars'; kind: SummaryKind; buckets: number[]; labels: string[]; current: number }
  | { t: 'pEmpty'; kind: SummaryKind; tracked: boolean }
  | { t: 'pCta' }
  | { t: 'pStory'; kind: SummaryKind }

interface Row { name: string; sub?: string; value: string; frac: number; sel: WrappedSelection; add?: QueueItem }

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

// ─── Period blocks (week / month / year) ─────────────────────────────────────
type Mode = SummaryKind | 'all'
const MODES: { id: Mode; label: string }[] = [
  { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }, { id: 'all', label: 'All time' },
]
const PERIOD_WORD: Record<SummaryKind, string> = { week: 'week', month: 'month', year: 'year' }
const fmtPeriod = (kind: SummaryKind, ms: number) => (kind === 'year' ? fmtHours(ms) : fmtMinutesShort(ms))

function buildPeriodBlocks(c: PeriodComparison, tracked: boolean, now: Date): Block[] {
  const s = c.current
  const kind = s.kind
  const blocks: Block[] = [{ t: 'pHero', kind, title: periodTitle(s), ms: s.ms, delta: c.deltaMs }]
  if (!s.plays) {
    blocks.push({ t: 'pEmpty', kind, tracked })
    blocks.push({ t: 'recaps' })
    return blocks
  }
  const today = kind === 'year' ? now.getUTCMonth() : Math.floor((now.getTime() - periodRange(kind, now).start) / 86_400_000)
  blocks.push({ t: 'pStory', kind })
  blocks.push({ t: 'pTiles', plays: s.plays, playsDelta: c.deltaPlays, artists: s.artists, tracks: s.tracks })
  blocks.push({ t: 'pBars', kind, buckets: s.buckets, labels: bucketLabels(s), current: today })

  const maxA = s.topArtists[0]?.ms || 1
  const maxT = s.topTracks[0]?.plays || 1
  const maxL = s.topAlbums[0]?.ms || 1
  if (s.topArtists.length) blocks.push({ t: 'list', key: 'p-artists', title: 'TOP ARTISTS', kind: 'artist', color: Colors.greenPrimary,
    rows: s.topArtists.map((a, i) => ({ name: a.name, value: fmtPeriod(kind, a.ms), frac: a.ms / maxA,
      sel: { kind: 'artist', name: a.name, rank: i + 1, ms: a.ms, plays: a.plays, accent: Colors.greenPrimary } })) })
  if (s.topTracks.length) blocks.push({ t: 'list', key: 'p-tracks', title: 'TOP TRACKS', kind: 'track', color: Colors.pink,
    rows: s.topTracks.map((t, i) => ({ name: t.name, sub: t.sub, value: `${t.plays}×`, frac: t.plays / maxT,
      sel: { kind: 'track', name: t.name, artist: t.sub ?? '', rank: i + 1, ms: t.ms, plays: t.plays, accent: Colors.pink },
      add: t.uri ? { uri: t.uri, name: t.name, artist: t.sub ?? '' } : undefined })) })
  if (s.topAlbums.length) blocks.push({ t: 'list', key: 'p-albums', title: 'TOP ALBUMS', kind: 'album', color: Colors.lavender,
    rows: s.topAlbums.map((a, i) => ({ name: a.name, sub: a.sub, value: fmtPeriod(kind, a.ms), frac: a.ms / maxL,
      sel: { kind: 'album', name: a.name, rank: i + 1, ms: a.ms, accent: Colors.lavender } })) })
  blocks.push({ t: 'recaps' })
  if (!tracked) blocks.push({ t: 'pCta' })
  return blocks
}

const Bars = React.memo(function Bars({ buckets, labels, current, kind }: { buckets: number[]; labels: string[]; current: number; kind: SummaryKind }) {
  const max = Math.max(...buckets, 1)
  return (
    <Card padded style={styles.block}>
      <Text style={styles.sectionLabel}>{kind === 'year' ? 'BY MONTH' : 'BY DAY'}</Text>
      <View style={styles.clockRow} accessible accessibilityLabel={`Listening ${kind === 'year' ? 'by month' : 'by day'}`}>
        {buckets.map((ms, i) => (
          <View key={i} style={styles.clockCol}>
            <View style={[styles.clockBar, {
              height: `${Math.max(3, (ms / max) * 100)}%`,
              backgroundColor: i === current ? Colors.greenPrimary : alpha(Colors.greenPrimary, i > current ? 0.12 : 0.4),
            }]} />
          </View>
        ))}
      </View>
      <View style={styles.bucketLabels}>
        {labels.map((l, i) => <Text key={i} style={[styles.clockLabel, styles.bucketLabel, i === current && { color: Colors.greenPrimary }]}>{l}</Text>)}
      </View>
    </Card>
  )
})

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WrappedTab() {
  const t0 = useRenderStart()
  const { stats, status, progress, errorMsg, importHistory, clearHistory } = useWrapped()
  const [sel, setSel] = useState<WrappedSelection | null>(null)

  // Play buffer (tracked + device + import tail) — re-read whenever the tab is
  // focused, since background sync keeps adding to it.
  const [rows, setRows]       = useState<StreamRow[]>(() => loadBuffer())
  const [tracked, setTracked] = useState(trackingEnrolled())
  useFocusEffect(useCallback(() => { setRows(loadBuffer()); setTracked(trackingEnrolled()) }, []))
  const [mode, setMode] = useState<Mode>('week')
  // No recent plays at all but a lifetime import → open on All time instead of an
  // empty week (stats load a tick after mount, so decide once they arrive).
  const pickedMode = React.useRef(false)
  React.useEffect(() => {
    if (pickedMode.current || !stats) return
    pickedMode.current = true
    if (rows.length === 0) setMode('all')
  }, [stats, rows.length])
  const chooseMode = useCallback((m: Mode) => { pickedMode.current = true; setMode(m) }, [])
  const now = useMemo(() => new Date(), [rows, mode])
  const comparison = useMemo(() => (mode === 'all' ? null : comparePeriods(rows, mode, now)), [rows, mode, now])
  const gutter = useNowPlayingGutter()
  const scrollY = useSharedValue(0)


  const onImport = useCallback(() => { haptic.medium(); importHistory() }, [importHistory])
  const onClear  = useCallback(() => {
    confirmDialog({
      glyph: 'trash-outline', destructive: true, confirmLabel: 'Clear',
      title: 'Clear history?',
      message: 'Removes your imported listening stats. You can re-import anytime.',
      onConfirm: clearHistory,
    })
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
            <Icon name="arrow-forward" style={styles.recapsArrow} />
          </TouchableOpacity>
        )
      case 'list':
        return (
          <View style={styles.card}>
            <View style={styles.cardSpecular} />
            <Text style={styles.sectionLabel}>{item.title}</Text>
            {item.rows.map((r, i) => (
              <RackFocus key={r.name + i} index={Math.min(i, 8)} step={70}>
                <RankRow rank={i + 1} name={r.name} sub={r.sub} value={r.value} frac={r.frac} color={item.color} onPress={() => onSelect(r.sel)} trailing={r.add ? <AddToQueueButton item={r.add} /> : undefined} />
              </RackFocus>
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
              <RankRow key={y.year} name={String(y.year)} sub={y.topArtist} value={fmtHours(y.ms)} frac={y.frac} color={Colors.greenPrimary} />
            ))}
          </View>
        )
      case 'foot':
        return (
          <Text style={styles.foot}>
            {item.real.toLocaleString()} full plays (≥30s) · {item.skipPct}% skipped{item.podcast > 0 ? ` · ${item.podcast.toLocaleString()} podcast plays` : ''}
          </Text>
        )
      case 'pHero':
        return (
          <Card tone="accent" padded style={styles.block}>
            <Text style={styles.sectionLabel}>{item.title}</Text>
            <RollingNumber value={fmtPeriod(item.kind, item.ms)} style={styles.pHeroValue} containerStyle={{ marginTop: Spacing.xs }} />
            <Text style={Type.caption}>
              {item.delta === null
                ? `listened this ${PERIOD_WORD[item.kind]}`
                : `${item.delta >= 0 ? '+' : ''}${item.delta}% vs last ${PERIOD_WORD[item.kind]} at this point`}
            </Text>
          </Card>
        )
      case 'pStory':
        return (
          <Card tone="accent" style={styles.block}>
            <ListRow icon="play" label={`Play your ${PERIOD_WORD[item.kind]}`} hint="As a story: top artist, on repeat, your biggest day"
              onPress={() => { haptic.medium(); router.push(`/story?kind=${item.kind}`) }} last />
          </Card>
        )
      case 'pTiles':
        return (
          <Card padded style={[styles.block, styles.tiles]}>
            <Stat value={item.plays.toLocaleString()} label="plays" delta={item.playsDelta} style={{ flex: 1 }} />
            <Stat value={item.artists.toLocaleString()} label="artists" style={{ flex: 1 }} />
            <Stat value={item.tracks.toLocaleString()} label="tracks" style={{ flex: 1 }} />
          </Card>
        )
      case 'pBars':
        return <Bars buckets={item.buckets} labels={item.labels} current={item.current} kind={item.kind} />
      case 'pEmpty':
        return (
          <Card style={styles.block}>
            <DSEmptyState
              icon="pulse"
              title={`No plays this ${PERIOD_WORD[item.kind]} yet`}
              body={item.tracked
                ? 'Listening tracking is on — plays show up here within the hour after you listen.'
                : 'Turn on listening tracking so every play is saved, even when the app is closed.'}
              actionLabel={item.tracked ? undefined : 'Turn on tracking'}
              onAction={item.tracked ? undefined : () => router.push('/settings')}
            />
          </Card>
        )
      case 'pCta':
        return (
          <Card style={styles.block}>
            <ListRow icon="pulse" label="Turn on listening tracking"
              hint="Spotify only remembers your last 50 plays — tracking saves every one, hourly"
              onPress={() => { haptic.light(); router.push('/settings') }} last />
          </Card>
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
  const blocks = useMemo(
    () => (comparison ? buildPeriodBlocks(comparison, tracked, now) : stats ? buildBlocks(stats) : []),
    [comparison, tracked, now, stats],
  )
  // Content on screen: a period view, lifetime stats, or the settled empty state.
  useLoadTime('wrapped', t0, !parsing && (blocks.length > 0 || stats === null))
  const subtitle = mode === 'all'
    ? (stats ? 'Your lifetime listening, from your Spotify export' : 'All-time stats from your Spotify export')
    : `Your ${PERIOD_WORD[mode]} in music${tracked ? '' : ' — from what Spotify remembers'}`

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <TabHeader title="wrapped" subtitle={subtitle}>
          <View style={styles.modes}>
            {MODES.map(m => <Chip key={m.id} label={m.label} selected={mode === m.id} onPress={() => chooseMode(m.id)} />)}
          </View>
        </TabHeader>

        {parsing ? (
          <View style={styles.parsing}>
            {/* 2.0: the import fills like a glass — motion #7 */}
            <LiquidFill progress={progress.total ? progress.done / progress.total : 0.04} size={190} color={Colors.greenPrimary} label="Importing your history">
              <RollingNumber value={`${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`} style={styles.fillPct} />
            </LiquidFill>
            <Text style={styles.parsingText}>Crunching your history{progress.total ? `  ${progress.done}/${progress.total} files` : ''}…</Text>
          </View>
        ) : (mode !== 'all' || stats) ? (
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


  scrollPad: { flex: 1, paddingHorizontal: Spacing.lg },
  modes: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap' },
  block: { marginBottom: Spacing.md },
  tiles: { flexDirection: 'row', gap: Spacing.md },
  pHeroValue: { fontFamily: FontFamily.syneBold, fontSize: FontSize['4xl'], color: Colors.greenPrimary, letterSpacing: -2 },
  fillPct: { fontFamily: FontFamily.syneBold, fontSize: 34, color: '#ffffff', letterSpacing: -1 },
  bucketLabels: { flexDirection: 'row', gap: 2, marginTop: 4 },
  bucketLabel: { flex: 1, textAlign: 'center' },

  heroCard: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.lg, overflow: 'hidden', paddingVertical: Spacing.xl, alignItems: 'center', gap: 2, marginBottom: Spacing.md },
  heroValue: { fontFamily: FontFamily.syneBold, fontSize: FontSize['4xl'], color: Colors.greenPrimary, letterSpacing: -2 },
  heroSub: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },

  statRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  recapsBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.glass, borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.28), borderRadius: Radius.lg, overflow: 'hidden', padding: Spacing.lg, marginBottom: Spacing.md },
  recapsTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  recapsSub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  recapsArrow: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.greenPrimary },
  statPill: { flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: FontFamily.display, fontSize: 16, fontWeight: '700', color: Colors.text, letterSpacing: -0.5, alignSelf: 'stretch', textAlign: 'center' },
  statLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },

  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.lg, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  cardSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  sectionLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.xs },


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
