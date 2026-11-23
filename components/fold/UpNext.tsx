import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector, type ComposedGesture, type GestureType } from 'react-native-gesture-handler'
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { pokeNowPlaying } from '@/hooks/useNowPlaying'
import { skipNext, classifyPlaybackError, transportErrorMessage } from '@/utils/playback'
import { showToast } from '@/utils/dialog'
import {
  deckCards, dropSong, fetchUpNext, inLabel, onDropped, skipsTo, startsIn, visibleQueue,
  type UpNextTrack,
} from '@/utils/upNext'
import { fmtClock, type useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'

type Model = ReturnType<typeof useNowPlayingModel>

/**
 * Half-folded "up next" (2.0.28): the two C+D layouts from the design board.
 *  · Standing half (UpNextTop): the song big, then what's next as covers that shrink
 *    away to the right, each with when it starts.
 *  · Flat half: the next song as a card you swipe — left drops it (skipped when it comes
 *    up), right keeps it (shows the one after), up plays it now (skips ahead to it).
 *      'strip' (C+D 1, the one kept): card + ✕ / Play now / ✓, and a touch strip under it
 *      (tap = play/pause, swipe left = next, right = previous). C+D 2 removed in 2.0.36.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Data

export type UpNextState =
  | { status: 'loading' }
  | { status: 'server' | 'error' }
  | { status: 'ok'; queue: UpNextTrack[] }

/** Spotify's queue while the view is up: on open, on every song change, after an action. */
export function useUpNext(songId: string | null | undefined, active: boolean) {
  const [state, setState] = useState<UpNextState>({ status: 'loading' })
  const [, bump] = useState(0)
  const load = useCallback(() => {
    fetchUpNext(10).then(r => setState(r.ok ? { status: 'ok', queue: r.queue } : { status: r.reason }))
  }, [])
  useEffect(() => {
    if (!active) return
    // Spotify takes a moment to move its queue on after a song change.
    const t = setTimeout(load, songId ? 700 : 0)
    return () => clearTimeout(t)
  }, [active, songId])
  useEffect(() => onDropped(() => bump(x => x + 1)), [])
  return { state, refresh: load }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standing half

export function UpNextTop({ m, state, W, height, padTop, skipFirst }: {
  m: Model; state: UpNextState; W: number; height: number; padTop: number
  /** C+D 2 shows the next song on the pad, so the row starts after it. */
  skipFirst: boolean
}) {
  const queue = state.status === 'ok' ? visibleQueue(state.queue).filter(t => t.id !== m.item?.id) : []
  const remaining = Math.max(0, m.dur - m.liveMs)
  const starts = startsIn(queue, remaining)
  const row = queue.map((t, i) => ({ t, at: starts[i] })).slice(skipFirst ? 1 : 0, (skipFirst ? 1 : 0) + 3)
  const big = Math.round(Math.max(120, Math.min(height * 0.42, W * 0.48, 200)))
  const sizes = [0.6, 0.44, 0.31].map(k => Math.round(big * k))
  const fades = [1, 0.6, 0.35]
  return (
    <View style={[styles.top, { height, paddingTop: padTop }]}>
      <View style={styles.row}>
        {m.art ? <Image source={{ uri: m.art }} style={[styles.bigArt, { width: big, height: big }]} contentFit="cover" transition={200} />
               : <View style={[styles.bigArt, styles.artEmpty, { width: big, height: big }]} />}
        {row.map(({ t, at }, i) => (
          <View key={`${t.id}-${i}`} style={{ opacity: fades[i] }}>
            <Text style={[styles.rowLabel, i === 0 && !skipFirst && styles.rowLabelNext]}>{i === 0 && !skipFirst ? 'next ↓' : inLabel(at)}</Text>
            {t.image ? <Image source={{ uri: t.image }} style={[styles.rowArt, { width: sizes[i], height: sizes[i] }, i === 0 && !skipFirst && styles.rowArtNext]} contentFit="cover" />
                     : <View style={[styles.rowArt, styles.artEmpty, { width: sizes[i], height: sizes[i] }]} />}
          </View>
        ))}
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.overline}>{m.playing ? 'NOW PLAYING' : 'PAUSED'} · {fmtClock(m.liveMs)} / {fmtClock(m.dur)}</Text>
        <Text style={styles.title} numberOfLines={2}>{m.item?.name}</Text>
        {!!m.item?.artists?.length && <Text style={styles.artist} numberOfLines={1}>{m.item.artists.join(', ')}</Text>}
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The deck

function useDeck(state: UpNextState, m: Model, refresh: () => void) {
  const [kept, setKept] = useState<Set<string>>(() => new Set())
  // Spotify's queue can lag a song behind: never offer the song that's already playing.
  const nowId = m.item?.id ?? null
  const queue = state.status === 'ok' ? state.queue.filter(t => t.id !== nowId) : []
  // Not memoised: a drop changes the dropped set, not these inputs, and a memo kept
  // showing the dropped card (it came straight back).
  const cards = deckCards(queue, kept)
  const remaining = Math.max(0, m.dur - m.liveMs)
  const card = cards[0] ?? null
  const vq = visibleQueue(queue)
  const at = card ? startsIn(vq, remaining)[vq.findIndex(t => t.id === card.id)] ?? 0 : 0

  const drop = useCallback((t: UpNextTrack) => { haptic.medium(); dropSong(t.id) }, [])
  const keep = useCallback((t: UpNextTrack) => {
    haptic.light()
    setKept(prev => { const n = new Set(prev); if (t.id) n.add(t.id); return n })
  }, [])
  const playNow = useCallback(async (t: UpNextTrack) => {
    if (!t.id) return
    haptic.medium()
    // It's about to play: off the deck now, not after the next refresh.
    setKept(prev => { const n = new Set(prev); n.add(t.id!); return n })
    const n = skipsTo(queue, t.id)
    try {
      for (let i = 0; i < n; i++) {
        await skipNext()
        if (i < n - 1) await new Promise(r => setTimeout(r, 250))
      }
    } catch (err) {
      haptic.warning()
      showToast(transportErrorMessage(classifyPlaybackError(err)), 'alert-circle-outline')
    }
    setTimeout(() => { pokeNowPlaying(); refresh() }, 500)
  }, [queue, refresh])
  return { card, at, count: cards.length, total: vq.length, drop, keep, playNow }
}

type Deck = ReturnType<typeof useDeck>

/** The card's gestures, made by the layout so the pad can let the card go first. */
function useCardGestures(deck: Deck, W: number) {
  const x = useSharedValue(0), y = useSharedValue(0)
  const card = deck.card
  const act = useCallback((kind: 'drop' | 'keep' | 'play') => {
    if (!card) return
    if (kind === 'drop') deck.drop(card)
    else if (kind === 'keep') deck.keep(card)
    else deck.playNow(card)
  }, [card, deck])
  // New card: comes in from a little lower, on the entrance spring.
  // A new card: back to the middle and in from a little lower. Done when the new card
  // is rendered — resetting on the old card flashed it back for a frame.
  useEffect(() => { x.value = 0; y.value = 24; y.value = withSpring(0, Spring.entrance) }, [card?.id])

  const pan = Gesture.Pan()
    .enabled(!!card)
    .onUpdate(e => { x.value = e.translationX; y.value = Math.min(e.translationY, 40) })
    .onEnd(e => {
      const kind = e.translationY < -90 || e.velocityY < -900 ? 'play'
        : e.translationX < -90 || e.velocityX < -900 ? 'drop'
        : e.translationX > 90 || e.velocityX > 900 ? 'keep' : null
      if (!kind) { x.value = withSpring(0, Spring.bouncy); y.value = withSpring(0, Spring.bouncy); return }
      const tx = kind === 'drop' ? -W : kind === 'keep' ? W : x.value
      const ty = kind === 'play' ? -600 : y.value
      x.value = withTiming(tx, { duration: 200 })
      y.value = withTiming(ty, { duration: 200 }, done => {
        if (!done) return
        runOnJS(act)(kind)
      })
    })
  const tap = Gesture.Tap().enabled(!!card)   // a tap on the card does nothing (and isn't the pad's)
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${-2 + x.value / 30}deg` }],
  }))
  // Buttons do the same as the swipes, with the same fly-out.
  const fly = useCallback((kind: 'drop' | 'keep' | 'play') => {
    if (!card) return
    if (kind === 'drop') x.value = withTiming(-W, { duration: 220 }, d => { if (d) runOnJS(act)('drop') })
    else if (kind === 'keep') x.value = withTiming(W, { duration: 220 }, d => { if (d) runOnJS(act)('keep') })
    else y.value = withTiming(-600, { duration: 220 }, d => { if (d) runOnJS(act)('play') })
  }, [card, act, W])
  return { pan, tap, style, fly }
}

function DeckCard({ deck, cardStyle, gesture, compact }: {
  deck: Deck; cardStyle: ReturnType<typeof useAnimatedStyle>; gesture: GestureType | ComposedGesture; compact?: boolean
}) {
  const t = deck.card
  if (!t) return null
  const art = compact ? 96 : 120
  return (
    <View style={styles.deck}>
      <View style={[styles.ghost, styles.ghost2]} />
      <View style={[styles.ghost, styles.ghost1]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, compact && styles.cardCompact, cardStyle]}
          accessible accessibilityLabel={`Up next: ${t.name} by ${t.artists.join(', ')}, ${inLabel(deck.at)}. Swipe left to drop it, right to keep it, up to play it now.`}>
          {compact && <Text style={[styles.overline, { color: Colors.pink }]}>UP NEXT</Text>}
          {t.image ? <Image source={{ uri: t.image }} style={{ width: art, height: art, borderRadius: Radius.lg }} contentFit="cover" />
                   : <View style={[{ width: art, height: art, borderRadius: Radius.lg }, styles.artEmpty]} />}
          <View style={compact ? styles.cardTextCompact : styles.cardText}>
            <Text style={styles.cardTitle} numberOfLines={2}>{t.name}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{t.artists.join(', ')}</Text>
            <Text style={styles.cardMeta}>{inLabel(deck.at)}</Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

function DeckEmpty({ state, deck }: { state: UpNextState; deck: Deck }) {
  const text = state.status === 'loading' ? 'Looking at what\'s next…'
    : state.status === 'server' ? 'Up next shows here once the server is updated.'
    : state.status === 'error' ? 'Couldn\'t get what\'s next from Spotify.'
    : deck.total === 0 ? 'Nothing queued after this song.'
    : 'You\'ve been through the queue. It plays as you left it.'
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>
}

// ── touch strip / pad gestures: tap = play/pause, swipe = next / previous ──
function usePadGestures(m: Model, card?: { pan: GestureType; tap: GestureType }) {
  const onSwipe = useCallback((dx: number) => { haptic.light(); if (dx < 0) m.onNext(); else m.onPrev() }, [m])
  const pan = Gesture.Pan().activeOffsetX([-24, 24]).failOffsetY([-30, 30])
    .onEnd(e => { if (Math.abs(e.translationX) > 60) runOnJS(onSwipe)(e.translationX) })
  const tap = Gesture.Tap().onEnd((_e, ok) => { if (ok) runOnJS(m.onPlayPause)() })
  if (card) { pan.requireExternalGestureToFail(card.pan); tap.requireExternalGestureToFail(card.tap, card.pan) }
  return Gesture.Exclusive(pan, tap)
}

// ─────────────────────────────────────────────────────────────────────────────
// Flat half, C+D 1: deck over a touch strip

export function UpNextStrip({ m, state, refresh, W, height, padBottom }: {
  m: Model; state: UpNextState; refresh: () => void; W: number; height: number; padBottom: number
}) {
  const deck = useDeck(state, m, refresh)
  const g = useCardGestures(deck, W)
  const strip = usePadGestures(m)
  const pct = m.dur > 0 ? Math.min(m.liveMs / m.dur, 1) : 0
  return (
    <View style={[styles.flat, { height, paddingBottom: padBottom }]}>
      <View style={styles.headRow}>
        <Text style={styles.overline}>UP NEXT{deck.total ? ` · ${Math.min(deck.total - deck.count + 1, deck.total)} OF ${deck.total}` : ''}</Text>
        <Text style={styles.hint}>swipe the card ← drop · keep →</Text>
      </View>
      <View style={{ height: 168 }}>
        {deck.card ? <DeckCard deck={deck} cardStyle={g.style} gesture={Gesture.Simultaneous(g.pan, g.tap)} /> : <DeckEmpty state={state} deck={deck} />}
      </View>
      {deck.card && (
        <View style={styles.actions}>
          <Pressable onPress={() => g.fly('drop')} style={[styles.circle, styles.dropBtn]} accessibilityRole="button" accessibilityLabel={`Take ${deck.card.name} out of the queue`}>
            <Ionicons name="close" size={20} color={Colors.error} />
          </Pressable>
          <Pressable onPress={() => g.fly('play')} style={styles.playNow} accessibilityRole="button" accessibilityLabel={`Play ${deck.card.name} now`}>
            <Ionicons name="play" size={14} color={Colors.text} />
            <Text style={styles.playNowText}>Play now</Text>
          </Pressable>
          <Pressable onPress={() => g.fly('keep')} style={[styles.circle, styles.keepBtn]} accessibilityRole="button" accessibilityLabel={`Keep ${deck.card.name} and see the next one`}>
            <Ionicons name="checkmark" size={20} color={Colors.greenPrimary} />
          </Pressable>
        </View>
      )}
      <View style={{ flex: 1 }} />
      <GestureDetector gesture={strip}>
        <View style={styles.strip} accessible accessibilityRole="adjustable"
          accessibilityLabel={`Touch strip. ${m.playing ? 'Playing' : 'Paused'}, ${fmtClock(m.liveMs)} of ${fmtClock(m.dur)}. Tap to ${m.playing ? 'pause' : 'play'}, swipe to skip.`}
          accessibilityActions={[{ name: 'activate' }, { name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'activate') m.onPlayPause(); else if (e.nativeEvent.actionName === 'increment') m.onNext(); else m.onPrev() }}>
          <View style={[styles.stripFill, { width: `${pct * 100}%` }]} />
          <Ionicons name="chevron-back" size={22} color={alpha(Colors.text, 0.5)} />
          <View style={styles.stripMid}>
            <View style={styles.stripPlay}><Ionicons name={m.playing ? 'pause' : 'play'} size={24} color={Colors.background} /></View>
            <Text style={styles.hint}>{fmtClock(m.liveMs)} / {fmtClock(m.dur)}{'\n'}tap · swipe</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={alpha(Colors.text, 0.5)} />
        </View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  top:        { paddingLeft: Spacing.xl, paddingBottom: Spacing.lg, justifyContent: 'flex-end', gap: Spacing.lg },
  row:        { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  bigArt:     { borderRadius: Radius.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.5, shadowRadius: 26 },
  artEmpty:   { backgroundColor: Colors.glass },
  rowLabel:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6 },
  rowLabelNext: { color: Colors.pink },
  rowArt:     { borderRadius: Radius.lg },
  rowArtNext: { borderWidth: 2, borderColor: alpha(Colors.pink, 0.8) },
  titleBlock: { paddingRight: Spacing.xl },
  overline:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, letterSpacing: 2, color: Colors.textMuted },
  title:      { fontFamily: FontFamily.syneBold, fontSize: 24, letterSpacing: -0.5, lineHeight: 28, color: Colors.text, marginTop: 4 },
  artist:     { fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 4 },

  flat:       { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md },
  headRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  hint:       { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  deck:       { flex: 1 },
  ghost:      { position: 'absolute', borderRadius: Radius.xl, borderWidth: 1 },
  ghost1:     { left: 12, right: 12, top: 7, bottom: 0, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' },
  ghost2:     { left: 24, right: 24, top: 14, bottom: -6, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' },
  card:       {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1, borderColor: alpha(Colors.pink, 0.4), backgroundColor: Colors.sheet,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.45, shadowRadius: 30, elevation: 12,
  },
  cardCompact: { flexDirection: 'column', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md },
  cardText:   { flex: 1, minWidth: 0 },
  cardTextCompact: { alignItems: 'center' },
  cardTitle:  { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg + 2, letterSpacing: -0.5, color: Colors.text, textAlign: 'left' },
  cardSub:    { fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 2 },
  cardMeta:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 8 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyText:  { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  actions:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  circle:     { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dropBtn:    { borderColor: alpha(Colors.error, 0.45), backgroundColor: alpha(Colors.error, 0.08) },
  keepBtn:    { borderColor: alpha(Colors.greenPrimary, 0.45), backgroundColor: alpha(Colors.greenPrimary, 0.08) },
  playNow:    { height: 52, paddingHorizontal: Spacing.xl, borderRadius: 26, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass },
  playNowText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  strip:      {
    height: 92, borderRadius: 36, borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.35), backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl,
  },
  stripFill:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: alpha(Colors.greenPrimary, 0.14) },
  stripMid:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stripPlay:  { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.greenPrimary },
})
