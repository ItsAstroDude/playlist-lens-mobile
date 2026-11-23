import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo, Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle } from 'react-native-svg'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useMotionReduced } from '@/components/motion'
import { Icon } from '@/components/ui/Icon'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useAuth } from '@/hooks/useAuth'
import { useIsCover } from '@/hooks/useScreen'
import { requestTabletop, tabletopRequested } from '@/utils/coverMode'
import { claimToasts } from '@/utils/dialog'
import { getNowPlayingPos, onNowPlayingPos, type NowPlayingPos } from '@/utils/settings'
import {
  clearNews, currentNews, onDropNews, pushNews, type DropNews,
} from '@/utils/dropCard'

/**
 * The drop card (2.0.26) — Settings › Now playing › "Header button".
 *
 * On Lenses the now-playing bar becomes a cover button by the settings button, with a
 * ring that fills as the song plays. When something happens (a toast while Lenses is
 * in front, a new song) a small card drops out of the button, says it, and goes back
 * in. Tap the button and Now playing opens full screen (2.0.34: the screen designed for
 * the half fold — now · 1 · 2 — components/fold/TabletopNowPlaying; flat, it splits at
 * the middle of the screen).
 *
 * Mount `NowPlayingButton` in Lenses' header and `DropCardHost` once over the screen.
 */

const BTN = 44
const RING = 3
const NEWS_W = 252
const TOAST_MS = 2600
const SONG_MS = 3500

// ── shared state between the button (in the header) and the host (over the screen) ──
type Anchor = { x: number; y: number; w: number; h: number }
let anchor: Anchor | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach(cb => cb())
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
  // Decode the cover ahead of time: the drop card's travelling copy then draws at once.
  useEffect(() => { if (art) Promise.resolve(Image.prefetch?.(art)).catch(() => {}) }, [art])

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
      onPress={() => { haptic.light(); measure(); requestTabletop() }}
      style={styles.btn} accessibilityRole="button"
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
  const news = useStore(currentNews)

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
    if (!active || prev === undefined || !songId || songId === prev || tabletopRequested()) return
    pushNews({ kind: 'song', title: item!.name, sub: item!.artists?.join(', '), art: item!.album?.images?.[0]?.url ?? null })
  }, [songId, active])

  // News stays up for a moment, then goes back into the button.
  useEffect(() => {
    if (!news) return
    const t = setTimeout(() => clearNews(news.id), news.kind === 'song' ? SONG_MS : TOAST_MS)
    return () => clearTimeout(t)
  }, [news?.id])

  const insets = useSafeAreaInsets()
  if (!active) return null
  const raw = anchor ?? { x: W - Spacing.lg - BTN * 2 - Spacing.sm, y: insets.top + Spacing.sm, w: BTN, h: BTN }
  // Android can measure from below the status bar while this layer starts above it; the
  // button always sits below the status bar, so a y inside it means it was measured that way.
  const a = raw.y < insets.top ? { ...raw, y: raw.y + insets.top } : raw
  return (
    <>
      <NewsCard news={news} a={a} W={W} reduced={reduced} />
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
  overline:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, letterSpacing: 2, color: Colors.textMuted },
})
