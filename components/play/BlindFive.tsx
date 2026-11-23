import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { ArtThumb, Button, Card, EmptyState } from '@/components/ui'
import { useMotionReduced } from '@/components/motion'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { cachedAsync } from '@/utils/sqlJob'
import { periodStatsJob } from '@/utils/stats'
import { storage } from '@/utils/cache'
import { classifyPlaybackError, pausePlayback, playAt, transportErrorMessage } from '@/utils/playback'
import {
  BLIND_ROUNDS, CLIP_MS, blindPoints, blindPool, blindRounds, blindVerdict, canPlayBlind, clipStart,
  type BlindRound, type BlindSong,
} from '@/utils/games'
import { ScoreLine, g } from './shared'

const BEST_KEY = 'game.blind.best'
type Phase = 'loading' | 'empty' | 'start' | 'round' | 'over' | 'error'
type Clip = 'starting' | 'playing' | 'done'

/**
 * Blind five (2.0.39): a few seconds of one of your top songs, from a random spot, on
 * your Spotify (Premium, like every remote control in the app). Pick it from four;
 * right = 100, plus up to 100 for speed. Ten rounds. When it's over you can go back to
 * the song you were playing before, where you left it.
 */
export function BlindFive({ onStart }: { onStart?: () => void }) {
  const { np } = useNowPlaying()
  const [pool, setPool] = useState<BlindSong[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [rounds, setRounds] = useState<BlindRound[]>([])
  const [i, setI] = useState(0)
  const [clip, setClip] = useState<Clip>('starting')
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [right, setRight] = useState(0)
  const [streak, setStreak] = useState(0)
  const [replayed, setReplayed] = useState(false)
  const [best, setBest] = useState(() => storage.getNumber(BEST_KEY) ?? 0)
  const [error, setError] = useState('')
  const t0 = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const before = useRef<{ uri: string; name: string; ms: number } | null>(null)
  // Leaving mid-clip (back to all games): stop the clip too.
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); pausePlayback().catch(() => {}) } }, [])

  useEffect(() => {
    let alive = true
    cachedAsync('game.blind.pool', 'top100', () => periodStatsJob('all', { topN: 100 }))
      .then(s => { if (!alive) return; const p = blindPool(s.topTracks); setPool(p); setPhase(canPlayBlind(p) ? 'start' : 'empty') })
      .catch(() => { if (alive) setPhase('empty') })
    return () => { alive = false }
  }, [])

  const play = useCallback(async (r: BlindRound, again = false) => {
    if (timer.current) clearTimeout(timer.current)
    setClip('starting')
    try {
      await playAt(r.answer.uri, clipStart())
    } catch (err) {
      haptic.warning()
      setError(transportErrorMessage(classifyPlaybackError(err)))
      setPhase('error')
      return
    }
    if (!again) t0.current = Date.now()
    setClip('playing')
    timer.current = setTimeout(() => { timer.current = null; pausePlayback().catch(() => {}); setClip('done') }, CLIP_MS)
  }, [])

  const start = useCallback(() => {
    haptic.medium()
    onStart?.()
    // Remember what was on, to offer it back at the end.
    if (np?.item && np.type === 'track' && np.item.uri) {
      const ms = (np.progress_ms ?? 0) + (np.is_playing ? Date.now() - (np.receivedAt ?? Date.now()) : 0)
      before.current = { uri: np.item.uri, name: np.item.name, ms }
    }
    const rs = blindRounds(pool, BLIND_ROUNDS)
    setRounds(rs); setI(0); setScore(0); setRight(0); setStreak(0); setPicked(null); setReplayed(false)
    setPhase('round')
    play(rs[0])
  }, [pool, np, play, onStart])

  const r = rounds[i]
  const answer = useCallback((s: BlindSong) => {
    if (!r || picked) return
    const ok = s.uri === r.answer.uri
    const ms = t0.current ? Date.now() - t0.current : 0
    const pts = blindPoints(ok, ms)
    setPicked(s.uri)
    setScore(x => x + pts)
    if (ok) { haptic.success(); setRight(x => x + 1); setStreak(x => x + 1) } else { haptic.error(); setStreak(0) }
  }, [r, picked])

  const next = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (i + 1 >= rounds.length) {
      pausePlayback().catch(() => {})
      setClip('done')
      if (score > best) { storage.set(BEST_KEY, score); setBest(score) }
      setPhase('over')
      return
    }
    haptic.light()
    setI(i + 1); setPicked(null); setReplayed(false)
    play(rounds[i + 1])
  }, [i, rounds, score, best, play])

  const backTo = useCallback(async () => {
    const b = before.current
    if (!b) return
    haptic.light()
    try { await playAt(b.uri, b.ms) } catch {}
    before.current = null
  }, [])

  if (phase === 'loading') return <View style={g.center}><ActivityIndicator color={Colors.greenPrimary} /></View>
  if (phase === 'empty') {
    return <EmptyState icon="musical-notes-outline" title="Not enough songs yet"
      body="Blind five plays your own top songs. Turn on tracking in Settings, or import your Spotify history in Labs › Wrapped." />
  }
  if (phase === 'start' || phase === 'error') {
    return (
      <Card padded>
        <Text style={g.title}>Blind five</Text>
        <Text style={g.rules}>
          Five seconds of one of your top songs, from a random spot, on your Spotify. Which one is it?
          Ten songs; the faster you know, the more points.
        </Text>
        {phase === 'error'
          ? <Text style={[g.rules, { color: Colors.error }]}>{error}</Text>
          : <Text style={g.optionSub}>Needs Spotify Premium and Spotify open on one of your devices. It takes over what's playing; you can go back to it after.</Text>}
        {best > 0 && <Text style={[g.best, { marginTop: Spacing.sm }]}>Your best: {best}</Text>}
        <Button label={phase === 'error' ? 'Try again' : 'Play'} icon="play" onPress={start} style={{ marginTop: Spacing.sm }} />
      </Card>
    )
  }
  if (phase === 'over') {
    return (
      <Card padded>
        <Text style={g.overline}>{score >= best && score > 0 ? 'NEW BEST' : 'DONE'}</Text>
        <Text style={g.bigScore}>{score}</Text>
        <Text style={g.rules}>{right} of {rounds.length} right. {blindVerdict(right, rounds.length)}</Text>
        <View style={{ gap: Spacing.sm }}>
          <Button label="Play again" icon="refresh" onPress={start} />
          {before.current && <Button label={`Back to ${before.current.name}`} icon="play-back" variant="secondary" onPress={backTo} />}
        </View>
      </Card>
    )
  }

  // ── a round ──
  return (
    <View style={{ gap: Spacing.md }}>
      <ScoreLine left={`ROUND ${i + 1} OF ${rounds.length}`} right={`${streak > 1 ? `🔥 ${streak} in a row · ` : ''}${score} pts`} />
      <View style={[g.panel, styles.stage]}>
        {picked
          ? <ArtThumb kind="track" name={r.answer.name} artist={r.answer.artist} size={140} />
          : <View style={styles.hidden}><Text style={styles.q}>?</Text></View>}
        <Wave on={clip === 'playing'} />
        <Text style={g.optionSub}>
          {clip === 'starting' ? 'starting it on your Spotify…' : clip === 'playing' ? 'playing on your Spotify' : picked ? `${r.answer.name} · ${r.answer.artist}` : 'that was it. Which one?'}
        </Text>
        {clip === 'done' && !picked && !replayed && (
          <Pressable onPress={() => { setReplayed(true); play(r, true) }} hitSlop={8} accessibilityRole="button">
            <Text style={styles.again}>↺ hear another bit</Text>
          </Pressable>
        )}
      </View>
      <View style={{ gap: Spacing.sm }}>
        {r.options.map(o => {
          const isAns = o.uri === r.answer.uri
          const state = !picked ? null : isAns ? 'right' : o.uri === picked ? 'wrong' : null
          return (
            <Pressable key={o.uri} onPress={() => answer(o)} disabled={!!picked}
              style={[g.option, state === 'right' && g.optionRight, state === 'wrong' && g.optionWrong]}
              accessibilityRole="button" accessibilityLabel={`${o.name} by ${o.artist}`}
              accessibilityState={{ disabled: !!picked, selected: o.uri === picked }}>
              <Text style={g.optionName} numberOfLines={1}>{o.name}</Text>
              <Text style={g.optionSub} numberOfLines={1}>{o.artist}{picked && isAns ? ` · ${o.plays} plays` : ''}</Text>
            </Pressable>
          )
        })}
      </View>
      {picked
        ? <Button label={i + 1 >= rounds.length ? 'See your score' : 'Next song'} icon="arrow-forward" onPress={next} />
        : <Text style={g.foot}>one of your top 100 songs, from a random spot · faster = more points</Text>}
    </View>
  )
}

