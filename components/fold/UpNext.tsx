import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector, type ComposedGesture, type GestureType } from 'react-native-gesture-handler'
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated'
import { useMotionReduced } from '@/components/motion'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { pokeNowPlaying } from '@/hooks/useNowPlaying'
import { skipNext, classifyPlaybackError, transportErrorMessage } from '@/utils/playback'
import { showToast } from '@/utils/dialog'
import {
  deckCards, dropSong, fetchUpNext, statsOverflow, forgetDropped, inLabel, isDropped, onDropped, skipsTo, startsIn, visibleQueue,
  type UpNextTrack,
} from '@/utils/upNext'
import { fmtClock, type useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'
import { songPlays } from '@/utils/playDb'
import { fmtMinutesShort } from '@/utils/wrapped'
import { runAsync } from '@/utils/sqlJob'
import { songDepthJob, type SongDepth } from '@/utils/stats'

type Model = ReturnType<typeof useNowPlayingModel>

/**
 * Half-folded "up next" (2.0.28): the two C+D layouts from the design board.
 *  · Standing half (UpNextTop): the song big, then what's next as covers that shrink
 *    away to the right, each with when it starts.
 *  · Flat half: the next song as a card you swipe — left drops it (skipped when it comes
 *    up), right keeps it (shows the one after), up plays it now (skips ahead to it).
 *    Under it (2.0.38, "Ctl A"): the song playing, the seeker, and one row of controls —
 *    ✕ drop · previous · play/pause · next · ✓ keep. Through the queue, the card folds
 *    away and the song's row grows upwards into its stats.
 *  The Flex panel (F3) uses the same deck and control row.
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

export function UpNextTop({ m, state, W, height, padTop, skipFirst, onContentH }: {
  m: Model; state: UpNextState; W: number; height: number; padTop: number
  /** C+D 2 shows the next song on the pad, so the row starts after it. */
  skipFirst: boolean
  /** The covers + title's own height: what's left above it is room to move up into. */
  onContentH?: (h: number) => void
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
      <View style={styles.topContent} onLayout={e => onContentH?.(Math.round(e.nativeEvent.layout.height))}>
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
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The deck

export function useDeck(state: UpNextState, m: Model, refresh: () => void) {
  // Songs decided (kept or dropped) this time round. A drop still counts in "x of N",
  // and "look at the queue again" brings dropped songs back (marked) to undo.
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  // Spotify's queue can lag a song behind: never offer the song that's already playing.
  const nowId = m.item?.id ?? null
  const queue = state.status === 'ok' ? state.queue.filter(t => t.id !== nowId) : []
  // Not memoised: a drop changes the dropped set, not these inputs.
  const cards = deckCards(queue, seen)
  const remaining = Math.max(0, m.dur - m.liveMs)
  const card = cards[0] ?? null
  const vq = visibleQueue(queue)
  const at = card ? startsIn(vq, remaining)[vq.findIndex(t => t.id === card.id)] ?? 0 : 0
  const see = (id: string | null) => setSeen(prev => { const n = new Set(prev); if (id) n.add(id); return n })

  const drop = useCallback((t: UpNextTrack) => { haptic.medium(); dropSong(t.id); see(t.id) }, [])
  const keep = useCallback((t: UpNextTrack) => {
    haptic.light()
    if (t.id && isDropped(t.id)) forgetDropped(t.id)     // ✓ on a dropped card = undo the drop
    see(t.id)
  }, [])
  const playNow = useCallback(async (t: UpNextTrack) => {
    if (!t.id) return
    haptic.medium()
    if (isDropped(t.id)) forgetDropped(t.id)
    // It's about to play: off the deck now, not after the next refresh.
    see(t.id)
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
  const again = useCallback(() => setSeen(new Set()), [])
  const total = queue.filter(t => !!t.id).length
  return { card, at, count: cards.length, total, dropped: !!card && isDropped(card.id), drop, keep, playNow, again }
}

export type Deck = ReturnType<typeof useDeck>

/** The card's gestures, made by the layout so the pad can let the card go first. */
export function useCardGestures(deck: Deck, W: number) {
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

export function DeckCard({ deck, cardStyle, gesture, compact, artSize }: {
  deck: Deck; cardStyle: ReturnType<typeof useAnimatedStyle>; gesture: GestureType | ComposedGesture; compact?: boolean; artSize?: number
}) {
  const t = deck.card
  if (!t) return null
  const art = artSize ?? (compact ? 96 : 120)
  return (
    <View style={styles.deck}>
      <View style={[styles.ghost, styles.ghost2]} />
      <View style={[styles.ghost, styles.ghost1]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, compact && styles.cardCompact, deck.dropped && styles.cardDropped, cardStyle]}
          accessible accessibilityLabel={deck.dropped
            ? `Dropped: ${t.name} by ${t.artists.join(', ')}, skipped when it starts. Swipe right to keep it after all, left to leave it dropped.`
            : `Up next: ${t.name} by ${t.artists.join(', ')}, ${inLabel(deck.at)}. Swipe left to drop it, right to keep it, up to play it now.`}>
          {compact && <Text style={[styles.overline, { color: Colors.pink }]}>UP NEXT</Text>}
          {t.image ? <Image source={{ uri: t.image }} style={{ width: art, height: art, borderRadius: Radius.lg }} contentFit="cover" />
                   : <View style={[{ width: art, height: art, borderRadius: Radius.lg }, styles.artEmpty]} />}
          <View style={compact ? styles.cardTextCompact : styles.cardText}>
            <Text style={styles.cardTitle} numberOfLines={2}>{t.name}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{t.artists.join(', ')}</Text>
            {deck.dropped
              ? <Text style={[styles.cardMeta, { color: Colors.error }]}>dropped · skipped when it starts · ✓ to keep</Text>
              : <Text style={styles.cardMeta}>{inLabel(deck.at)}</Text>}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

function DeckEmpty({ state, deck, m }: { state: UpNextState; deck: Deck; m: Model }) {
  // Through the queue (or nothing queued): the card turns to the song that's playing.
  if (state.status === 'ok' && m.item) return <SongAbout m={m} again={deck.total > 0 ? deck.again : undefined} />
  const text = state.status === 'loading' ? 'Looking at what\'s next…'
    : state.status === 'server' ? 'Up next shows here once the server is updated.'
    : 'Couldn\'t get what\'s next from Spotify.'
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>
}

/** What there is to say about the song playing: plays (tracked + imported), time
 *  listened, plays this past week, when you first heard it, its all-time rank. */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "Jul '24": fits a chip (the long form was cut off). */
function shortMonth(d: Date): string { return `${MON[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` }

/** The song's last 12 months and its artist's standing, worked out off the UI thread. */
function useSongDepth(m: Model, active: boolean): SongDepth | null {
  const [depth, setDepth] = useState<SongDepth | null>(null)
  const name = m.item?.name, artist = m.item?.artists?.[0]
  useEffect(() => {
    setDepth(null)
    if (!active || !name || !artist) return
    let alive = true
    runAsync(songDepthJob(name, artist)).then(d => { if (alive) setDepth(d) }).catch(() => {})
    return () => { alive = false }
  }, [active, name, artist])
  return depth
}

export function useSongFacts(m: Model) {
  const item = m.item
  const sp = useMemo(() => {
    if (!item) return null
    try { return songPlays(item.uri, item.name, item.artists?.[0] ?? '', Math.floor(Date.now() / 1000) - 7 * 86_400) }
    catch { return null }
  }, [item?.uri, item?.name])
  const plays = Math.max(sp?.plays ?? 0, m.stats?.stat?.plays ?? 0)
  const ms = Math.max(sp?.ms ?? 0, m.stats?.stat?.ms ?? 0)
  const first = sp?.firstT ? shortMonth(new Date(sp.firstT * 1000)) : null
  const headline = plays === 0 ? 'A first listen' : plays === 1 ? 'Your 2nd time with it' : `Play number ${(plays + 1).toLocaleString()}`
  /** Short, for the song row: which play this is. */
  const badge = plays === 0 ? 'first listen' : `play #${(plays + 1).toLocaleString()}`
  const chips = [
    plays > 0 && { v: fmtMinutesShort(ms), l: 'listened' },
    sp && sp.thisWeek > 0 && { v: String(sp.thisWeek), l: 'this week' },
    first && { v: first, l: 'first heard' },
    m.stats?.rank != null && { v: `#${m.stats.rank.toLocaleString()}`, l: 'all time' },
  ].filter(Boolean).slice(0, 3) as { v: string; l: string }[]
  return { headline, badge, chips }
}

/**
 * After the queue (2.0.37), as a card: stats about the song playing. The Flex panel shows
 * it in the card's place; the half-folded view grows the song row instead (NowInfo).
 */
export function SongAbout({ m, again }: { m: Model; again?: () => void }) {
  const { headline, chips } = useSongFacts(m)
  return (
    <View style={[styles.card, styles.about]} accessible
      accessibilityLabel={`About this song: ${headline}. ${chips.map(c => `${c.v} ${c.l}`).join(', ')}`}>
      <Text style={[styles.overline, { color: Colors.pink }]}>ABOUT THIS SONG</Text>
      <Text style={styles.aboutHead} numberOfLines={1}>{headline}</Text>
      {chips.length > 0 && <FactChips chips={chips} />}
      {again && <AgainLink again={again} />}
    </View>
  )
}

function FactChips({ chips }: { chips: { v: string; l: string }[] }) {
  return (
    <View style={styles.aboutChips}>
      {chips.map(c => (
        <View key={c.l} style={styles.aboutChip}>
          <Text style={styles.aboutVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{c.v}</Text>
          <Text style={styles.cardMeta}>{c.l}</Text>
        </View>
      ))}
    </View>
  )
}

function AgainLink({ again }: { again: () => void }) {
  return (
    <Pressable onPress={() => { haptic.light(); again() }} hitSlop={8} accessibilityRole="button">
      <Text style={styles.aboutAgain}>↺ look at the queue again</Text>
    </Pressable>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ctl A: the song row, the seeker, one row of controls

/**
 * The song playing, above the seeker. `open` (through the queue): it grows upwards into
 * the song's stats — the details' height springs from 0 to what they measure.
 */
function NowInfo({ m, open, again, chart = true, onDetailH }: {
  m: Model; open: boolean; again?: () => void
  /** The 12-month bars: left out half-folded, where the hinge leaves no room. */
  chart?: boolean
  onDetailH?: (h: number) => void
}) {
  const reduced = useMotionReduced()
  const facts = useSongFacts(m)
  const depth = useSongDepth(m, open)
  const k = useSharedValue(open ? 1 : 0)
  const h = useSharedValue(0)
  useEffect(() => {
    k.value = reduced ? withTiming(open ? 1 : 0, { duration: 180 }) : withSpring(open ? 1 : 0, Spring.entrance)
  }, [open])
  const detailStyle = useAnimatedStyle(() => ({
    height: Math.max(0, k.value * h.value),
    opacity: Math.min(1, Math.max(0, k.value)),
  }))
  return (
    <View style={styles.info}>
      <Animated.View style={[styles.detailClip, detailStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <View style={styles.detail} onLayout={e => { h.value = e.nativeEvent.layout.height; onDetailH?.(e.nativeEvent.layout.height) }}
          accessible={open} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
          accessibilityLabel={`End of the queue. ${facts.headline}. ${facts.chips.map(c => `${c.v} ${c.l}`).join(', ')}`}>
          <Text style={[styles.overline, { color: Colors.pink }]}>THAT'S THE QUEUE · ABOUT THIS SONG</Text>
          <Text style={styles.aboutHead} numberOfLines={1}>{facts.headline}</Text>
          {facts.chips.length > 0 && <FactChips chips={facts.chips} />}
          {depth && <SongYear depth={depth} artist={m.item?.artists?.[0] ?? ''} chart={chart} />}
          {again && <AgainLink again={again} />}
        </View>
      </Animated.View>
      <View style={styles.infoRow} accessible accessibilityLabel={`Playing ${m.item?.name ?? ''} by ${m.item?.artists?.join(', ') ?? ''}, ${facts.badge}`}>
        {m.art ? <Image source={{ uri: m.art }} style={styles.infoArt} contentFit="cover" transition={200} />
               : <View style={[styles.infoArt, styles.artEmpty]} />}
        <View style={styles.infoText}>
          <Text style={styles.infoTitle} numberOfLines={1}>{m.item?.name}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>{m.item?.artists?.join(', ')}</Text>
        </View>
        <View style={styles.badge}><Text style={styles.badgeText}>{facts.badge}</Text></View>
      </View>
    </View>
  )
}

/** The song's last year as bars, and how its artist ranks for you. */
function SongYear({ depth, artist, chart }: { depth: SongDepth; artist: string; chart: boolean }) {
  const max = Math.max(1, ...depth.months)
  const any = chart && depth.months.some(n => n > 0)
  return (
    <View style={styles.year}>
      {any && (
        <View>
          <Text style={styles.yearLabel}>YOUR LAST 12 MONTHS WITH IT</Text>
          <View style={styles.yearBars} accessible
            accessibilityLabel={`Plays by month, the last 12 months: ${depth.months.join(', ')}`}>
            {depth.months.map((n, i) => (
              <View key={i} style={styles.yearCol}>
                <View style={[styles.yearBar, { height: 3 + 41 * (n / max), opacity: n ? 1 : 0.25 },
                  i === depth.months.length - 1 && { backgroundColor: Colors.pink }]} />
                <Text style={styles.yearMonth}>{depth.monthLabels[i]}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {depth.artistPlays > 0 && (
        <Text style={styles.artistLine} numberOfLines={2}>
          <Text style={{ color: Colors.text }}>{artist}</Text>
          {` · ${depth.artistPlays.toLocaleString()} ${depth.artistPlays === 1 ? 'play' : 'plays'}${depth.artistRank ? ` · your #${depth.artistRank} artist` : ''}`}
        </Text>
      )}
    </View>
  )
}

export function Seeker({ m }: { m: Model }) {
  const pct = m.dur > 0 ? Math.min(m.liveMs / m.dur, 1) : 0
  return (
    <View style={styles.seeker} accessible accessibilityLabel={`${fmtClock(m.liveMs)} of ${fmtClock(m.dur)}`}>
      <Text style={styles.seekClock}>{fmtClock(m.liveMs)}</Text>
      <View style={styles.seekTrack}><View style={[styles.seekFill, { width: `${pct * 100}%` }]} /></View>
      <Text style={styles.seekClock}>{fmtClock(m.dur)}</Text>
    </View>
  )
}

/** ✕ drop · previous · play/pause · next · ✓ keep. Drop and keep rest when there's no card. */
export function ControlRow({ m, deck, fly, big = 76 }: {
  m: Model; deck: Deck; fly: (kind: 'drop' | 'keep' | 'play') => void; big?: number
}) {
  const t = deck.card
  return (
    <View style={styles.ctlRow}>
      <Pressable onPress={() => fly('drop')} disabled={!t} style={[styles.circle, styles.dropBtn, !t && styles.off]}
        accessibilityRole="button" accessibilityState={{ disabled: !t }} accessibilityLabel={t ? (deck.dropped ? `Leave ${t.name} dropped` : `Take ${t.name} out of the queue`) : 'Drop'}>
        <Ionicons name="close" size={20} color={Colors.error} />
      </Pressable>
      <Pressable onPress={m.onPrev} disabled={m.busy} hitSlop={6} style={styles.skipBtn} accessibilityRole="button" accessibilityLabel="Previous track">
        <Ionicons name="play-skip-back" size={26} color={Colors.text} />
      </Pressable>
      <Pressable onPress={m.onPlayPause} disabled={m.busy} style={[styles.bigPlay, { width: big, height: big, borderRadius: big / 2 }]}
        accessibilityRole="button" accessibilityLabel={m.playing ? 'Pause' : 'Play'}>
        <Ionicons name={m.playing ? 'pause' : 'play'} size={Math.round(big * 0.4)} color={Colors.background} />
      </Pressable>
      <Pressable onPress={m.onNext} disabled={m.busy} hitSlop={6} style={styles.skipBtn} accessibilityRole="button" accessibilityLabel="Next track">
        <Ionicons name="play-skip-forward" size={26} color={Colors.text} />
      </Pressable>
      <Pressable onPress={() => fly('keep')} disabled={!t} style={[styles.circle, styles.keepBtn, !t && styles.off]}
        accessibilityRole="button" accessibilityState={{ disabled: !t }} accessibilityLabel={t ? (deck.dropped ? `Keep ${t.name} after all` : `Keep ${t.name} and see the next one`) : 'Keep'}>
        <Ionicons name="checkmark" size={20} color={Colors.greenPrimary} />
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Flat half: the deck, then Ctl A

export function UpNextStrip({ m, state, refresh, W, height, padBottom, roomy = true, onOverflow }: {
  m: Model; state: UpNextState; refresh: () => void; W: number; height: number; padBottom: number
  /** Flat phone: the top half can make room, so the stats get their 12-month bars. */
  roomy?: boolean
  /** How far the grown stats reach above this half (0 when they fit): the top half moves up by it. */
  onOverflow?: (px: number) => void
}) {
  const reduced = useMotionReduced()
  const deck = useDeck(state, m, refresh)
  const g = useCardGestures(deck, W)
  // Through the queue (or nothing queued): the card folds away, the song row grows up.
  const done = state.status === 'ok' && !deck.card && !!m.item
  const k = useSharedValue(done ? 1 : 0)
  useEffect(() => {
    k.value = reduced ? withTiming(done ? 1 : 0, { duration: 180 }) : withSpring(done ? 1 : 0, Spring.entrance)
  }, [done])
  const cardArea = useAnimatedStyle(() => ({
    height: Math.max(0, (1 - k.value) * CARD_H),
    opacity: Math.min(1, Math.max(0, 1 - k.value * 1.6)),
  }))
  // Through the queue, the stats can need more than this half has. Worked out from
  // sizes that hold still (the controls' group before it grows, the stats' own height),
  // not from the animation: the overflow is what the top half has to give up.
  const [base, setBase] = useState(0)
  const [detailH, setDetailH] = useState(0)
  const room = height - Spacing.lg - padBottom - Spacing.md * 3     // 3 gaps: head, card area, spacer, group
  const over = done ? statsOverflow(base, detailH, room) : 0
  useEffect(() => { onOverflow?.(over) }, [over])
  return (
    <View style={[styles.flat, { height, paddingBottom: padBottom }]}>
      <View style={styles.headRow}>
        {!done && <Text style={styles.overline}>{deck.card ? `UP NEXT${deck.total ? ` · ${deck.total - deck.count + 1} OF ${deck.total}` : ''}` : 'UP NEXT'}</Text>}
        {!!deck.card && <Text style={styles.hint}>swipe the card ← drop · keep →</Text>}
      </View>
      <Animated.View style={[styles.cardArea, cardArea]} pointerEvents={done ? 'none' : 'auto'}>
        {deck.card ? <DeckCard deck={deck} cardStyle={g.style} gesture={Gesture.Simultaneous(g.pan, g.tap)} />
                   : !done ? <DeckEmpty state={state} deck={deck} m={m} /> : null}
      </Animated.View>
      <View style={{ flex: 1 }} />
      <View style={styles.bottomGroup} onLayout={e => {
        const hh = Math.round(e.nativeEvent.layout.height)
        // Opened already through the queue: the stats are in this height, take them out.
        if (!done) setBase(hh); else if (base === 0 && detailH > 0 && hh > detailH) setBase(hh - detailH)
      }}>
        <NowInfo m={m} open={done} again={deck.total > 0 ? deck.again : undefined} chart={roomy} onDetailH={setDetailH} />
        <Seeker m={m} />
        <ControlRow m={m} deck={deck} fly={g.fly} />
      </View>
    </View>
  )
}

const CARD_H = 168

const styles = StyleSheet.create({
  cardArea:   { overflow: 'visible' },
  bottomGroup: { gap: Spacing.md },
  topContent: { gap: Spacing.lg },
  info:       { gap: Spacing.md },
  detailClip: { overflow: 'hidden' },
  detail:     { position: 'absolute', left: 0, right: 0, top: 0, gap: Spacing.sm, paddingHorizontal: 4 },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: 4 },
  infoArt:    { width: 44, height: 44, borderRadius: Radius.md },
  infoText:   { flex: 1, minWidth: 0 },
  infoTitle:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  badge:      { paddingHorizontal: Spacing.sm + 2, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.35), backgroundColor: alpha(Colors.greenPrimary, 0.08) },
  badgeText:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.greenPrimary },
  year:       { gap: Spacing.md, marginTop: Spacing.xs },
  yearLabel:  { fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted, marginBottom: 6 },
  yearBars:   { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 60 },
  yearCol:    { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  yearBar:    { width: '100%', borderRadius: 3, backgroundColor: Colors.greenPrimary },
  yearMonth:  { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.textMuted },
  artistLine: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  seeker:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2, paddingHorizontal: 4 },
  seekClock:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textSecondary, minWidth: 32, textAlign: 'center' },
  seekTrack:  { flex: 1, height: 4, borderRadius: 2, backgroundColor: alpha(Colors.greenPrimary, 0.18), overflow: 'hidden' },
  seekFill:   { height: 4, borderRadius: 2, backgroundColor: Colors.greenPrimary },
  ctlRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  skipBtn:    { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  bigPlay:    { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.greenPrimary },
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
  cardDropped: { borderColor: alpha(Colors.error, 0.45), opacity: 0.85 },
  cardCompact: { flexDirection: 'column', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md },
  cardText:   { flex: 1, minWidth: 0 },
  cardTextCompact: { alignItems: 'center' },
  cardTitle:  { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg + 2, letterSpacing: -0.5, color: Colors.text, textAlign: 'left' },
  cardSub:    { fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 2 },
  cardMeta:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 8 },
  about:      { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: Spacing.sm },
  aboutHead:  { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg + 2, letterSpacing: -0.5, color: Colors.text },
  aboutChips: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch' },
  aboutChip:  { flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder },
  aboutVal:   { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.greenPrimary },
  aboutAgain: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyText:  { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  circle:     { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  off:        { opacity: 0.3 },
  dropBtn:    { borderColor: alpha(Colors.error, 0.45), backgroundColor: alpha(Colors.error, 0.08) },
  keepBtn:    { borderColor: alpha(Colors.greenPrimary, 0.45), backgroundColor: alpha(Colors.greenPrimary, 0.08) },
})
