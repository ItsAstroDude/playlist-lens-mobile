import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { ArtThumb, Button, Card, Chip, EmptyState } from '@/components/ui'
import { cachedAsync, runAsync } from '@/utils/sqlJob'
import { localOffsetSec, periodStatsJob, yearsWithPlays, type Ranked } from '@/utils/stats'
import { storage } from '@/utils/cache'
import { MONTHS, WHEN_ROUNDS, whenPoints, whenRoundsJob, whenVerdict, type WhenRound } from '@/utils/games'
import { ScoreLine, g } from './shared'

const BEST_KEY = 'game.when.best'
type Phase = 'loading' | 'empty' | 'start' | 'round' | 'over'

/**
 * When? (2.0.39): one of your songs — which month were you most into it? Pick a year and
 * a month; the right month is 200, every month off costs 40. Five songs. Reads tracked
 * and imported plays (the more history, the better the game).
 */
export function WhenGame({ onStart }: { onStart?: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [top, setTop] = useState<Ranked[]>([])
  const [rounds, setRounds] = useState<WhenRound[]>([])
  const [i, setI] = useState(0)
  const [year, setYear] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => storage.getNumber(BEST_KEY) ?? 0)
  const years = useMemo(() => { try { return yearsWithPlays().slice().reverse() } catch { return [] } }, [])

  useEffect(() => {
    let alive = true
    cachedAsync('game.when.pool', 'top150', () => periodStatsJob('all', { topN: 150 }))
      .then(s => { if (!alive) return; setTop(s.topTracks); setPhase(s.topTracks.filter(t => t.plays >= 6).length >= 3 ? 'start' : 'empty') })
      .catch(() => { if (alive) setPhase('empty') })
    return () => { alive = false }
  }, [])

  const start = useCallback(async () => {
    haptic.medium()
    onStart?.()
    setPhase('loading')
    try {
      const rs = await runAsync(whenRoundsJob(top, localOffsetSec(), WHEN_ROUNDS))
      if (rs.length < 3) { setPhase('empty'); return }
      setRounds(rs); setI(0); setScore(0); setLocked(false); setMonth(null)
      setYear(years[years.length - 1] ?? null)
      setPhase('round')
    } catch { setPhase('empty') }
  }, [top, years, onStart])

  const r = rounds[i]
  const pts = r && year != null && month != null ? whenPoints({ y: year, m: month }, r.peak) : 0
  const lock = useCallback(() => {
    if (!r || year == null || month == null) return
    if (pts >= 160) haptic.success(); else if (pts > 0) haptic.light(); else haptic.warning()
    setScore(s => s + pts)
    setLocked(true)
  }, [r, year, month, pts])

  const next = useCallback(() => {
    if (i + 1 >= rounds.length) {
      if (score > best) { storage.set(BEST_KEY, score); setBest(score) }
      setPhase('over')
      return
    }
    haptic.light()
    setI(i + 1); setLocked(false); setMonth(null)
  }, [i, rounds, score, best])

  if (phase === 'loading') return <View style={g.center}><ActivityIndicator color={Colors.greenPrimary} /></View>
  if (phase === 'empty') {
    return <EmptyState icon="calendar-outline" title="Not enough history yet"
      body="When? needs songs you've played a few times across months. Import your Spotify history in Labs › Wrapped to get the most out of it." />
  }
  if (phase === 'start') {
    return (
      <Card padded>
        <Text style={g.title}>When?</Text>
        <Text style={g.rules}>
          One of your songs. Which month were you most into it? The right month is 200 points, and every month off costs 40. Five songs.
        </Text>
        {best > 0 && <Text style={g.best}>Your best: {best}</Text>}
        <Button label="Play" icon="play" onPress={start} />
      </Card>
    )
  }
  if (phase === 'over') {
    const of = rounds.length * 200
    return (
      <Card padded>
        <Text style={g.overline}>{score >= best && score > 0 ? 'NEW BEST' : 'DONE'}</Text>
        <Text style={g.bigScore}>{score}</Text>
        <Text style={g.rules}>out of {of}. {whenVerdict(score, of)}</Text>
        <Button label="Play again" icon="refresh" onPress={start} />
      </Card>
    )
  }

  return (
    <View style={{ gap: Spacing.md }}>
      <ScoreLine left={`ROUND ${i + 1} OF ${rounds.length}`} right={`${score} pts`} />
      <View style={[g.panel, styles.song]}>
        <ArtThumb kind="track" name={r.name} artist={r.artist} size={88} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.songName} numberOfLines={2}>{r.name}</Text>
          <Text style={g.optionSub} numberOfLines={1}>{r.artist} · {r.plays} plays</Text>
        </View>
      </View>
      <Text style={g.question}>When were you most into this song?</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
        {years.map(y => <Chip key={y} label={String(y)} selected={y === year} onPress={locked ? undefined : () => setYear(y)} />)}
      </ScrollView>

      <View style={styles.months} accessibilityRole="radiogroup" accessibilityLabel="Month">
        {MONTHS.map((m, k) => {
          const isPick = k === month
          const isAns = locked && year != null && r.peak.y === year && r.peak.m === k
          return (
            <Pressable key={m} onPress={() => { if (!locked) { haptic.light(); setMonth(k) } }} disabled={locked}
              style={[styles.month, isPick && styles.monthPick, isAns && styles.monthAns, locked && isPick && !isAns && styles.monthWrong]}
              accessibilityRole="radio" accessibilityState={{ selected: isPick, disabled: locked }} accessibilityLabel={`${m} ${year ?? ''}`}>
              <Text style={[styles.monthText, (isPick || isAns) && styles.monthTextOn]}>{m}</Text>
            </Pressable>
          )
        })}
      </View>

      {locked ? (
        <>
          <Reveal r={r} pts={pts} />
          <Button label={i + 1 >= rounds.length ? 'See your score' : 'Next song'} icon="arrow-forward" onPress={next} />
        </>
      ) : (
        <>
          <Button label="Lock it in" icon="lock-closed" onPress={lock} disabled={year == null || month == null} />
          <Text style={g.foot}>right month = 200 · each month off costs 40 · uses your tracked + imported plays</Text>
        </>
      )}
    </View>
  )
}

