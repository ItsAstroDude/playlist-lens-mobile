import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Card, TabHeader, IconButton, ArtThumb, Button, EmptyState } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { RollingNumber, useMotionReduced } from '@/components/motion'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { cachedAsync } from '@/utils/sqlJob'
import { periodStatsJob } from '@/utils/stats'
import { storage } from '@/utils/cache'
import {
  buildPool, canPlay, firstPair, nextPair, isRight, itemKey, verdict,
  type GameItem, type Guess,
} from '@/utils/game'

const BEST_KEY = 'game.moreOrLess.best'
const REVEAL_MS = 1100

type Phase = 'loading' | 'empty' | 'start' | 'guess' | 'reveal' | 'over'

/**
 * The Play tab: "More or less", a minigame on your own listening, in Wrapped's old
 * slot while Wrapped is rebuilt (it lives in Settings › About › Labs for now).
 * Cheap to draw on purpose: two cards, no endless motion.
 */
export default function PlayTab() {
  const gutter = useNowPlayingGutter()
  const reduced = useMotionReduced()

  const [pool, setPool] = useState<GameItem[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [pair, setPair] = useState<[GameItem, GameItem] | null>(null)
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => storage.getNumber(BEST_KEY) ?? 0)
  const [lastRight, setLastRight] = useState<boolean | null>(null)
  const [newBest, setNewBest] = useState(false)
  const recent = useRef<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // All-time top songs and artists, cached across launches until new plays arrive.
  useEffect(() => {
    let alive = true
    cachedAsync('game.moreOrLess.pool', 'top120', () => periodStatsJob('all', { topN: 120 }))
      .then(s => {
        if (!alive) return
        const p = buildPool(s)
        setPool(p)
        setPhase(canPlay(p) ? 'start' : 'empty')
      })
      .catch(() => { if (alive) setPhase('empty') })
    return () => { alive = false }
  }, [])

  const start = useCallback(() => {
    const p = firstPair(pool)
    if (!p) { setPhase('empty'); return }
    haptic.medium()
    recent.current = [itemKey(p[0]), itemKey(p[1])]
    setPair(p); setScore(0); setRound(r => r + 1); setLastRight(null); setNewBest(false)
    setPhase('guess')
  }, [pool])

  const guess = useCallback((g: Guess) => {
    if (phase !== 'guess' || !pair) return
    const right = isRight(g, pair[0], pair[1])
    setLastRight(right)
    setPhase('reveal')
    if (right) {
      const s = score + 1
      setScore(s)
      if (s % 5 === 0) haptic.heavy(); else haptic.success()
      timer.current = setTimeout(() => {
        const next = nextPair(pool, pair[1], recent.current)
        if (!next) { setPhase('over'); return }
        recent.current = [...recent.current, itemKey(next[1])].slice(-12)
        setPair(next); setRound(r => r + 1); setLastRight(null)
        setPhase('guess')
      }, REVEAL_MS)
    } else {
      haptic.error()
      timer.current = setTimeout(() => {
        if (score > best) { storage.set(BEST_KEY, score); setBest(score); setNewBest(true) }
        setPhase('over')
      }, REVEAL_MS)
    }
  }, [phase, pair, pool, score, best])

  const enterDown = reduced ? undefined : FadeInDown.springify().mass(1).damping(15).stiffness(170)
  const enterUp = reduced ? undefined : FadeInUp.springify().mass(1).damping(15).stiffness(170)

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TabHeader
          title="play"
          subtitle="How well do you know your own listening?"
          titleRight={
            <>
              <IconButton icon="time-outline" label="History: every play, searchable, by day" onPress={() => router.push('/history')} />
              <IconButton icon="albums-outline" label="Recaps: past weeks, months, seasons and years" onPress={() => router.push('/recaps')} />
            </>
          }
        />

        <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 130 + gutter, gap: Spacing.md }}
          showsVerticalScrollIndicator={false}>

          {/* The construction wall: Wrapped is being rebuilt, still reachable in Labs. */}
          <Pressable onPress={() => { haptic.light(); router.push('/wrapped') }} accessibilityRole="button"
            accessibilityLabel="Wrapped is being rebuilt. Open the work-in-progress version">
            <View style={styles.wall}>
              <View style={styles.tape} />
              <View style={styles.wallRow}>
                <Icon name="construct-outline" size={18} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.wallTitle}>Wrapped is being rebuilt</Text>
                  <Text style={styles.wallBody}>We're making it smooth. The work-in-progress version is in Labs, or tap here.</Text>
                </View>
                <Icon name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
            </View>
          </Pressable>

          {phase === 'loading' && (
            <View style={styles.center}><ActivityIndicator color={Colors.greenPrimary} /></View>
          )}

          {phase === 'empty' && (
            <EmptyState icon="game-controller-outline" title="Not enough listening yet"
              body="More or less needs a few songs you've played more than once. Turn on tracking in Settings, or import your Spotify history in Labs › Wrapped." />
          )}

          {phase === 'start' && (
            <Card padded>
              <Text style={styles.gameTitle}>More or less</Text>
              <Text style={styles.rules}>
                Two of your songs, or two of your artists. You know how often you played the first one.
                Did you play the second one more or less? Keep going until you get one wrong.
              </Text>
              {best > 0 && <Text style={styles.best}>Your best: {best}</Text>}
              <Button label="Play" icon="play" onPress={start} />
            </Card>
          )}

          {(phase === 'guess' || phase === 'reveal') && pair && (
            <>
              <View style={styles.scoreRow}>
                <RollingNumber value={String(score)} style={styles.score} />
                <Text style={styles.scoreLabel}>right · best {Math.max(best, score)}</Text>
              </View>

              <Animated.View key={`k${round}`} entering={enterUp}>
                <GameCard item={pair[0]} reveal />
              </Animated.View>

              <Text style={styles.question}>
                Did you play this {pair[1].kind === 'artist' ? 'artist' : 'song'} more or less?
              </Text>

              <Animated.View key={`c${round}`} entering={enterDown}>
                <GameCard item={pair[1]} reveal={phase === 'reveal'} result={phase === 'reveal' ? lastRight : null} />
              </Animated.View>

              <View style={styles.buttons}>
                <GuessButton label="Less" icon="arrow-down" disabled={phase !== 'guess'} onPress={() => guess('less')} />
                <GuessButton label="More" icon="arrow-up" disabled={phase !== 'guess'} onPress={() => guess('more')} />
              </View>
            </>
          )}

          {phase === 'over' && (
            <Animated.View entering={enterDown}>
              <Card padded>
                <Text style={styles.overLabel}>{newBest ? 'New best!' : 'Game over'}</Text>
                <RollingNumber value={String(score)} style={styles.bigScore} />
                <Text style={styles.rules}>{verdict(score)}</Text>
                {pair && (
                  <Text style={styles.answer}>
                    {pair[1].name} has {pair[1].plays} plays, {pair[0].name} has {pair[0].plays}.
                  </Text>
                )}
                <Button label="Play again" icon="refresh" onPress={start} />
              </Card>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function GameCard({ item, reveal, result = null }: { item: GameItem; reveal: boolean; result?: boolean | null }) {
  const tone = result === true ? Colors.greenPrimary : result === false ? Colors.error : null
  return (
    <View style={[styles.card, tone && { borderColor: alpha(tone, 0.8), backgroundColor: alpha(tone, 0.1) }]}>
      <ArtThumb kind={item.kind} name={item.name} artist={item.kind === 'track' ? item.sub : undefined} size={64} />
      <View style={{ flex: 1 }}>
        <Text style={styles.kind}>{item.kind === 'artist' ? 'ARTIST' : 'SONG'}</Text>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        {!!item.sub && <Text style={styles.sub} numberOfLines={1}>{item.sub}</Text>}
      </View>
      <View style={styles.playsBox}>
        {reveal
          ? <RollingNumber value={String(item.plays)} style={[styles.plays, tone && { color: tone }]} />
          : <Text style={styles.plays}>?</Text>}
        <Text style={styles.playsLabel}>plays</Text>
      </View>
    </View>
  )
}

function GuessButton({ label, icon, onPress, disabled }: { label: string; icon: 'arrow-up' | 'arrow-down'; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.guess, disabled && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.97 }] }]}>
      <Icon name={icon} size={20} color={Colors.text} />
      <Text style={styles.guessText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  safe:      { flex: 1 },
  center:    { paddingVertical: Spacing.xl, alignItems: 'center' },

  wall:      { borderRadius: Radius.lg, borderWidth: 1, borderColor: alpha(Colors.warning, 0.45), backgroundColor: alpha(Colors.warning, 0.08), overflow: 'hidden' },
  tape:      { height: 6, backgroundColor: alpha(Colors.warning, 0.55) },
  wallRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  wallTitle: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  wallBody:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  gameTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1 },
  rules:     { fontFamily: FontFamily.mono, fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.5, color: Colors.textMuted, marginVertical: Spacing.sm },
  best:      { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.greenPrimary, marginBottom: Spacing.sm },

  scoreRow:  { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  score:     { fontFamily: FontFamily.syneBold, fontSize: FontSize['3xl'], color: Colors.text },
  scoreLabel:{ fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },

  card:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg,
               borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass },
  kind:      { fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted },
  name:      { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  sub:       { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  playsBox:  { alignItems: 'flex-end', minWidth: 56 },
  plays:     { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text },
  playsLabel:{ fontFamily: FontFamily.mono, fontSize: 10, color: Colors.textMuted },

  question:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'center' },
  buttons:   { flexDirection: 'row', gap: Spacing.md },
  guess:     { flex: 1, height: 56, borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
               backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder },
  guessText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },

  overLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, letterSpacing: 2, color: Colors.textMuted, textTransform: 'uppercase' },
  bigScore:  { fontFamily: FontFamily.syneBold, fontSize: 56, color: Colors.text },
  answer:    { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
})
