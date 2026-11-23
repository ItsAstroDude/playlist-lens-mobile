import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle } from 'react-native-svg'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useMotionReduced } from '@/components/motion'
import { Icon } from '@/components/ui/Icon'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useAuth } from '@/hooks/useAuth'
import { useIsCover } from '@/hooks/useScreen'
import { fmtMinutesShort } from '@/utils/wrapped'
import { claimToasts } from '@/utils/dialog'
import { getNowPlayingPos, onNowPlayingPos, type NowPlayingPos } from '@/utils/settings'
import {
  agoLabel, clearNews, currentNews, latelyNews, onDropNews, pushNews, type DropNews,
} from '@/utils/dropCard'
import { fmtClock, useNowPlayingModel } from './useNowPlayingModel'

/**
 * The drop card (2.0.26) — Settings › Now playing › "Header button".
 *
 * On Lenses the now-playing bar becomes a cover button by the settings button, with a
 * ring that fills as the song plays. When something happens (a toast while Lenses is
 * in front, a new song) a small card drops out of the button, says it, and goes back
 * in. Tap the button and it grows into the whole card: the song, controls, and what
 * happened lately.
 *
 * Mount `NowPlayingButton` in Lenses' header and `DropCardHost` once over the screen.
 */

const BTN = 44
const RING = 3
const NEWS_W = 252
const TOAST_MS = 2600
const SONG_MS = 3500
/** The cover's size on the open card. */
const COVER = 112

// ── shared state between the button (in the header) and the host (over the screen) ──
type Anchor = { x: number; y: number; w: number; h: number }
let anchor: Anchor | null = null
let isOpen = false
let cardShown = false
function setCardShown(v: boolean) { if (v !== cardShown) { cardShown = v; emit() } }
const subs = new Set<() => void>()
const emit = () => subs.forEach(cb => cb())
function setOpen(v: boolean) { if (v !== isOpen) { isOpen = v; emit() } }
function useStore<T>(read: () => T): T {
  const [v, setV] = useState(read)
  useEffect(() => {
    const cb = () => setV(read())
    subs.add(cb); const off = onDropNews(cb); cb()
    return () => { subs.delete(cb); off() }
  }, [])
  return v
}

/** True while Settings › Now playing is "Header button" (applies live). */
export function useHeaderPlacement(): boolean {
  const [pos, setPos] = useState<NowPlayingPos>(getNowPlayingPos)
  useEffect(() => onNowPlayingPos(setPos), [])
  return pos === 'top'
}

// ─────────────────────────────────────────────────────────────────────────────
// The button

