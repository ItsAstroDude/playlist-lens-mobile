import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, type GestureResponderEvent } from 'react-native'
import { router } from 'expo-router'
import { Colors, FontFamily, FontSize, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Card, Chip } from '@/components/ui'
import { RippleCell } from '@/components/motion'
import { fmtMinutesShort } from '@/utils/wrapped'
import { yearCalendar, heatLevel, localDay, localOffsetSec, type YearCalendar } from '@/utils/stats'

/**
 * Calendar heatmap (2.0 Phase 3, motion #9): a year of listening, one cell per day,
 * Monday-to-Sunday columns. Cells ripple in; tap a day for its total and a link to
 * that day in History. Colours are relative to the year's own quartiles, so a quiet
 * year still shows its shape.
 */

const CELL = 12
const GAP = 3
const STEP = CELL + GAP
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 86_400_000

const LEVELS = [
  alpha(Colors.text, 0.06),
  alpha(Colors.greenPrimary, 0.25),
  alpha(Colors.greenPrimary, 0.5),
  alpha(Colors.greenPrimary, 0.75),
  Colors.greenPrimary,
]

function dayTitle(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function CalendarHeatmap({ years }: {
  /** Years to choose from, newest first. The first one opens. */
  years: number[]
}) {
  const off = useMemo(() => localOffsetSec(), [])
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear())
  const cal = useMemo(() => yearCalendar(year, off), [year, off])
  const today = localDay(Math.floor(Date.now() / 1000), off)
  const [sel, setSel] = useState<number | null>(null)   // index into the year
  const scroll = useRef<ScrollView>(null)
  const [viewW, setViewW] = useState(0)

  // Monday-first grid: 1970-01-01 (local day 0) was a Thursday.
  const lead = (cal.firstDay + 3) % 7
  const cols = Math.ceil((lead + cal.days) / 7)
  const todayIdx = today - cal.firstDay
  const isCurrent = todayIdx >= 0 && todayIdx < cal.days

  const months = useMemo(() => MONTHS.map((label, m) => {
    const idx = (Date.UTC(year, m, 1) / DAY_MS) - cal.firstDay
    return { label, col: Math.floor((lead + idx) / 7) }
  }), [year, cal.firstDay, lead])

  const onPressGrid = (e: GestureResponderEvent) => {
    const col = Math.floor(e.nativeEvent.locationX / STEP)
    const row = Math.floor(e.nativeEvent.locationY / STEP)
    if (row < 0 || row > 6) return
    const i = col * 7 + row - lead
    if (i < 0 || i >= cal.days || (isCurrent && i > todayIdx)) return
    haptic.light()
    setSel(s => (s === i ? null : i))
  }

  // Reset the mount count in the same render as the year, so no cell of the new year
  // mounts with the old wave's timing.
  const pickYear = (y: number) => { setSel(null); setMounted(0); setYear(y) }

  // Open with this week at the right edge (a past year: on December).
  useEffect(() => {
    if (!viewW) return
    const contentW = cols * STEP
    const endCol = isCurrent ? Math.floor((lead + todayIdx) / 7) : cols - 1
    const x = Math.max(0, Math.min(contentW - viewW, (endCol + 1) * STEP - viewW))
    const raf = requestAnimationFrame(() => scroll.current?.scrollTo({ x, animated: false }))
    return () => cancelAnimationFrame(raf)
  }, [viewW, year])
  const selDay = sel === null ? null : cal.firstDay + sel

  // Which columns ripple: the ones on screen (the wave starts at the view's left edge,
  // same step and diagonal as ever). The rest are drawn in place, ready when you scroll.
  const endCol = isCurrent ? Math.floor((lead + todayIdx) / 7) : cols - 1
  const firstAnimated = viewW ? Math.max(0, endCol - (Math.ceil(viewW / STEP) + 1) + 1) : 0
  // Mount order: on-screen columns left to right, then the rest nearest-first.
  const order = useMemo(() => {
    const onScreen = Array.from({ length: endCol - firstAnimated + 1 }, (_, i) => firstAnimated + i)
    const rest = Array.from({ length: cols }, (_, c) => c).filter(c => c < firstAnimated || c > endCol)
      .sort((x, y) => Math.abs(x - endCol) - Math.abs(y - endCol))
    return { onScreen, rest, rank: new Map([...onScreen, ...rest].map((c, i) => [c, i])) }
  }, [cols, firstAnimated, endCol])

  // Mount the cells over a few frames instead of ~370 views in one go (a visible hitch
  // when the view opens): 3 on-screen columns a frame — far ahead of the wave, which
  // moves one column per 24 ms — then 8 of the rest. `startedAt` keeps the wave's
  // timing exactly as if everything had mounted at once.
  const [mounted, setMounted] = useState(0)
  const startedAt = useRef(0)
  useEffect(() => {
    if (!viewW) return
    startedAt.current = Date.now()
    setMounted(0)
    let n = 0, raf = 0
    const tick = () => {
      n += n < order.onScreen.length ? 3 : 8
      setMounted(n)
      if (n < cols) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [viewW, year, order, cols])

  return (
    <Card padded>
      <View style={styles.head}>
        <Text style={Type.overline}>{year} · every day</Text>
        <Text style={Type.caption}>{cal.activeDays} days with music</Text>
      </View>

      {years.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years} style={styles.yearsScroll}>
          {years.map(y => <Chip key={y} label={String(y)} selected={y === year} onPress={() => pickYear(y)} />)}
        </ScrollView>
      )}

      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={e => setViewW(e.nativeEvent.layout.width)}
      >
        <View>
          <View style={[styles.monthRow, { width: cols * STEP }]}>
            {months.map(m => <Text key={m.label} style={[styles.month, { left: m.col * STEP }]}>{m.label}</Text>)}
          </View>
          <Pressable
            onPress={onPressGrid}
            style={{ width: cols * STEP, height: 7 * STEP }}
            accessibilityRole="adjustable"
            accessibilityLabel={`Listening calendar for ${year}: ${cal.activeDays} days with music, longest streak ${cal.longestStreak} days`}
          >
            {viewW > 0 && (
              <View style={styles.grid} pointerEvents="none">
                {Array.from({ length: cols }, (_, col) => (
                  <HeatColumn
                    key={col} col={col} cal={cal} lead={lead} year={year}
                    limit={isCurrent ? todayIdx : cal.days - 1}
                    mounted={(order.rank.get(col) ?? 0) < mounted}
                    animated={col >= firstAnimated && col <= endCol}
                    waveCol={col - firstAnimated}
                    startedAt={startedAt.current}
                  />
                ))}
              </View>
            )}
            {sel !== null && (
              <View pointerEvents="none" style={[styles.ring, {
                left: Math.floor((lead + sel) / 7) * STEP - 2, top: ((lead + sel) % 7) * STEP - 2,
              }]} />
            )}
          </Pressable>
        </View>
      </ScrollView>

      {selDay !== null && sel !== null ? (
        <View style={styles.info}>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>{selDay === today ? 'Today' : dayTitle(selDay)}</Text>
            <Text style={Type.caption}>
              {cal.plays[sel] ? `${fmtMinutesShort(cal.ms[sel])} · ${cal.plays[sel].toLocaleString()} ${cal.plays[sel] === 1 ? 'play' : 'plays'}` : 'No music this day'}
            </Text>
          </View>
          {cal.plays[sel] > 0 && (
            <Chip label="See plays" icon="arrow-forward" onPress={() => router.push(`/history?day=${selDay}`)} />
          )}
        </View>
      ) : (
        <View style={styles.legendRow}>
          <Text style={Type.caption}>Longest streak: {cal.longestStreak} {cal.longestStreak === 1 ? 'day' : 'days'}</Text>
          <View style={styles.legend}>
            <Text style={styles.legendText}>less</Text>
            {LEVELS.map((c, i) => <View key={i} style={[styles.legendCell, { backgroundColor: c }]} />)}
            <Text style={styles.legendText}>more</Text>
          </View>
        </View>
      )}
    </Card>
  )
}

