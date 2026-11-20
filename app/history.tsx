import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TextInput, Pressable, Linking, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, FontFamily, FontSize, Radius, Spacing, Type } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { fmtHours, fmtMinutesShort } from '@/utils/wrapped'
import {
  historyStartAsync, historyMoreAsync, localDay, localOffsetSec,
  type HistoryFilter, type HistoryPlay, type HistoryTotals, type DayTotals,
} from '@/utils/stats'
import { Screen, ScreenHeader, Chip, EmptyState, Icon, TrackRow, Sheet, ListRow, Card } from '@/components/ui'

/**
 * History (2.0 Phase 3) — every play we hold, newest first, grouped by day.
 * Search across track / artist / album; tap a play to see all plays of that song,
 * artist or album. Paged straight from the play database (utils/stats).
 *
 * Deep link: /history?artist=…&track=…&album=…&q=…&day=<local day number>
 */

const PAGE = 80
const DAY_MS = 86_400_000

type Item =
  | { kind: 'day'; key: string; day: number }
  | { kind: 'play'; key: string; play: HistoryPlay }

function dayLabel(day: number, today: number): string {
  if (day === today) return 'Today'
  if (day === today - 1) return 'Yesterday'
  const d = new Date(day * DAY_MS)                 // a local day number → its UTC date fields
  const sameYear = d.getUTCFullYear() === new Date(today * DAY_MS).getUTCFullYear()
  return d.toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC',
  })
}