export function NowPlayingButton() {
  const { np, needsReconnect } = useNowPlaying()
  const { login, isLoading } = useAuth()
  const cover = useIsCover()
  const ref = useRef<View>(null)
  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => { if (w > 0) anchor = { x, y, w, h } })
  }, [])

  // The header rises in on mount: measure again once it has settled.
  useEffect(() => { const t = setTimeout(measure, 700); return () => clearTimeout(t) }, [])

  const item = np?.item ?? null
  const isTrack = !!item && np?.type === 'track'
  const art = item?.album?.images?.[0]?.url ?? null
  // While the card is up (and until it has folded back in) the button IS the card: hide it.
  const opened = useStore(() => cardShown)

  // The ring advances on its own between polls (a step every 2 s is plenty for a ring).
  const [, tick] = useState(0)
  useEffect(() => {
    if (!isTrack || !np?.is_playing) return
    const t = setInterval(() => tick(x => x + 1), 2000)
    return () => clearInterval(t)
  }, [isTrack, np?.is_playing])
  const dur = item?.duration_ms ?? 0
  const ms = np ? Math.min((np.progress_ms ?? 0) + (np.is_playing ? Date.now() - np.receivedAt : 0), dur) : 0
  const pct = dur > 0 ? ms / dur : 0

  if (cover) return null
  if (!isTrack) {
    if (!needsReconnect) return null
    return (
      <Pressable ref={ref} onPress={() => { if (!isLoading) { haptic.medium(); login() } }}
        style={[styles.btn, styles.btnReconnect]} accessibilityRole="button" accessibilityLabel="Reconnect Spotify"
        accessibilityHint="New features need a quick sign-in">
        <Ionicons name="sync" size={18} color={Colors.greenPrimary} />
      </Pressable>
    )
  }

  const r = (BTN - RING) / 2
  const C = 2 * Math.PI * r
  return (
    <Pressable ref={ref} onLayout={measure} hitSlop={4}
      onPress={() => { haptic.light(); measure(); setOpen(true) }}
      style={[styles.btn, opened && { opacity: 0 }]} accessibilityRole="button"
      accessibilityLabel={`Now playing: ${item?.name ?? ''}${item?.artists?.length ? ` by ${item.artists.join(', ')}` : ''}`}
      accessibilityHint="Opens playback controls">
      <Svg width={BTN} height={BTN} style={StyleSheet.absoluteFill}>
        <Circle cx={BTN / 2} cy={BTN / 2} r={r} stroke={alpha(Colors.greenPrimary, 0.2)} strokeWidth={RING} fill="none" />
        <Circle cx={BTN / 2} cy={BTN / 2} r={r} stroke={Colors.greenPrimary} strokeWidth={RING} fill="none"
          strokeLinecap="round" strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - pct)}
          transform={`rotate(-90 ${BTN / 2} ${BTN / 2})`} />
      </Svg>
      {art
        ? <Image source={{ uri: art }} style={styles.btnArt} contentFit="cover" />
        : <View style={[styles.btnArt, styles.btnArtEmpty]}><Icon name="musical-note" size={14} color={Colors.greenPrimary} /></View>}
    </Pressable>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The host: news card + opened card, over the Lenses screen

export function DropCardHost() {
  const { width: W } = useWindowDimensions()
  const reduced = useMotionReduced()
  const cover = useIsCover()
  const header = useHeaderPlacement()
  const { np } = useNowPlaying()
  const open = useStore(() => isOpen)
  const news = useStore(currentNews)
  const lately = useStore(latelyNews)

  // Toasts drop out of the button while Lenses is in front.
  const active = header && !cover
  useFocusEffect(useCallback(() => {
    if (!active) return
    return claimToasts(t => {
      AccessibilityInfo.announceForAccessibility(t.message)
      pushNews({ kind: 'toast', title: t.message, glyph: t.glyph })
    })
  }, [active]))

  // A new song is news too (not the one already playing when the screen opened).
  const item = np?.item ?? null
  const songId = item && np?.type === 'track' ? item.id : null
  const lastSong = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const prev = lastSong.current
    lastSong.current = songId
    if (!active || prev === undefined || !songId || songId === prev || isOpen) return
    pushNews({ kind: 'song', title: item!.name, sub: item!.artists?.join(', '), art: item!.album?.images?.[0]?.url ?? null })
  }, [songId, active])

  // News stays up for a moment, then goes back into the button.
  useEffect(() => {
    if (!news) return
    const t = setTimeout(() => clearNews(news.id), news.kind === 'song' ? SONG_MS : TOAST_MS)
    return () => clearTimeout(t)
  }, [news?.id])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setOpen(false); return true })
    return () => sub.remove()
  }, [open])
  // Leaving Lenses closes it.
  useFocusEffect(useCallback(() => () => setOpen(false), []))

  const insets = useSafeAreaInsets()
  if (!active) return null
  const raw = anchor ?? { x: W - Spacing.lg - BTN * 2 - Spacing.sm, y: insets.top + Spacing.sm, w: BTN, h: BTN }
  // Android can measure from below the status bar while this layer starts above it; the
  // button always sits below the status bar, so a y inside it means it was measured that way.
  const a = raw.y < insets.top ? { ...raw, y: raw.y + insets.top } : raw
  return (
    <>
      <NewsCard news={open ? null : news} a={a} W={W} reduced={reduced} />
      <OpenCard open={open && !!item} a={a} W={W} top={insets.top + Spacing.sm} reduced={reduced} lately={lately} />
    </>
  )
}

