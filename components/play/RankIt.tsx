import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { ArtThumb, Button, Card, EmptyState } from '@/components/ui'
import { cachedAsync } from '@/utils/sqlJob'
import { periodStatsJob, type Ranked } from '@/utils/stats'
import { storage } from '@/utils/cache'
import { dayKey, dragSlot, moveItem, rankAnswer, rankFive, rankScore, seeded, type RankItem } from '@/utils/games'
import { ScoreLine, g } from './shared'

const ROW = 72          // row height + gap
const DAY_KEY = 'game.rank.day'
const BEST_KEY = 'game.rank.best'
type Phase = 'loading' | 'empty' | 'start' | 'rank' | 'done'

/**
 * Rank it (2.0.39): five of your artists, the same five all day. Drag them into the
 * order you played them this year (all time when the year is still thin), lock it in,
 * and see the real counts. After today's, "another five" is just for practice.
 */
export function RankIt({ onStart }: { onStart?: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [order, setOrder] = useState<RankItem[]>([])
  const [scope, setScope] = useState<'this year' | 'all time'>('this year')
  const [daily, setDaily] = useState(true)
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const [best, setBest] = useState(() => storage.getNumber(BEST_KEY) ?? 0)
  const today = dayKey()
  const [played, setPlayed] = useState<number | null>(() => {
    try { const v = JSON.parse(storage.getString(DAY_KEY) ?? 'null'); return v?.day === today ? v.score : null } catch { return null }
  })
  const [pool, setPool] = useState<{ year: Ranked[]; all: Ranked[] } | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      cachedAsync('game.rank.year', 'top30', () => periodStatsJob('year', { topN: 30 })),
      cachedAsync('game.rank.all', 'top30', () => periodStatsJob('all', { topN: 30 })),
    ]).then(([y, a]) => {
      if (!alive) return
      setPool({ year: y.topArtists, all: a.topArtists })
    }).catch(() => { if (alive) setPhase('empty') })
    return () => { alive = false }
  }, [])

  const deal = useCallback((rand: () => number, isDaily: boolean) => {
    if (!pool) return
    let five = rankFive(pool.year, rand), sc: 'this year' | 'all time' = 'this year'
    if (!five) { five = rankFive(pool.all, rand); sc = 'all time' }
    if (!five) { setPhase('empty'); return }
    setOrder(five); setScope(sc); setDaily(isDaily); setPhase('rank')
  }, [pool])
  useEffect(() => { if (pool) setPhase(rankFive(pool.year) || rankFive(pool.all) ? 'start' : 'empty') }, [pool])
  const begin = useCallback(() => {
    haptic.medium()
    onStart?.()
    if (played == null) deal(seeded(today), true); else deal(Math.random, false)
  }, [played, deal, today, onStart])

  const lock = useCallback(() => {
    const s = rankScore(order)
    if (s === 5) haptic.heavy(); else if (s >= 3) haptic.success(); else haptic.warning()
    if (daily) { storage.set(DAY_KEY, JSON.stringify({ day: today, score: s })); setPlayed(s) }
    if (s > best) { storage.set(BEST_KEY, s); setBest(s) }
    setPhase('done')
  }, [order, daily, best, today])

  const onDrop = useCallback((from: number, to: number) => {
    setDrag(null)
    if (from !== to) { haptic.light(); setOrder(o => moveItem(o, from, to)) }
  }, [])
  const onHover = useCallback((from: number, to: number) => {
    setDrag(d => (d && d.from === from && d.to === to ? d : { from, to }))
  }, [])
  const nudge = useCallback((i: number, by: number) => {
    setOrder(o => moveItem(o, i, i + by))
  }, [])

  if (phase === 'loading') return <View style={g.center}><ActivityIndicator color={Colors.greenPrimary} /></View>
  if (phase === 'empty') {
    return <EmptyState icon="podium-outline" title="Not enough artists yet"
      body="Rank it needs five artists you've played different amounts. Turn on tracking in Settings, or import your history in Labs › Wrapped." />
  }

  if (phase === 'start') {
    return (
      <Card padded>
        <Text style={g.title}>Rank it</Text>
        <Text style={g.rules}>
          Five of your artists, a new five every day. Put them in order of how much you played them this year, then see the real counts.
        </Text>
        {played != null
          ? <Text style={g.best}>Today's: {played} / 5 · a new five tomorrow</Text>
          : best > 0 ? <Text style={g.best}>Your best: {best} / 5</Text> : null}
        <Button label={played != null ? 'Practice five' : 'Play today\'s five'} icon="play" onPress={begin} />
      </Card>
    )
  }

  const done = phase === 'done'
  const right = rankAnswer(order)
  const s = rankScore(order)
  return (
    <View style={{ gap: Spacing.md }}>
      <ScoreLine left={daily ? 'TODAY\'S FIVE' : 'PRACTICE FIVE'} right={done ? `${s} / 5 right` : best ? `best: ${best} / 5` : ''} />
      <Text style={g.question}>Put them in order. Who did you play most {scope}?</Text>
      <View style={{ height: ROW * order.length - Spacing.sm }}>
        {order.map((it, i) => (
          <RankRow key={it.name} item={it} index={i} count={order.length}
            slot={dragSlot(i, drag?.from ?? null, drag?.to ?? null)}
            locked={done} rightIndex={right.findIndex(x => x.name === it.name)}
            onHover={onHover} onDrop={onDrop} onNudge={nudge} />
        ))}
      </View>
      {done ? (
        <>
          <Text style={g.rules}>{s === 5 ? 'All five. You know exactly who you listen to.' : s >= 3 ? 'Close. The numbers are on the right.' : 'Surprised? The numbers are on the right.'}</Text>
          <Button label={played != null && daily ? 'Another five (practice)' : 'Another five'} icon="shuffle" variant="secondary"
            onPress={() => { haptic.light(); deal(Math.random, false) }} />
        </>
      ) : (
        <>
          <Button label="Lock it in" icon="lock-closed" onPress={lock} />
          <Text style={g.foot}>{daily ? 'a new five every day · then it shows your real play counts' : 'just for practice · today\'s score is saved'}</Text>
        </>
      )}
    </View>
  )
}

