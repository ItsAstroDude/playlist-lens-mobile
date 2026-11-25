import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useWrapped } from '@/hooks/useWrapped'
import { fmtHours, fmtMinutesShort, type WrappedStats, type StreamRow } from '@/utils/wrapped'
import { periodTitle, bucketLabels, type SummaryKind, type PeriodComparison } from '@/utils/listening'
import { countSince, windowStartT } from '@/utils/playDb'
import { periodComparison, periodComparisonAsync, currentBucket, allTimeAsync, yearsWithPlays, localOffsetSec, periodRange as statsPeriodRange } from '@/utils/stats'
import { useCachedStat, peekCached } from '@/utils/sqlJob'
import { newToYouAsync, onThisDay, streaksAsync, milestonesAsync, type NewToYou, type OnThisDayYear, type Streaks, type Milestone, type NextMilestone } from '@/utils/highlights'
import { NewToYouCard, OnThisDayCard, StreaksCard, MilestonesCard } from '@/components/stats/Highlights'
import { CalendarHeatmap } from '@/components/stats/CalendarHeatmap'
import { trackingEnrolled } from '@/utils/tracking'
import { Chip, Stat, EmptyState as DSEmptyState, ListRow, Card, TabHeader, RankRow, IconButton, ArtThumb, BackButton } from '@/components/ui'
import { LiquidBackground } from '@/components/motion/LiquidBackground'
import { WrappedItemSheet, type WrappedSelection } from '@/components/wrapped/WrappedItemSheet'
import { artistHref, songHref } from '@/utils/itemStats'
import { AddToQueueButton } from '@/components/queue/AddToQueueButton'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import type { QueueItem } from '@/utils/queueCart'
import { confirmDialog } from '@/utils/dialog'
import type { ArtKind } from '@/hooks/useArtwork'
import { Icon } from '@/components/ui/Icon'
import { useLoadTime, useRenderStart } from '@/utils/perf'
import { RollingNumber, RackFocus, LiquidFill } from '@/components/motion'
import { Bubble } from '@/components/motion/Bubble'

const PRIVACY_URL = 'https://www.spotify.com/account/privacy/'

type Block =
  | { t: 'hero'; ms: number; since: string }
  | { t: 'pills'; streams: number; artists: number; tracks: number }
  | { t: 'list'; key: string; title: string; kind: ArtKind; color: string; rows: Row[] }
  | { t: 'clock'; clock: number[] }
  | { t: 'weekdays'; days: number[] }
  | { t: 'heat'; years: number[] }
  | { t: 'newToYou'; kind: SummaryKind; n: NewToYou }
  | { t: 'otd'; years: OnThisDayYear[] }
  | { t: 'streaks'; s: Streaks }
  | { t: 'miles'; m: { reached: Milestone[]; next: NextMilestone[] } }
  | { t: 'years'; rows: { year: number; ms: number; topArtist: string; frac: number }[] }
  | { t: 'foot'; real: number; skipPct: number | null; podcast: number }
  | { t: 'manage' }
  | { t: 'importCta' }
  // ── Period views (v1.8): this week / month / year from the play buffer ──
  | { t: 'pHero'; kind: SummaryKind; title: string; ms: number; delta: number | null }
  | { t: 'pTiles'; plays: number; playsDelta: number | null; artists: number; tracks: number }
  | { t: 'pBars'; kind: SummaryKind; buckets: number[]; labels: string[]; current: number }
  | { t: 'pEmpty'; kind: SummaryKind; tracked: boolean }
  | { t: 'pCta' }
  | { t: 'pStory'; kind: SummaryKind | 'all' }

interface Row { name: string; sub?: string; value: string; frac: number; sel: WrappedSelection; add?: QueueItem }

/** Cards built on the first frame (about a screenful); the rest follow a couple per frame. */
const FIRST_BLOCKS = 4
/** Stable identity per card, so a card arriving late (streaks, milestones) doesn't rebuild the ones below it. */
const blockKey = (b: Block): string => ('key' in b && typeof b.key === 'string' ? b.key : b.t)