// ── the small card that drops out of the button ──
function NewsCard({ news, a, W, reduced }: { news: DropNews | null; a: Anchor; W: number; reduced: boolean }) {
  const [shown, setShown] = useState<DropNews | null>(news)
  const k = useSharedValue(0)
  useEffect(() => {
    if (news) {
      setShown(news)
      k.value = 0
      k.value = reduced ? withTiming(1, { duration: 160 }) : withSpring(1, Spring.bouncy)
    } else {
      k.value = withTiming(0, { duration: 180 }, done => { if (done) runOnJS(setShown)(null) })
    }
  }, [news?.id])
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, k.value * 1.4),
    transform: [{ translateY: (1 - k.value) * -10 }, { scale: 0.5 + 0.5 * k.value }],
  }))
  if (!shown) return null
  const right = Math.max(Spacing.md, W - (a.x + a.w))
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite"
      style={[styles.news, { top: a.y + a.h + 8, right, width: Math.min(NEWS_W, W - right - Spacing.md) }, style]}>
      {shown.kind === 'song' ? (
        shown.art
          ? <Image source={{ uri: shown.art }} style={styles.newsArt} contentFit="cover" />
          : <Icon name="musical-note" size={16} color={Colors.greenPrimary} />
      ) : <Icon name={shown.glyph ?? 'checkmark'} size={16} color={Colors.greenPrimary} />}
      <View style={styles.newsText}>
        {shown.kind === 'song' && <Text style={styles.overline}>NOW PLAYING</Text>}
        <Text style={styles.newsTitle} numberOfLines={2}>{shown.title}</Text>
        {shown.sub ? <Text style={styles.newsSub} numberOfLines={1}>{shown.sub}</Text> : null}
      </View>
    </Animated.View>
  )
}

