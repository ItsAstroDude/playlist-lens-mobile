import React, { useMemo, useState, useCallback } from 'react'
import { useLoadTime, useRenderStart } from '@/utils/perf'
import { View, Text, StyleSheet, ScrollView, Share } from 'react-native'
import { router } from 'expo-router'
import { Colors, FontFamily, FontSize, Spacing, Type } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { fmtHours, type RecapPeriod } from '@/utils/wrapped'
import { loadRecaps } from '@/hooks/useWrapped'
import { autoPullScopeMissing } from '@/utils/recents'
import { recapsFromDb } from '@/utils/stats'
import { keptSeasons, setSeasonKept, hiddenYears, setYearHidden } from '@/utils/recapPrefs'
import type { PeriodKind } from '@/utils/periods'
import {
  Screen, ScreenHeader, Card, ListRow, Chip, EmptyState, RankRow, Button,
} from '@/components/ui'

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'year',   label: 'Year' },
  { id: 'season', label: 'Season' },
  { id: 'month',  label: 'Month' },
  { id: 'week',   label: 'Week' },
]

function listFor(recaps: ReturnType<typeof recapsFromDb>, kind: PeriodKind): RecapPeriod[] {
  if (!recaps) return []
  return kind === 'year' ? recaps.years
    : kind === 'season' ? recaps.seasons
    : kind === 'month' ? recaps.months
    : recaps.weeks
}

export default function RecapsScreen() {
  const t0 = useRenderStart()
  // Built from the play database in SQL, local time (the stats engine).
  const recaps = useMemo(() => recapsFromDb(loadRecaps()), [])
  useLoadTime('recaps', t0, true)  // everything above is synchronous on first render
  const needsReconnect = useMemo(() => autoPullScopeMissing(), [])
  const [kind, setKind] = useState<PeriodKind>('year')
  const [hidden, setHidden] = useState<Set<string>>(() => hiddenYears())
  const [kept, setKept]     = useState<Set<string>>(() => keptSeasons())
  const [showHidden, setShowHidden] = useState(false)

  const all = listFor(recaps, kind)
  const visible = kind === 'year' && !showHidden ? all.filter(p => !hidden.has(p.key)) : all
  const [selKey, setSelKey] = useState<string | null>(null)
  const selected = visible.find(p => p.key === selKey) ?? visible[0] ?? null

  const onPickKind = useCallback((k: PeriodKind) => { setKind(k); setSelKey(null); setShowHidden(false) }, [])

  const onDiscardYear = useCallback((key: string) => {
    haptic.warning(); setYearHidden(key, true); setHidden(new Set(hiddenYears())); setSelKey(null)
  }, [])
  const onRestoreYear = useCallback((key: string) => {
    haptic.light(); setYearHidden(key, false); setHidden(new Set(hiddenYears()))
  }, [])
  const onToggleKeep = useCallback((key: string, next: boolean) => {
    haptic.light(); setSeasonKept(key, next); setKept(new Set(keptSeasons()))
  }, [])

  const onShare = useCallback(async (p: RecapPeriod) => {
    haptic.light()
    const tops = p.topArtists.slice(0, 3).map(a => a.name).join(', ')
    await Share.share({
      message: `My ${p.label} on playlist.lens — ${fmtHours(p.ms)} of music, ${p.streams.toLocaleString()} plays${tops ? `.\nTop artists: ${tops}` : ''}.`,
    })
  }, [])

  const hiddenCount = kind === 'year' ? all.filter(p => hidden.has(p.key)).length : 0

  return (
    <Screen>
      <ScreenHeader title="recaps" subtitle="Your listening by week, month, season and year" />

      {!recaps ? (
        <EmptyState
          icon="time-outline"
          title="No recaps yet"
          body="Turn on listening tracking in Settings, or import your Spotify history in Wrapped — recaps build themselves from your plays."
          actionLabel="Open Settings"
          onAction={() => router.push('/settings')}
        />
      ) : (
        <>
          {needsReconnect && (
            <Card tone="accent">
              <ListRow icon="sync" label="Reconnect Spotify" hint="Needed to keep recaps fresh between imports"
                onPress={() => { haptic.light(); router.push('/settings') }} last />
            </Card>
          )}

          <View style={styles.chips}>
            {KINDS.map(k => <Chip key={k.id} label={k.label} selected={k.id === kind} onPress={() => onPickKind(k.id)} />)}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods} style={styles.periodsScroll}>
            {visible.map(p => (
              <Chip
                key={p.key}
                label={p.label}
                icon={kind === 'season' && kept.has(p.key) ? 'bookmark' : undefined}
                selected={selected?.key === p.key}
                onPress={() => setSelKey(p.key)}
              />
            ))}
            {kind === 'year' && hiddenCount > 0 && (
              <Chip
                label={showHidden ? 'Hide discarded' : `Discarded (${hiddenCount})`}
                icon={showHidden ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setShowHidden(v => !v)}
              />
            )}
          </ScrollView>

          {selected ? (
            <RecapDetail
              key={selected.key}
              period={selected}
              kind={kind}
              isKept={kept.has(selected.key)}
              isHidden={hidden.has(selected.key)}
              onShare={() => onShare(selected)}
              onToggleKeep={next => onToggleKeep(selected.key, next)}
              onDiscard={() => onDiscardYear(selected.key)}
              onRestore={() => onRestoreYear(selected.key)}
            />
          ) : (
            <EmptyState icon="calendar-outline" title="Nothing here yet" body="Recaps for this kind of period appear once you've listened through one." />
          )}
        </>
      )}
    </Screen>
  )
}