function clockLabel(t: number): string {
  return new Date(t * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryScreen() {
  const params = useLocalSearchParams<{ artist?: string; track?: string; album?: string; q?: string; day?: string }>()
  const insets = useSafeAreaInsets()
  const off = useMemo(() => localOffsetSec(), [])
  const today = localDay(Math.floor(Date.now() / 1000), off)

  const [query, setQuery] = useState(params.q ?? '')
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220)
    return () => clearTimeout(t)
  }, [query])

  const [pin, setPin] = useState<Pick<HistoryFilter, 'artist' | 'track' | 'album'>>({
    artist: params.artist || undefined, track: params.track || undefined, album: params.album || undefined,
  })
  // One local day, from the calendar heatmap (cleared with its chip).
  const [day, setDay] = useState<number | null>(params.day && Number.isFinite(Number(params.day)) ? Number(params.day) : null)
  const filter: HistoryFilter = useMemo(() => ({
    ...pin, query: debounced,
    ...(day !== null ? { from: day * 86_400 - off, to: (day + 1) * 86_400 - off } : {}),
  }), [pin, debounced, day, off])

  const [plays, setPlays] = useState<HistoryPlay[]>([])
  const [days, setDays] = useState<DayTotals>(new Map())
  const [done, setDone] = useState(false)
  const [totals, setTotals] = useState<HistoryTotals>({ plays: 0, ms: 0, first: null, last: null })
  const [busy, setBusy] = useState(true)           // a (re)start is in flight
  const loading = useRef(false)
  // Every query runs off the UI thread (a search scans every play). `gen` drops answers
  // that arrive after a newer filter — typing fast never shows stale results.
  const gen = useRef(0)

  // (Re)start from the top whenever the filter changes. The old list stays up until then.
  useEffect(() => {
    const g = ++gen.current
    setBusy(true)
    historyStartAsync(filter, off, PAGE).then(r => {
      if (g !== gen.current) return
      setPlays(r.page); setDays(r.days); setTotals(r.totals)
      setDone(r.page.length < PAGE); setBusy(false)
    }, () => { if (g === gen.current) setBusy(false) })
  }, [filter, off])

  const loadMore = useCallback(() => {
    if (done || busy || loading.current || !plays.length) return
    loading.current = true
    const g = gen.current
    const last = plays[plays.length - 1]
    historyMoreAsync(filter, { t: last.t, uri: last.uri }, off, PAGE).then(r => {
      if (g !== gen.current) return
      if (r.page.length) {
        setDays(prev => { const m = new Map(prev); r.days.forEach((v, k) => m.set(k, v)); return m })
        setPlays(prev => [...prev, ...r.page])
      }
      setDone(r.page.length < PAGE)
    }).finally(() => { loading.current = false })
  }, [done, busy, plays, filter, off])

  const items = useMemo(() => {
    const out: Item[] = []
    let lastDay: number | null = null
    for (const p of plays) {
      const d = localDay(p.t, off)
      if (d !== lastDay) { out.push({ kind: 'day', key: `d${d}`, day: d }); lastDay = d }
      out.push({ kind: 'play', key: `${p.t}:${p.uri}`, play: p })
    }
    return out
  }, [plays, off])

  const [picked, setPicked] = useState<HistoryPlay | null>(null)
  // Keep the last play in the sheet while it slides closed.
  const shown = useRef<HistoryPlay | null>(null)
  if (picked) shown.current = picked
  const sheetPlay = shown.current
  const applyPin = useCallback((next: typeof pin) => {
    haptic.light(); setPicked(null); setPin(next); setDay(null); setQuery(''); setDebounced('')
  }, [])

  const pinned = pin.track ? `${pin.track}` : pin.album ? pin.album : pin.artist ?? null
  const searching = !!debounced.trim() || !!pinned || day !== null
  const subtitle = busy && !totals.plays ? (searching ? 'Searching…' : 'Every play, newest first')
    : totals.plays
      ? `${totals.plays.toLocaleString()} plays · ${fmtHours(totals.ms)}${totals.first ? ` · since ${new Date(totals.first * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}`
      : searching ? 'No plays match' : 'Every play, newest first'

  const renderItem = useCallback(({ item }: { item: Item }) => {
    if (item.kind === 'day') {
      const tot = days.get(item.day)
      return (
        <View style={styles.dayRow} accessibilityRole="header">
          <Text style={styles.dayLabel}>{dayLabel(item.day, today)}</Text>
          {tot ? <Text style={styles.dayTotal}>{tot.plays.toLocaleString()} {tot.plays === 1 ? 'play' : 'plays'} · {fmtMinutesShort(tot.ms)}</Text> : null}
        </View>
      )
    }
    const p = item.play
    return (
      <Pressable
        onPress={() => { haptic.light(); setPicked(p) }}
        style={({ pressed }) => [styles.playRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityHint="Shows all plays of this song, artist or album"
      >
        <TrackRow
          title={p.track}
          sub={[p.artist, p.album].filter(Boolean).join(' · ')}
          trailing={<Text style={styles.time}>{clockLabel(p.t)}</Text>}
          accessibilityLabel={`${p.track} by ${p.artist ?? 'unknown artist'}, ${clockLabel(p.t)}`}
        />
      </Pressable>
    )
  }, [days, today])

  return (
    <Screen
      scroll={false}
      overlay={
        <Sheet open={!!picked} onClose={() => setPicked(null)} title={sheetPlay?.track} subtitle={sheetPlay?.artist ?? undefined}>
          {sheetPlay && (
            <Card>
              {sheetPlay.artist && (
                <ListRow icon="musical-note" label="Every play of this song"
                  onPress={() => applyPin({ track: sheetPlay.track, artist: sheetPlay.artist ?? undefined })} />
              )}
              {sheetPlay.artist && (
                <ListRow icon="person" label={`Everything by ${sheetPlay.artist}`}
                  onPress={() => applyPin({ artist: sheetPlay.artist ?? undefined })} />
              )}
              {sheetPlay.album && (
                <ListRow icon="disc" label={`Everything from ${sheetPlay.album}`}
                  onPress={() => applyPin({ album: sheetPlay.album ?? undefined, artist: sheetPlay.artist ?? undefined })} />
              )}
              {!!sheetPlay.uri && (
                <ListRow icon="open-outline" label="Open in Spotify" last
                  onPress={() => { haptic.light(); Linking.openURL(sheetPlay.uri).catch(() => {}) }} />
              )}
            </Card>
          )}
        </Sheet>
      }
    >
      <View style={styles.head}>
        <ScreenHeader title="history" subtitle={subtitle} />
        <View style={styles.searchBox}>
          <Icon name="search" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs, artists, albums…"
            placeholderTextColor={Colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search your history"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="close-circle" size={16} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {(pinned || day !== null) && (
          <View style={styles.pins}>
            {day !== null && (
              <Chip label={`Day: ${dayLabel(day, today)}`} icon="close" selected onPress={() => { haptic.light(); setDay(null) }} />
            )}
            {pinned && (
              <Chip
                label={pin.track ? `Song: ${pin.track}` : pin.album ? `Album: ${pin.album}` : `Artist: ${pin.artist}`}
                icon="close"
                selected
                onPress={() => applyPin({})}
              />
            )}
          </View>
        )}
      </View>

      {items.length === 0 && busy ? (
        <View style={styles.empty}><ActivityIndicator color={Colors.greenPrimary} /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          {searching ? (
            <EmptyState icon="search-outline" title="Nothing matches" body="Try fewer words, or clear the filter." />
          ) : (
            <EmptyState
              icon="time-outline"
              title="No plays yet"
              body="Import your Spotify history in Wrapped, or turn on listening tracking — every play shows up here."
              actionLabel="Open Wrapped"
              onAction={() => router.push('/wrapped')}
            />
          )}
        </View>
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={i => i.key}
          getItemType={i => i.kind}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + Spacing['4xl'] }}
          ListFooterComponent={!done ? <Text style={styles.more}>Loading more…</Text> : plays.length > PAGE ? <Text style={styles.more}>That’s everything</Text> : null}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  head:        { paddingHorizontal: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.sm },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.text, paddingVertical: 0 },
  pins:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dayRow:      { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: Spacing.lg, paddingBottom: Spacing.xs },
  dayLabel:    { ...Type.heading },
  dayTotal:    { ...Type.caption },
  playRow:     { borderRadius: Radius.md },
  pressed:     { backgroundColor: Colors.glass },
  time:        { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  more:        { ...Type.caption, textAlign: 'center', paddingVertical: Spacing.lg },
  empty:       { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
})