// ── the whole card, unfolding out of the button ──
// The card grows from the button's circle to its full size with its top-right corner
// held where the button is (the cover sits there), so the button looks like it opens
// up; closing folds it back in. Content fades in once there's room for it.
function OpenCard({ open, a, W, top, reduced, lately }: {
  open: boolean; a: Anchor; W: number; top: number; reduced: boolean; lately: DropNews[]
}) {
  const { np } = useNowPlaying()
  const [mounted, setMounted] = useState(open)
  const m = useNowPlayingModel(np, mounted)
  const [h, setH] = useState(460)                 // measured content height
  const k = useSharedValue(0)
  useEffect(() => { setCardShown(mounted); return () => setCardShown(false) }, [mounted])
  useEffect(() => {
    if (open) {
      setMounted(true)
      k.value = reduced ? withTiming(1, { duration: 180 }) : withSpring(1, Spring.default)
    } else {
      k.value = withTiming(0, { duration: reduced ? 160 : 240, easing: Easing.inOut(Easing.cubic) },
        done => { if (done) runOnJS(setMounted)(false) })
    }
  }, [open])

  const cw = W - Spacing.lg * 2                    // final width
  const right = Spacing.lg                         // final right edge inset
  const fromRight = W - (a.x + a.w)                // the button's right inset
  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, k.value)) }))
  const card = useAnimatedStyle(() => {
    const t = k.value, c = Math.min(1, Math.max(0, t))
    return {
      top: a.y + (top - a.y) * t,
      right: fromRight + (right - fromRight) * t,
      width: Math.max(BTN * 0.6, BTN + (cw - BTN) * t),
      height: Math.max(BTN * 0.6, BTN + (h - BTN) * t),
      borderTopLeftRadius: BTN / 2 + (Radius['2xl'] - BTN / 2) * c,
      borderBottomLeftRadius: BTN / 2 + (Radius['2xl'] - BTN / 2) * c,
      borderBottomRightRadius: BTN / 2 + (Radius['2xl'] - BTN / 2) * c,
      borderTopRightRadius: BTN / 2 + (26 - BTN / 2) * c,
    }
  })
  // The words, then the controls: each fades and rises in as the card makes room.
  // (k.value is read right here, not in a helper: Reanimated only re-runs a style when
  // the shared values its own worklet reads change — read through a helper, the words
  // waited for the next re-render, ~1 s, and popped in / lingered on close.)
  const content = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (k.value - 0.35) / 0.4))
    return { opacity: p, transform: [{ translateY: (1 - p) * 10 }] }
  })
  const rest = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (k.value - 0.55) / 0.4))
    return { opacity: p, transform: [{ translateY: (1 - p) * 14 }] }
  })

  // The cover travels: from the round art in the button to its corner of the card.
  const fromArt = BTN - RING * 2 - 4
  const from = { x: a.x + (a.w - fromArt) / 2, y: a.y + (a.h - fromArt) / 2, s: fromArt, r: fromArt / 2 }
  const to = { x: W - Spacing.lg * 2 - COVER - 1, y: top + Spacing.lg + 1, s: COVER, r: Radius.xl }
  const flying = useAnimatedStyle(() => {
    const t = k.value, c = Math.min(1, Math.max(0, t))
    return {
      left: from.x + (to.x - from.x) * t,
      top: from.y + (to.y - from.y) * t,
      width: from.s + (to.s - from.s) * t,
      height: from.s + (to.s - from.s) * t,
      borderRadius: from.r + (to.r - from.r) * c,
    }
  })
  if (!mounted) return null
  const close = () => { haptic.light(); setOpen(false) }
  const { item, stats, dur, liveMs, playing, busy, art, initial } = m
  const pct = dur > 0 ? Math.min(liveMs / dur, 1) : 0
  // The song already on the card isn't news in the list under it.
  const recent = lately.filter(n => !(n.kind === 'song' && n.title === item?.name))

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View accessibilityViewIsModal style={[styles.card, card]}>
        {/* laid out at the final width, held to the top-right corner while it grows */}
        <View style={[styles.cardBody, { width: cw }]} onLayout={e => setH(Math.round(e.nativeEvent.layout.height))}>
        <View style={styles.head}>
          <Animated.View style={[styles.headText, content]}>
            <Text style={styles.overline}>{playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
            <Text style={styles.title} numberOfLines={2}>{item?.name}</Text>
            {!!item?.artists?.length && <Text style={styles.artist} numberOfLines={1}>{item.artists.join(', ')}</Text>}
          </Animated.View>
          {/* the cover's place; the cover itself flies in on top (below) */}
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={styles.coverSlot} />
        </View>

        <Animated.View style={[styles.rest, rest]}>

        {dur > 0 && (
          <View style={styles.progress}>
            <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%` }]} /></View>
            <View style={styles.clocks}><Text style={styles.clock}>{fmtClock(liveMs)}</Text><Text style={styles.clock}>{fmtClock(dur)}</Text></View>
          </View>
        )}

        <View style={styles.controls}>
          <Pressable onPress={m.onPrev} disabled={busy} hitSlop={8} style={styles.ctrl} accessibilityRole="button" accessibilityLabel="Previous track">
            <Ionicons name="play-skip-back" size={22} color={Colors.text} />
          </Pressable>
          <Pressable onPress={m.onPlayPause} disabled={busy} style={styles.play} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
            <Ionicons name={playing ? 'pause' : 'play'} size={24} color={Colors.background} />
          </Pressable>
          <Pressable onPress={m.onNext} disabled={busy} hitSlop={8} style={styles.ctrl} accessibilityRole="button" accessibilityLabel="Next track">
            <Ionicons name="play-skip-forward" size={22} color={Colors.text} />
          </Pressable>
        </View>

        {recent.length > 0 && (
          <View style={styles.lately}>
            <Text style={[styles.overline, styles.latelyLabel]}>LATELY</Text>
            {recent.map(n => (
              <View key={n.id} style={styles.latelyRow}>
                <Icon name={n.kind === 'song' ? 'musical-note' : (n.glyph ?? 'checkmark')} size={14} color={n.kind === 'song' ? Colors.textSecondary : Colors.greenPrimary} />
                <Text style={styles.latelyText} numberOfLines={1}>{n.kind === 'song' ? `${n.title}${n.sub ? ` · ${n.sub}` : ''}` : n.title}</Text>
                <Text style={styles.latelyAgo}>{agoLabel(n.at)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.foot}>
          <Text style={styles.stat} numberOfLines={1}>
            {stats?.stat
              ? `${stats.stat.plays.toLocaleString()} plays · ${fmtMinutesShort(stats.stat.ms)}${stats.rank != null ? ` · your #${stats.rank.toLocaleString()}` : ''}`
              : stats?.imported ? 'first listen?' : ''}
          </Text>
          <Pressable onPress={m.onOpenSpotify} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>Open in Spotify</Text>
          </Pressable>
        </View>
        </Animated.View>
        </View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.flying, flying]}>
        {art ? <Image source={{ uri: art }} style={StyleSheet.absoluteFill} contentFit="cover" />
             : <LinearGradient colors={[alpha(Colors.greenPrimary, 0.33), alpha(Colors.greenPrimary, 0.07)]} style={[StyleSheet.absoluteFill, styles.coverEmpty]}>
                 <Text style={styles.initial}>{initial}</Text>
               </LinearGradient>}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  btn:          { width: BTN, height: BTN, borderRadius: BTN / 2, alignItems: 'center', justifyContent: 'center' },
  btnReconnect: { borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.4), backgroundColor: alpha(Colors.greenPrimary, 0.08) },
  btnArt:       { width: BTN - RING * 2 - 4, height: BTN - RING * 2 - 4, borderRadius: BTN },
  btnArtEmpty:  { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.glass },

  news: {
    position: 'absolute', zIndex: 40, elevation: 40,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md + 2,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: 6, borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg,
    borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.4), backgroundColor: Colors.sheet,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.45, shadowRadius: 20,
    transformOrigin: 'top right',
  },
  newsArt:   { width: 32, height: 32, borderRadius: 8 },
  newsText:  { flex: 1, minWidth: 0 },
  newsTitle: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  newsSub:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  backdrop:  { zIndex: 41, elevation: 41, backgroundColor: 'rgba(0,0,0,0.55)' },
  card: {
    position: 'absolute', zIndex: 42, elevation: 42, overflow: 'hidden',
    borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.4), backgroundColor: Colors.sheet,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 30,
  },
  cardBody:  { position: 'absolute', top: 0, right: 0, padding: Spacing.lg, gap: Spacing.lg },
  rest:      { gap: Spacing.lg },
  head:      { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  headText:  { flex: 1, minWidth: 0, paddingTop: 4 },
  overline:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, letterSpacing: 2, color: Colors.textMuted },
  title:     { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, letterSpacing: -0.5, lineHeight: 26, color: Colors.text, marginTop: 4 },
  artist:    { fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 4 },
  coverSlot: { width: COVER, height: COVER },
  flying:    { position: 'absolute', zIndex: 43, elevation: 43, overflow: 'hidden', backgroundColor: Colors.card },
  coverWrap: { borderRadius: Radius.xl, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 10 },
  cover:     { width: 112, height: 112 },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  initial:   { fontFamily: FontFamily.syneBold, fontSize: 44, color: Colors.greenPrimary },
  progress:  { gap: 6 },
  track:     { height: 4, borderRadius: 2, backgroundColor: alpha(Colors.greenPrimary, 0.18), overflow: 'hidden' },
  fill:      { height: 4, borderRadius: 2, backgroundColor: Colors.greenPrimary },
  clocks:    { flexDirection: 'row', justifyContent: 'space-between' },
  clock:     { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  controls:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing['3xl'] },
  ctrl:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  play:      { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.greenPrimary },
  lately:    { borderTopWidth: 1, borderTopColor: Colors.glassBorder, paddingTop: Spacing.md, gap: Spacing.sm },
  latelyLabel: { marginBottom: 2 },
  latelyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2 },
  latelyText: { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.text },
  latelyAgo: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  foot:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  stat:      { flex: 1, fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  link:      { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.greenPrimary },
})