/** One week of the grid. Memoised: mounting more columns doesn't re-render these. */
const HeatColumn = React.memo(function HeatColumn({ col, cal, lead, year, limit, mounted, animated, waveCol, startedAt }: {
  col: number; cal: YearCalendar; lead: number; year: number
  /** Last day index with colour (today, in the current year). */
  limit: number
  mounted: boolean; animated: boolean; waveCol: number; startedAt: number
}) {
  if (!mounted) return <View style={styles.colSpacer} />
  return (
    <View style={styles.col}>
      {Array.from({ length: 7 }, (_, row) => {
        const i = col * 7 + row - lead
        if (i < 0 || i >= cal.days) return <View key={row} style={styles.cell} />
        const color = i > limit ? 'transparent' : LEVELS[heatLevel(cal.ms[i], cal.levels)]
        return animated
          ? <RippleCell key={row} col={waveCol} row={row} trigger={year} startedAt={startedAt} style={[styles.cell, { backgroundColor: color }]} />
          : <View key={row} style={[styles.cell, { backgroundColor: color }]} />
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  head:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Spacing.sm },
  yearsScroll: { marginBottom: Spacing.sm, marginHorizontal: -Spacing.lg },
  years:       { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  monthRow:    { height: 16 },
  month:       { position: 'absolute', top: 0, fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  grid:        { flexDirection: 'row', gap: GAP },
  col:         { gap: GAP },
  colSpacer:   { width: CELL, height: 7 * STEP - GAP },
  cell:        { width: CELL, height: CELL, borderRadius: 3 },
  ring:        { position: 'absolute', width: CELL + 4, height: CELL + 4, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.text },
  info:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md, minHeight: 36 },
  infoTitle:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  legendRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, minHeight: 36 },
  legend:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendCell:  { width: 10, height: 10, borderRadius: 2 },
  legendText:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginHorizontal: 2 },
})