const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKDAY_NAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Listening by weekday (Mon..Sun), like the clock. */
const Weekdays = React.memo(function Weekdays({ days }: { days: number[] }) {
  const max = Math.max(...days, 1)
  const peak = days.indexOf(max)
  return (
    <View style={styles.card}>
      <View style={styles.cardSpecular} />
      <Text style={styles.sectionLabel}>BY WEEKDAY</Text>
      <View style={styles.clockRow} accessible accessibilityLabel={`Listening by weekday; busiest is ${WEEKDAY_NAME[peak]}`}>
        {days.map((ms, d) => (
          <View key={d} style={styles.clockCol}>
            <View style={[styles.clockBar, { height: `${Math.max(3, (ms / max) * 100)}%`, backgroundColor: d === peak ? Colors.greenPrimary : alpha(Colors.greenPrimary, 0.35) }]} />
          </View>
        ))}
      </View>
      <View style={styles.clockLabels}>
        {WEEKDAY_SHORT.map((l, d) => <Text key={d} style={[styles.clockLabel, styles.bucketLabel, d === peak && { color: Colors.greenPrimary }]}>{l}</Text>)}
      </View>
      <Text style={styles.clockPeak}>Busiest day: {WEEKDAY_NAME[peak]}</Text>
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
function buildBlocks(stats: WrappedStats, imported: boolean, years: number[], extra: { streaks?: Streaks; miles?: { reached: Milestone[]; next: NextMilestone[] } }): Block[] {
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
  blocks.push({ t: 'pStory', kind: 'all' })
  if (extra.streaks?.longest) blocks.push({ t: 'streaks', s: extra.streaks })
  if (extra.miles && (extra.miles.reached.length || extra.miles.next.length)) blocks.push({ t: 'miles', m: extra.miles })
  if (artistRows.length) blocks.push({ t: 'list', key: 'artists', title: 'TOP ARTISTS · BY TIME', kind: 'artist', color: Colors.greenPrimary, rows: artistRows })
  if (trackRows.length)  blocks.push({ t: 'list', key: 'tracks',  title: 'TOP TRACKS · BY PLAYS', kind: 'track', color: Colors.pink, rows: trackRows })
  if (albumRows.length)  blocks.push({ t: 'list', key: 'albums',  title: 'TOP ALBUMS · BY TIME', kind: 'album', color: Colors.lavender, rows: albumRows })
  blocks.push({ t: 'clock', clock: stats.clock })
  // WrappedStats keeps weekdays Sunday-first; the chart reads Monday-first.
  if (stats.weekday?.length === 7 && stats.weekday.some(v => v > 0)) {
    blocks.push({ t: 'weekdays', days: [...stats.weekday.slice(1), stats.weekday[0]] })
  }
  if (years.length) blocks.push({ t: 'heat', years })   // calendar heatmap, a year at a time
  if (stats.byYear.length) blocks.push({ t: 'years', rows: stats.byYear.map(y => ({ year: y.year, ms: y.ms, topArtist: y.topArtist, frac: y.ms / maxY })) })
  // Skips are only known from an import (the export records them; tracking can't).
  const skipPct = imported && stats.totalStreams ? Math.round((stats.skipCount / stats.totalStreams) * 100) : null
  blocks.push({ t: 'foot', real: stats.realListens, skipPct, podcast: stats.podcastStreams })
  // Re-import / Clear only with an import: Clear wipes every stored play, tracked ones too.
  blocks.push(imported ? { t: 'manage' } : { t: 'importCta' })
  return blocks
}

// ─── Period blocks (week / month / year) ─────────────────────────────────────
type Mode = SummaryKind | 'all'
const MODES: { id: Mode; label: string }[] = [
  { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }, { id: 'all', label: 'All time' },
]
const PERIOD_WORD: Record<SummaryKind, string> = { week: 'week', month: 'month', year: 'year' }
const fmtPeriod = (kind: SummaryKind, ms: number) => (kind === 'year' ? fmtHours(ms) : fmtMinutesShort(ms))

function buildPeriodBlocks(c: PeriodComparison, tracked: boolean, now: Date, extra: { fresh?: NewToYou; otd?: OnThisDayYear[] }): Block[] {
  const s = c.current
  const kind = s.kind
  const blocks: Block[] = [{ t: 'pHero', kind, title: periodTitle(s), ms: s.ms, delta: c.deltaMs }]
  if (!s.plays) {
    blocks.push({ t: 'pEmpty', kind, tracked })
    return blocks
  }
  const today = currentBucket(kind, now)
  blocks.push({ t: 'pStory', kind })
  blocks.push({ t: 'pTiles', plays: s.plays, playsDelta: c.deltaPlays, artists: s.artists, tracks: s.tracks })
  blocks.push({ t: 'pBars', kind, buckets: s.buckets, labels: bucketLabels(s), current: today })
  if (kind === 'year') blocks.push({ t: 'heat', years: [new Date(s.start).getFullYear()] })
  if (extra.otd?.length) blocks.push({ t: 'otd', years: extra.otd })

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
  // The listening clock for every period; the weekday split where the bars aren't
  // already weekdays (a week's bars are).
  if (s.clock?.some(v => v > 0)) blocks.push({ t: 'clock', clock: s.clock })
  if (kind !== 'week' && s.weekdays?.some(v => v > 0)) blocks.push({ t: 'weekdays', days: s.weekdays })
  // Only when the history starts well before this period — otherwise everything is "new".
  if (extra.fresh?.trusted && extra.fresh.artists > 0) blocks.push({ t: 'newToYou', kind, n: extra.fresh })
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
  const { stats: storedStats, status, progress, errorMsg, importHistory, clearHistory } = useWrapped()
  const [sel, setSel] = useState<WrappedSelection | null>(null)

  // Play buffer (tracked + device + import tail) — re-read whenever the tab is
  // focused, since background sync keeps adding to it.
  // Plays are read per mode, only the two periods it compares (this one + the one
  // before), straight from the play database — not two years of rows on every switch.
  // `version` bumps on focus, since background sync keeps adding plays.
  const [version, setVersion] = useState(0)
  const [tracked, setTracked] = useState(trackingEnrolled())
  useFocusEffect(useCallback(() => { setVersion(v => v + 1); setTracked(trackingEnrolled()) }, []))
  const hasRecent = useMemo(() => countSince(windowStartT()) > 0, [version])
  const [mode, setMode] = useState<Mode>('week')
  // No recent plays at all but a lifetime import → open on All time instead of an
  // empty week (stats load a tick after mount, so decide once they arrive).
  const pickedMode = React.useRef(false)
  React.useEffect(() => {
    if (pickedMode.current || !storedStats) return
    pickedMode.current = true
    if (!hasRecent) setMode('all')
  }, [storedStats, hasRecent])
  const chooseMode = useCallback((m: Mode) => { pickedMode.current = true; setMode(m) }, [])
  const now = useMemo(() => new Date(), [version, mode])
  // All time from the stats engine (SQL, local time, includes plays tracked since the
  // import); falls back to the stored import summary for pre-2.0 imports. It scans the
  // whole history, so it runs off the UI thread, only while All time is open, and
  // opens on the last saved answer while the fresh one is worked out.
  // All time, its streaks and milestones arrive together: one list rebuild, not three.
  const allOpen = mode === 'all'
  type AllBundle = { stats: WrappedStats | null; streaks?: Streaks; miles?: { reached: Milestone[]; next: NextMilestone[] } }
  const allBundle = useCachedStat<AllBundle>(
    'allBundle',
    () => Promise.all([allTimeAsync(storedStats, now), streaksAsync(now), milestonesAsync()])
      .then(([stats, streaks, miles]) => ({ stats, streaks, miles })),
    [storedStats, now],
    {
      enabled: allOpen,
      initial: () => {
        const s = peekCached<WrappedStats | null>('allTime')
        return s === undefined ? undefined
          : { stats: s, streaks: peekCached<Streaks>('streaks'), miles: peekCached<AllBundle['miles']>('milestones') }
      },
    },
  )
  const stats = allOpen ? (allBundle.value?.stats ?? storedStats) : storedStats
  const allLoading = allOpen && !stats && allBundle.loading
  // This period so far vs the last, from the stats engine (SQL, local time). A week or a
  // month is a millisecond or two; a year is a few hundred on a phone, so it runs off the
  // UI thread — and a saved one only shows if it's for this same year.
  const off = useMemo(() => localOffsetSec(now), [now])
  const shortCmp = useMemo(() => (mode === 'week' || mode === 'month' ? periodComparison(mode, now) : null), [mode, now])
  const yearCmp = useCachedStat('cmp2.year', () => periodComparisonAsync('year', now), [now], { enabled: mode === 'year' })
  const yearStartMs = statsPeriodRange('year', now, off).start * 1000
  const yearValue = yearCmp.value && yearCmp.value.current.start === yearStartMs ? yearCmp.value : undefined
  const comparison = mode === 'all' ? null : mode === 'year' ? (yearValue ?? null) : shortCmp
  const periodLoading = mode === 'year' && !yearValue
  // New to you (this period) and On this day (week view only — it's about today).
  const fresh = useCachedStat(
    `new.${mode}`,
    () => newToYouAsync(mode, Math.floor((comparison?.current.start ?? 0) / 1000), Math.floor((comparison?.current.end ?? 0) / 1000)),
    [mode, now], { enabled: !!comparison, peek: false },
  )
  const otd = useMemo(() => (mode === 'week' ? onThisDay(now) : []), [mode, now])
  const gutter = useNowPlayingGutter()
  // Build the first screenful at once and the rest a couple of cards per frame, so
  // opening stays quick. Reset only when the view (mode) changes — not when data
  // arrives, which would rebuild cards that are already up.
  const [shownBlocks, setShownBlocks] = useState(FIRST_BLOCKS)
  useEffect(() => { setShownBlocks(FIRST_BLOCKS) }, [mode])


  const onImport = useCallback(() => { haptic.medium(); importHistory() }, [importHistory])
  const onClear  = useCallback(() => {
    confirmDialog({
      glyph: 'trash-outline', destructive: true, confirmLabel: 'Clear',
      title: 'Clear history?',
      message: 'Removes your imported listening stats. You can re-import anytime.',
      onConfirm: clearHistory,
    })
  }, [clearHistory])
  // Artists and songs open their own page (2.0.43); albums keep the quick sheet.
  const onSelect = useCallback((s: WrappedSelection) => {
    haptic.light()
    if (s.kind === 'artist') router.push(artistHref(s.name))
    else if (s.kind === 'track' && s.artist) router.push(songHref(s.name, s.artist))
    else setSel(s)
  }, [])

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
      case 'list':
        return (
          <View style={styles.card}>
            <View style={styles.cardSpecular} />
            <Text style={styles.sectionLabel}>{item.title}</Text>
            {item.rows.map((r, i) => (
              <RackFocus key={r.name + i} index={Math.min(i, 8)} step={70} settle>
                <RankRow rank={i + 1} name={r.name} sub={r.sub} value={r.value} frac={r.frac} color={item.color} onPress={() => onSelect(r.sel)}
                  leading={<ArtThumb kind={item.kind} name={r.name} artist={item.kind === 'artist' ? undefined : r.sub} />}
                  trailing={r.add ? <AddToQueueButton item={r.add} /> : undefined} />
              </RackFocus>
            ))}
          </View>
        )
      case 'clock':
        return <Clock clock={item.clock} />
      case 'weekdays':
        return <Weekdays days={item.days} />
      case 'years':
        return (
          <View style={styles.card}>
            <View style={styles.cardSpecular} />
            <Text style={styles.sectionLabel}>BY YEAR</Text>
            {item.rows.map(y => (
              <RankRow key={y.year} name={String(y.year)} sub={y.topArtist} value={fmtHours(y.ms)} frac={y.frac} color={Colors.greenPrimary}
                onPress={y.topArtist ? () => { haptic.light(); router.push(artistHref(y.topArtist)) } : undefined} />
            ))}
          </View>
        )
      case 'foot':
        return (
          <Text style={styles.foot}>
            {item.real.toLocaleString()} full plays (≥30s){item.skipPct !== null ? ` · ${item.skipPct}% skipped` : ''}{item.podcast > 0 ? ` · ${item.podcast.toLocaleString()} podcast plays` : ''}
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
            <ListRow icon="play" label={item.kind === 'all' ? 'Play your story: all time' : `Play your ${PERIOD_WORD[item.kind]}`}
              hint={item.kind === 'all' ? 'Every year, as a story: your top artists, your biggest year, a card to share' : 'As a story: top artists and songs, your biggest day, a card to share'}
              onPress={() => { haptic.medium(); router.push(`/story?kind=${item.kind}`) }} last />
          </Card>
        )
      case 'pTiles':
        // 2.0 Liquid: the headline numbers float as glass bubbles
        return (
          <View style={[styles.block, styles.bubbles]} accessible accessibilityLabel={`${item.plays} plays, ${item.artists} artists, ${item.tracks} tracks`}>
            <Bubble size={148} color={alpha(Colors.greenPrimary, 0.32)} style={{ left: 4, top: 14 }} phase={0}>
              <RollingNumber value={item.plays.toLocaleString()} style={styles.bubbleNum} />
              <Text style={styles.bubbleLabel}>plays{item.playsDelta !== null ? ` · ${item.playsDelta >= 0 ? '+' : ''}${item.playsDelta}%` : ''}</Text>
            </Bubble>
            <Bubble size={116} color={alpha(Colors.lavender, 0.3)} style={{ right: 6, top: 0 }} delay={140} phase={1}>
              <RollingNumber value={item.artists.toLocaleString()} style={styles.bubbleNum} />
              <Text style={styles.bubbleLabel}>artists</Text>
            </Bubble>
            <Bubble size={104} color={alpha(Colors.pink, 0.3)} style={{ right: 70, top: 112 }} delay={280} phase={2}>
              <RollingNumber value={item.tracks.toLocaleString()} style={styles.bubbleNum} />
              <Text style={styles.bubbleLabel}>tracks</Text>
            </Bubble>
          </View>
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
      case 'newToYou':
        return <View style={styles.block}><NewToYouCard kind={item.kind} n={item.n} /></View>
      case 'otd':
        return <View style={styles.block}><OnThisDayCard years={item.years} /></View>
      case 'streaks':
        return <View style={styles.block}><StreaksCard s={item.s} /></View>
      case 'miles':
        return <View style={styles.block}><MilestonesCard reached={item.m.reached} next={item.m.next} /></View>
      case 'heat':
        return <View style={styles.block}><CalendarHeatmap years={item.years} /></View>
      case 'importCta':
        return (
          <Card style={styles.block}>
            <ListRow icon="cloud-download-outline" label="Import your Spotify history"
              hint="Adds everything from before tracking started — years of it"
              onPress={onImport} last />
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
    () => (comparison
      ? buildPeriodBlocks(comparison, tracked, now, { fresh: fresh.value, otd })
      : stats
        // Engine stats (version 2) know their years; a pre-2.0 summary doesn't cover the database.
        ? buildBlocks(stats, !!storedStats, stats.version >= 2 ? stats.byYear.map(y => y.year).reverse() : yearsWithPlays(),
            { streaks: allBundle.value?.streaks, miles: allBundle.value?.miles })
        : []),
    [comparison, tracked, now, stats, storedStats, fresh.value, otd, allBundle.value],
  )
  useEffect(() => {
    if (shownBlocks >= blocks.length) return
    const raf = requestAnimationFrame(() => setShownBlocks(n => n + 2))
    return () => cancelAnimationFrame(raf)
  }, [shownBlocks, blocks.length])
  // Content on screen: a period view, lifetime stats, or the settled empty state.
  useLoadTime('wrapped', t0, !parsing && (blocks.length > 0 || stats === null))
  const subtitle = mode === 'all'
    ? (storedStats ? 'Your lifetime listening, from your Spotify export' : stats ? 'Everything tracked so far' : 'All-time stats from your Spotify export')
    : `Your ${PERIOD_WORD[mode]} in music${tracked ? '' : ' — from what Spotify remembers'}`

  return (
    <View style={styles.container}>
      {/* Its own page now (Labs › Wrapped), so it brings the background the tabs share. */}
      <LiquidBackground />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <TabHeader
          title={mode === 'all' ? 'all time' : `your ${PERIOD_WORD[mode]}`}
          subtitle={subtitle}
          titleRight={
            <>
              <BackButton />
              <IconButton icon="time-outline" label="History: every play, searchable, by day" onPress={() => router.push('/history')} />
              <IconButton icon="albums-outline" label="Recaps: past weeks, months, seasons and years" onPress={() => router.push('/recaps')} />
            </>
          }
        >
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
        ) : allLoading || periodLoading ? (
          <View style={styles.parsing}>
            <ActivityIndicator color={Colors.greenPrimary} />
            <Text style={styles.parsingText}>{periodLoading ? 'Adding up your year…' : 'Adding up all your listening…'}</Text>
          </View>
        ) : (mode !== 'all' || stats) ? (
          // A plain ScrollView, not a virtualised list: Wrapped is ~15 different cards, and
          // FlashList built each heavy one (the calendar, 30 animated rows…) the moment it
          // scrolled into view — the stutter while scrolling. Now every card is built once,
          // right after opening, and scrolling only moves them.
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 130 + gutter }}
            showsVerticalScrollIndicator={false}
          >
            {blocks.slice(0, shownBlocks).map(item => (
              <React.Fragment key={blockKey(item)}>{renderBlock({ item })}</React.Fragment>
            ))}
          </ScrollView>
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
  bubbles:     { height: 226, position: 'relative' },
  bubbleNum:   { fontFamily: FontFamily.syneBold, fontSize: 24, color: Colors.text, letterSpacing: -0.8 },
  bubbleLabel: { ...Type.caption, fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  container: { flex: 1, backgroundColor: 'transparent' },
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