/** Bars that dance while the clip plays; still otherwise (and with reduced motion). */
function Wave({ on }: { on: boolean }) {
  const reduced = useMotionReduced()
  const t = useSharedValue(0)
  useEffect(() => {
    if (on && !reduced) t.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false)
    else { cancelAnimation(t); t.value = 0 }
  }, [on, reduced])
  return (
    <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 16 }, (_, k) => <Bar key={k} k={k} t={t} on={on} />)}
    </View>
  )
}

function Bar({ k, t, on }: { k: number; t: SharedValue<number>; on: boolean }) {
  const base = [14, 30, 46, 22, 58, 36, 18, 44, 28, 52, 20, 38, 12, 34, 48, 24][k]
  const style = useAnimatedStyle(() => ({
    height: on ? base * (0.35 + 0.65 * Math.abs(Math.sin(t.value * Math.PI * 2 + k * 0.7))) : Math.max(6, base * 0.3),
  }))
  return <Animated.View style={[styles.bar, { opacity: on ? 1 : 0.35 }, style]} />
}

const styles = StyleSheet.create({
  stage:  { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  hidden: { width: 140, height: 140, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  q:      { fontFamily: FontFamily.syneBold, fontSize: 64, color: 'rgba(255,255,255,0.2)' },
  wave:   { height: 60, flexDirection: 'row', alignItems: 'center', gap: 4 },
  bar:    { width: 6, borderRadius: 3, backgroundColor: Colors.greenPrimary },
  again:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textSecondary },
})
