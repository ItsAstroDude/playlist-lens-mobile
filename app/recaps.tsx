import React, { useMemo, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming, Easing } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { fmtHours, type RecapPeriod } from '@/utils/wrapped'
import { loadRecaps } from '@/hooks/useWrapped'
import { loadBuffer, mergeRecaps, autoPullScopeMissing } from '@/utils/recents'
import { keptSeasons, setSeasonKept, hiddenYears, setYearHidden } from '@/utils/recapPrefs'
import type { PeriodKind } from '@/utils/periods'

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'year',   label: 'Year' },
  { id: 'season', label: 'Season' },
  { id: 'month',  label: 'Month' },
  { id: 'week',   label: 'Week' },
]

function listFor(recaps: ReturnType<typeof mergeRecaps>, kind: PeriodKind): RecapPeriod[] {
  if (!recaps) return []
  return kind === 'year' ? recaps.years
    : kind === 'season' ? recaps.seasons
    : kind === 'month' ? recaps.months
    : recaps.weeks
}

export default function RecapsScreen() {
  const recaps = useMemo(() => mergeRecaps(loadRecaps(), loadBuffer()), [])
  const needsReconnect = useMemo(() => autoPullScopeMissing(), [])
  const [kind, setKind] = useState<PeriodKind>('year')
  const [hidden, setHidden] = useState<Set<string>>(() => hiddenYears())
  const [kept, setKept]     = useState<Set<string>>(() => keptSeasons())
  const [showHidden, setShowHidden] = useState(false)

  const all = listFor(recaps, kind)
  const visible = kind === 'year' && !showHidden ? all.filter(p => !hidden.has(p.key)) : all
  const [selKey, setSelKey] = useState<string | null>(null)
  const selected = visible.find(p => p.key === selKey) ?? visible[0] ?? null

  const headerY = useSharedValue(12); const headerO = useSharedValue(0)
  React.useEffect(() => {
    headerY.value = withDelay(60, withSpring(0, Spring.entrance))
    headerO.value = withDelay(60, withTiming(1, { duration: 360 }))
  }, [])
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: headerY.value }], opacity: headerO.value }))

  // Gliding indicator for the kind switcher (animates between the four positions).
  const segWidth = useSharedValue(0)
  const segPos   = useSharedValue(0)
  React.useEffect(() => {
    segPos.value = withTiming(KINDS.findIndex(k => k.id === kind), { duration: 240, easing: Easing.out(Easing.cubic) })
  }, [kind])
  const indicatorStyle = useAnimatedStyle(() => {
    const pad = 3
    const w = Math.max(0, (segWidth.value - pad * 2) / KINDS.length)
    return { width: w, transform: [{ translateX: pad + segPos.value * w }] }
  })

  const onPickKind = useCallback((k: PeriodKind) => { haptic.light(); setKind(k); setSelKey(null); setShowHidden(false) }, [])

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
    <View style={styles.container}>
      <AmbientBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.heading}>recaps</Text>
          <View style={{ width: 36 }} />
        </View>

        {!recaps ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>◷</Text>
            <Text style={styles.emptyTitle}>No recaps yet</Text>
            <Text style={styles.emptyDesc}>Import your listening history in the Wrapped tab to unlock weekly, monthly, seasonal and yearly recaps.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {needsReconnect && (
              <TouchableOpacity style={styles.reconnect} onPress={() => { haptic.light(); router.push('/settings') }} activeOpacity={0.85}>
                <Text style={styles.reconnectText}>↻  Reconnect Spotify to keep these fresh</Text>
              </TouchableOpacity>
            )}
            {/* Kind switcher */}
            <Animated.View style={[styles.segment, headerStyle]} onLayout={e => { segWidth.value = e.nativeEvent.layout.width }}>
              <Animated.View style={[styles.segIndicator, indicatorStyle]} />
              {KINDS.map(k => {
                const active = k.id === kind
                return (
                  <TouchableOpacity key={k.id} style={styles.segBtn} onPress={() => onPickKind(k.id)} activeOpacity={0.8}>
                    <Text style={[styles.segText, active && styles.segTextActive]}>{k.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </Animated.View>

            {/* Period chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {visible.map(p => {
                const active = selected?.key === p.key
                return (
                  <TouchableOpacity key={p.key} style={[styles.chip, active && styles.chipActive]} onPress={() => { haptic.light(); setSelKey(p.key) }} activeOpacity={0.8}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{p.label}</Text>
                    {kind === 'season' && kept.has(p.key) && <Text style={styles.chipStar}>  ✦</Text>}
                  </TouchableOpacity>
                )
              })}
              {kind === 'year' && hiddenCount > 0 && (
                <TouchableOpacity style={styles.chip} onPress={() => { haptic.light(); setShowHidden(s => !s) }} activeOpacity={0.8}>
                  <Text style={styles.chipText}>{showHidden ? 'Hide discarded' : `Discarded (${hiddenCount})`}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {selected ? <RecapDetail
              key={selected.key}
              period={selected}
              kind={kind}
              isKept={kept.has(selected.key)}
              isHidden={hidden.has(selected.key)}
              onShare={() => onShare(selected)}
              onToggleKeep={next => onToggleKeep(selected.key, next)}
              onDiscard={() => onDiscardYear(selected.key)}
              onRestore={() => onRestoreYear(selected.key)}
            /> : <Text style={styles.emptyDesc}>Nothing here yet.</Text>}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

// ─── Detail ─────────────────────────────────────────────────────────────────────
function RecapDetail({ period, kind, isKept, isHidden, onShare, onToggleKeep, onDiscard, onRestore }: {
  period: RecapPeriod; kind: PeriodKind; isKept: boolean; isHidden: boolean
  onShare: () => void; onToggleKeep: (next: boolean) => void; onDiscard: () => void; onRestore: () => void
}) {
  const maxA = period.topArtists[0]?.ms ?? 1
  const maxT = period.topTracks[0]?.plays ?? 1
  const maxL = period.topAlbums[0]?.ms ?? 1
  return (
    <View>
      <View style={styles.heroCard}>
        <View style={styles.cardSpecular} />
        <Text style={styles.heroLabel}>{period.label}</Text>
        <Text style={styles.heroValue}>{fmtHours(period.ms)}</Text>
        <Text style={styles.heroSub}>{period.streams.toLocaleString()} plays</Text>
      </View>

      {period.topArtists.length > 0 && (
        <Section title="TOP ARTISTS · BY TIME">
          {period.topArtists.map((a, i) => <Bar key={a.name + i} rank={i + 1} name={a.name} value={fmtHours(a.ms)} frac={a.ms / maxA} color={Colors.greenPrimary} />)}
        </Section>
      )}
      {period.topTracks.length > 0 && (
        <Section title="TOP TRACKS · BY PLAYS">
          {period.topTracks.map((t, i) => <Bar key={t.name + i} rank={i + 1} name={t.name} sub={t.artist} value={`${t.plays}×`} frac={t.plays / maxT} color={Colors.pink} />)}
        </Section>
      )}
      {period.topAlbums.length > 0 && (
        <Section title="TOP ALBUMS · BY TIME">
          {period.topAlbums.map((a, i) => <Bar key={a.name + i} rank={i + 1} name={a.name} value={fmtHours(a.ms)} frac={a.ms / maxL} color={Colors.lavender} />)}
        </Section>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={onShare} activeOpacity={0.85}>
          <Text style={styles.actionPrimaryText}>Share</Text>
        </TouchableOpacity>
        {kind === 'season' && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onToggleKeep(!isKept)} activeOpacity={0.75}>
            <Text style={styles.actionText}>{isKept ? '✦ Saved' : 'Keep'}</Text>
          </TouchableOpacity>
        )}
        {kind === 'year' && (
          isHidden
            ? <TouchableOpacity style={styles.actionBtn} onPress={onRestore} activeOpacity={0.75}><Text style={styles.actionText}>Restore</Text></TouchableOpacity>
            : <TouchableOpacity style={styles.actionBtn} onPress={onDiscard} activeOpacity={0.75}><Text style={[styles.actionText, { color: Colors.textMuted }]}>Discard</Text></TouchableOpacity>
        )}
      </View>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardSpecular} />
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  )
}

function Bar({ rank, name, sub, value, frac, color }: { rank: number; name: string; sub?: string; value: string; frac: number; color: string }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barRank}>{rank}</Text>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={styles.barName} numberOfLines={1}>{name}{sub ? <Text style={styles.barSub}>  {sub}</Text> : null}</Text>
        <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(2, frac * 100)}%`, backgroundColor: color }]} /></View>
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1, zIndex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  heading: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1 },

  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 130 },
  reconnect: { backgroundColor: alpha(Colors.greenPrimary, 0.1), borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.35), borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.md, alignItems: 'center' },
  reconnectText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.greenPrimary },
  segment: { flexDirection: 'row', backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.full, padding: 3, marginBottom: Spacing.md },
  segBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.full, zIndex: 1 },
  segIndicator: { position: 'absolute', top: 3, bottom: 3, left: 0, backgroundColor: alpha(Colors.greenPrimary, 0.16), borderRadius: Radius.full },
  segText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textMuted },
  segTextActive: { color: Colors.greenPrimary },

  chipRow: { gap: Spacing.sm, paddingBottom: Spacing.md, paddingRight: Spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.full, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  chipActive: { borderColor: alpha(Colors.greenPrimary, 0.5), backgroundColor: alpha(Colors.greenPrimary, 0.1) },
  chipText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextActive: { color: Colors.greenPrimary },
  chipStar: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.greenPrimary },

  heroCard: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', paddingVertical: Spacing.xl, alignItems: 'center', gap: 2, marginBottom: Spacing.md },
  heroLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.xs },
  heroValue: { fontFamily: FontFamily.syneBold, fontSize: FontSize['4xl'], color: Colors.greenPrimary, letterSpacing: -2 },
  heroSub: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },

  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  cardSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  sectionLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.xs },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  barRank: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 18, textAlign: 'right' },
  barName: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  barSub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  barTrack: { height: 4, backgroundColor: Colors.glass, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  barFill: { height: '100%', borderRadius: 2, opacity: 0.85 },
  barValue: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, minWidth: 52, textAlign: 'right' },

  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn: { flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center' },
  actionText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  actionPrimary: { backgroundColor: Colors.greenPrimary, borderColor: Colors.greenPrimary },
  actionPrimaryText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.background },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { fontSize: 40, color: Colors.greenPrimary },
  emptyTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text },
  emptyDesc: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: FontSize.sm * 1.6 },
})