// ─── Detail ─────────────────────────────────────────────────────────────────────
function RecapDetail({ period, kind, isKept, isHidden, onShare, onToggleKeep, onDiscard, onRestore }: {
  period: RecapPeriod; kind: PeriodKind; isKept: boolean; isHidden: boolean
  onShare: () => void; onToggleKeep: (next: boolean) => void; onDiscard: () => void; onRestore: () => void
}) {
  const maxA = period.topArtists[0]?.ms || 1
  const maxT = period.topTracks[0]?.plays || 1
  const maxL = period.topAlbums[0]?.ms || 1
  return (
    <View style={styles.detail}>
      <Card tone="accent" padded>
        <Text style={Type.overline}>{period.label}</Text>
        <Text style={styles.heroValue}>{fmtHours(period.ms)}</Text>
        <Text style={Type.caption}>{period.streams.toLocaleString()} plays</Text>
      </Card>

      {period.topArtists.length > 0 && (
        <RankCard title="top artists · by time">
          {period.topArtists.map((a, i) => <RankRow key={a.name + i} rank={i + 1} name={a.name} value={fmtHours(a.ms)} frac={a.ms / maxA} color={Colors.greenPrimary} />)}
        </RankCard>
      )}
      {period.topTracks.length > 0 && (
        <RankCard title="top tracks · by plays">
          {period.topTracks.map((t, i) => <RankRow key={t.name + i} rank={i + 1} name={t.name} sub={t.artist} value={`${t.plays}×`} frac={t.plays / maxT} color={Colors.pink} />)}
        </RankCard>
      )}
      {period.topAlbums.length > 0 && (
        <RankCard title="top albums · by time">
          {period.topAlbums.map((a, i) => <RankRow key={a.name + i} rank={i + 1} name={a.name} value={fmtHours(a.ms)} frac={a.ms / maxL} color={Colors.lavender} />)}
        </RankCard>
      )}

      <View style={styles.actions}>
        <Button label="Share" icon="share-outline" variant="accent" onPress={onShare} style={styles.action} />
        {kind === 'season' && (
          <Button label={isKept ? 'Saved' : 'Keep'} icon={isKept ? 'bookmark' : 'bookmark-outline'} variant="secondary"
            onPress={() => onToggleKeep(!isKept)} style={styles.action} />
        )}
        {kind === 'year' && (isHidden
          ? <Button label="Restore" icon="refresh" variant="secondary" onPress={onRestore} style={styles.action} />
          : <Button label="Discard" icon="eye-off-outline" variant="secondary" onPress={onDiscard} style={styles.action} />)}
      </View>
    </View>
  )
}

function RankCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card padded>
      <Text style={[Type.overline, styles.rankTitle]}>{title}</Text>
      {children}
    </Card>
  )
}

const styles = StyleSheet.create({
  chips:         { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  periodsScroll: { marginTop: -Spacing.sm, marginHorizontal: -Spacing.lg },
  periods:       { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  detail:        { gap: Spacing.md },
  heroValue:     { fontFamily: FontFamily.syneBold, fontSize: FontSize['4xl'], color: Colors.greenPrimary, letterSpacing: -2, marginVertical: Spacing.xs },
  rankTitle:     { marginBottom: Spacing.sm },
  actions:       { flexDirection: 'row', gap: Spacing.sm },
  action:        { flex: 1 },
})