function RankRow({ item, index, count, slot, locked, rightIndex, onHover, onDrop, onNudge }: {
  item: RankItem; index: number; count: number; slot: number; locked: boolean; rightIndex: number
  onHover: (from: number, to: number) => void; onDrop: (from: number, to: number) => void; onNudge: (i: number, by: number) => void
}) {
  const top = useSharedValue(index * ROW)
  const dy = useSharedValue(0)
  const lifted = useSharedValue(0)
  // Where it sits: its own slot, or making room for a row being dragged.
  useEffect(() => { top.value = withSpring(slot * ROW, Spring.snappy) }, [slot])

  const pan = Gesture.Pan().enabled(!locked).minDistance(0)
    .onStart(() => { lifted.value = withSpring(1, Spring.snappy) })
    .onUpdate(e => {
      dy.value = e.translationY
      const to = Math.max(0, Math.min(count - 1, index + Math.round(e.translationY / ROW)))
      runOnJS(onHover)(index, to)
    })
    .onEnd(e => {
      const to = Math.max(0, Math.min(count - 1, index + Math.round(e.translationY / ROW)))
      // Hand the finger offset to `top`, so the row springs from where it was let go.
      top.value = top.value + dy.value
      dy.value = 0
      lifted.value = withSpring(0, Spring.snappy)
      runOnJS(onDrop)(index, to)
    })
  const style = useAnimatedStyle(() => ({
    top: top.value + dy.value,
    zIndex: lifted.value > 0.01 ? 10 : 1,
    transform: [{ scale: 1 + lifted.value * 0.03 }, { rotate: `${-lifted.value * 1.5}deg` }],
    shadowOpacity: lifted.value * 0.5,
  }))

  const ok = locked && rightIndex === index
  return (
    <Animated.View style={[styles.row, locked && (ok ? g.optionRight : g.optionWrong), style]}
      accessible accessibilityRole="adjustable"
      accessibilityLabel={`${index + 1}. ${item.name}${locked ? `, ${item.plays} plays, ${ok ? 'right' : `really number ${rightIndex + 1}`}` : ''}`}
      accessibilityActions={locked ? [] : [{ name: 'increment', label: 'Move up' }, { name: 'decrement', label: 'Move down' }]}
      onAccessibilityAction={e => onNudge(index, e.nativeEvent.actionName === 'increment' ? -1 : 1)}>
      <Text style={styles.num}>{index + 1}</Text>
      <ArtThumb kind="artist" name={item.name} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={g.optionName} numberOfLines={1}>{item.name}</Text>
        <Text style={g.optionSub}>{locked ? (ok ? 'right' : `really #${rightIndex + 1}`) : 'artist'}</Text>
      </View>
      {locked
        ? <Text style={[styles.plays, { color: ok ? Colors.greenPrimary : Colors.textSecondary }]}>{item.plays.toLocaleString()}</Text>
        : (
          <GestureDetector gesture={pan}>
            <View style={styles.handle} hitSlop={8} accessibilityElementsHidden>
              <Ionicons name="reorder-three" size={24} color={Colors.textMuted} />
            </View>
          </GestureDetector>
        )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row:    {
    position: 'absolute', left: 0, right: 0, height: ROW - Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingLeft: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowRadius: 20, elevation: 0,
  },
  num:    { width: 18, fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.textMuted },
  plays:  { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, marginRight: Spacing.lg },
  handle: { width: 52, height: '100%', alignItems: 'center', justifyContent: 'center' },
})