/** The answer, and the song's year around it as little bars. */
function Reveal({ r, pts }: { r: WhenRound; pts: number }) {
  const inYear = MONTHS.map((_, m) => r.months.find(x => x.y === r.peak.y && x.m === m)?.n ?? 0)
  const max = Math.max(1, ...inYear)
  const n = inYear[r.peak.m]
  return (
    <View style={[g.panel, { gap: Spacing.md }]} accessible
      accessibilityLabel={`${MONTHS[r.peak.m]} ${r.peak.y}, ${n} plays that month. ${pts} points.`}>
      <View style={styles.revealHead}>
        <Text style={styles.revealWhen}>{MONTHS[r.peak.m]} {r.peak.y}</Text>
        <Text style={[styles.revealPts, { color: pts >= 160 ? Colors.greenPrimary : pts > 0 ? '#FFB347' : Colors.error }]}>+{pts}</Text>
      </View>
      <View style={styles.bars}>
        {inYear.map((v, m) => (
          <View key={m} style={styles.barCol}>
            <View style={[styles.bar, { height: 4 + 44 * (v / max), backgroundColor: m === r.peak.m ? Colors.greenPrimary : alpha(Colors.text, 0.18) }]} />
            <Text style={styles.barLabel}>{MONTHS[m][0]}</Text>
          </View>
        ))}
      </View>
      <Text style={g.optionSub}>{n} plays that month · {r.peak.y}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  song:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  songName:   { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg + 2, color: Colors.text, letterSpacing: -0.5 },
  years:      { gap: Spacing.sm, paddingVertical: 2 },
  months:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  month:      { width: '14.5%', flexGrow: 1, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass },
  monthPick:  { borderColor: alpha(Colors.text, 0.8), backgroundColor: alpha(Colors.text, 0.12) },
  monthAns:   { borderColor: Colors.greenPrimary, backgroundColor: alpha(Colors.greenPrimary, 0.2) },
  monthWrong: { borderColor: alpha(Colors.error, 0.7), backgroundColor: alpha(Colors.error, 0.1) },
  monthText:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  monthTextOn: { color: Colors.text },
  revealHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  revealWhen: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text },
  revealPts:  { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl },
  bars:       { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64 },
  barCol:     { flex: 1, alignItems: 'center', gap: 4 },
  bar:        { width: '100%', borderRadius: 3 },
  barLabel:   { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.textMuted },
})
