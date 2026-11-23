import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePathname } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useMotionReduced } from '@/components/motion'
import { GlyphOrIcon, Icon } from '@/components/ui/Icon'
import { WakeDot } from '@/components/ui/ServerState'
import { useNowPlaying, type NowPlaying } from '@/hooks/useNowPlaying'
import { useAuth } from '@/hooks/useAuth'
import { useServerWaking } from '@/hooks/useServerWaking'
import { useIsCover } from '@/hooks/useScreen'
import { useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'
import { onToast, type ToastOptions } from '@/utils/dialog'
import { emitOpenNowPlaying } from '@/utils/overlayEvents'
import { getNowPlayingPos, onNowPlayingPos } from '@/utils/settings'
import { useTabletopActive } from '@/utils/coverMode'
import { wakeCopy, wakeProgress } from '@/utils/serverStatus'
import { buildPool, splitGlyph, LINE_ACCENTS, QUOTES } from '@/utils/stripLines'
import { LOBE, compactWidth, islandGeometry, type IslandCompact } from '@/utils/island'

/**
 * The top island (2.0.23): one black pill round the selfie camera that holds what used
 * to be four things — the Lenses strip's lines, the now-playing song (when Settings ›
 * Now playing is "Top island"), toasts, and the server wake-up.
 *
 *  Compact   two lobes either side of the camera: the song (cover + equaliser), the
 *            wake-up (dot + seconds) or a reconnect prompt. Idle = just the pill.
 *  Expanded  grows down into a card with the camera in its top edge:
 *            · a toast (2.6 s), · a line peeked when you open Lenses (4.5 s),
 *            · tap: the song with play/pause, the wake-up, reconnect, and a line
 *              (tap it for the next). Tap outside, or wait, and it springs back.
 *
 * Cover screen: no camera up top (the ring round the rear cameras shows the song), so no
 * pill — toasts and the wake-up appear as cards under the status bar. Half-folded: the
 * song lobes step aside while the tabletop view is showing it.
 */

const TOAST_MS = 2600
const PEEK_MS = 4500
const PANEL_MS = 7000
const RADIUS_OPEN = 26

type Body = 'toast' | 'peek' | 'panel' | 'wake'

export function Island({ authed }: { authed: boolean }) {
  // Logged out (the sign-in screen): toasts and the wake-up only — no Spotify polling.
  return authed ? <AuthedIsland /> : <IslandView np={null} needsReconnect={false} />
}

function AuthedIsland() {
  const { np, needsReconnect } = useNowPlaying()
  return <IslandView np={np} needsReconnect={needsReconnect} />
}

function IslandView({ np, needsReconnect }: { np: NowPlaying | null; needsReconnect: boolean }) {
  const { width: W } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const cover = useIsCover()
  const tabletop = useTabletopActive()
  const reduced = useMotionReduced()
  const path = usePathname()
  const g = islandGeometry(W, insets.top, cover)

  const { login, isLoading } = useAuth()
  const waking = useServerWaking()
  const [pos, setPos] = useState(getNowPlayingPos)
  useEffect(() => onNowPlayingPos(setPos), [])

  // ── what's in it ──
  const [toast, setToastState] = useState<ToastOptions | null>(null)
  const toastRef = useRef<ToastOptions | null>(null)
  const setToast = (v: ToastOptions | null) => { toastRef.current = v; setToastState(v) }
  const [panel, setPanelState] = useState<null | 'peek' | 'panel'>(null)
  const panelRef = useRef<null | 'peek' | 'panel'>(null)
  const setPanel = useCallback((v: null | 'peek' | 'panel') => { panelRef.current = v; setPanelState(v) }, [])
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = onToast(t => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      AccessibilityInfo.announceForAccessibility(t.message)
      setToast(t)
      toastTimer.current = setTimeout(() => setToast(null), t.duration ?? TOAST_MS)
    })
    return () => { unsub(); if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  const close = useCallback(() => {
    if (panelTimer.current) clearTimeout(panelTimer.current)
    setPanel(null)
  }, [])
  const openFor = useCallback((kind: 'peek' | 'panel', ms: number) => {
    if (panelTimer.current) clearTimeout(panelTimer.current)
    setPanel(kind)
    panelTimer.current = setTimeout(() => setPanel(null), ms)
  }, [])
  useEffect(() => () => { if (panelTimer.current) clearTimeout(panelTimer.current) }, [])

  // The strip's lines: rebuilt each time one is shown (your numbers change).
  const [pool, setPool] = useState<string[]>(() => buildPool())
  const [li, setLi] = useState(() => Math.floor(Math.random() * Math.max(pool.length, 1)))
  const nextLine = useCallback(() => {
    const p = buildPool()
    setPool(p)
    setLi(i => (i + 1) % Math.max(p.length, 1))
  }, [])

  // Arriving on Lenses: peek one line (once per visit), unless something's already up.
  const prevPath = useRef<string | null>(null)
  useEffect(() => {
    const arrived = path === '/' && prevPath.current !== '/'
    prevPath.current = path
    if (!arrived || cover) return
    const t = setTimeout(() => {
      if (panelRef.current || toastRef.current) return
      nextLine()
      openFor('peek', PEEK_MS)
    }, 700)
    return () => clearTimeout(t)
  }, [path, cover])

  const isTrack = !!np?.item && np.type === 'track'
  const topPlacement = pos === 'top'
  const compact: IslandCompact =
    !g.pill ? 'idle'
    : waking !== null ? 'waking'
    : topPlacement && isTrack && !tabletop ? 'song'
    : topPlacement && needsReconnect && !isTrack ? 'reconnect'
    : 'idle'
  const body: Body | null = toast ? 'toast' : panel ?? (!g.pill && waking !== null ? 'wake' : null)
  const open = body !== null

  // Keep the last body on screen while the card shrinks back.
  const [shownBody, setShownBody] = useState<Body | null>(body)
  const lastToast = useRef<ToastOptions | null>(null)
  if (toast) lastToast.current = toast
  useEffect(() => { if (body) setShownBody(body) }, [body])

  // ── motion: one spring for the morph; the compact width springs between states ──
  const t = useSharedValue(0)
  const cw = useSharedValue(compactWidth(g, compact))
  const ch = useSharedValue(g.contentTop + 48)
  const [contentH, setContentH] = useState(48)

  useEffect(() => {
    const target = compactWidth(g, compact)
    cw.value = reduced ? withTiming(target, { duration: 160 }) : withSpring(target, Spring.snappy)
  }, [compact, g.h, g.pill])
  useEffect(() => {
    const target = g.contentTop + contentH + Spacing.md
    ch.value = reduced ? withTiming(target, { duration: 160 }) : withSpring(target, Spring.snappy)
  }, [contentH, g.contentTop])
  useEffect(() => {
    if (open) t.value = reduced ? withTiming(1, { duration: 180 }) : withSpring(1, Spring.bouncy)
    else t.value = reduced ? withTiming(0, { duration: 160 }) : withSpring(0, Spring.default)
  }, [open])

  const pillH = g.pill ? g.h : 0
  const expW = g.expandedW
  const cardStyle = useAnimatedStyle(() => {
    const k = t.value
    const w = cw.value + (expW - cw.value) * k
    const h = pillH + (ch.value - pillH) * k
    return {
      width: Math.max(0, w),
      height: Math.max(0, h),
      left: (W - w) / 2,
      borderRadius: pillH / 2 + (RADIUS_OPEN - pillH / 2) * Math.min(1, Math.max(0, k)),
      // No pill on the cover: the card only exists while open.
      opacity: pillH > 0 ? 1 : Math.min(1, Math.max(0, k * 1.5)),
    }
  })
  const lobeStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - t.value * 2.5) }))
  const contentStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (t.value - 0.4) / 0.5)) }))

  // ── the song (for lobes and the panel); no stats lookup here ──
  const m = useNowPlayingModel(isTrack ? np : null, body === 'panel', false)

  const onPress = () => {
    if (body === 'panel') { close(); return }
    haptic.light()
    openFor('panel', PANEL_MS)
  }
  // Any touch inside the panel keeps it open a while longer.
  const touch = () => { if (panel === 'panel') openFor('panel', PANEL_MS) }

  if (!g.pill && !open && shownBody === null) return null
  const line = pool[li] ?? QUOTES[0]
  const [glyph, rest] = splitGlyph(line)
  const lineAccent = LINE_ACCENTS[li % LINE_ACCENTS.length]
  const b = body ?? shownBody

  const label =
    compact === 'song' ? `Now playing: ${m.item?.name ?? ''}. Tap for controls`
    : compact === 'waking' ? `Waking up the server, ${waking ?? 0} seconds`
    : compact === 'reconnect' ? 'Reconnect Spotify'
    : 'Island. Tap to open'

  return (
    <>
      {body === 'panel' && (
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={close}
          accessibilityRole="button" accessibilityLabel="Close the island" />
      )}
      <Animated.View style={[styles.card, { top: g.top }, cardStyle]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onPress} disabled={!g.pill && body !== 'panel'}
          accessibilityRole="button" accessibilityLabel={label} />

        {/* compact: two lobes, the camera between them */}
        {g.pill && compact !== 'idle' && (
          <Animated.View style={[styles.lobes, { height: pillH }, lobeStyle]} pointerEvents="none">
            <View style={[styles.lobe, { width: LOBE[compact] }]}>
              {compact === 'song' ? (
                m.art ? <Image source={{ uri: m.art }} style={styles.lobeArt} contentFit="cover" />
                      : <Icon name="musical-note" size={14} color={Colors.greenPrimary} />
              ) : compact === 'waking' ? <WakeDot />
                : <Ionicons name="sync" size={14} color={Colors.greenPrimary} />}
            </View>
            <View style={[styles.lobe, { width: LOBE[compact] }]}>
              {compact === 'song' ? <Equalizer playing={m.playing} color={m.pal?.detail ?? Colors.greenPrimary} reduced={reduced} />
                : compact === 'waking' ? <Text style={styles.lobeText}>{waking}s</Text>
                : <View style={styles.dot} />}
            </View>
          </Animated.View>
        )}

        {/* expanded: below the camera */}
        {b && (
          <Animated.View style={[styles.content, { top: g.contentTop, width: expW, marginLeft: -expW / 2 }, contentStyle]}
            pointerEvents={open ? 'box-none' : 'none'}
            onLayout={e => setContentH(Math.round(e.nativeEvent.layout.height))}
            accessibilityLiveRegion="polite">
            {b === 'toast' && lastToast.current && (
              <View style={styles.row}>
                {lastToast.current.glyph ? <Icon name={lastToast.current.glyph} size={16} color={Colors.greenPrimary} /> : null}
                <Text style={styles.toastText} numberOfLines={2}>{lastToast.current.message}</Text>
              </View>
            )}

            {(b === 'wake' || (b === 'panel' && waking !== null)) && (
              <View style={styles.block}>
                <View style={styles.row}>
                  <WakeDot />
                  <Text style={styles.wakeTitle}>Waking up the server<Text style={styles.wakeSecs}>{'  '}{waking ?? 0}s</Text></Text>
                </View>
                <Text style={styles.sub} numberOfLines={1}>{wakeCopy(waking ?? 0)}</Text>
                <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(wakeProgress(waking ?? 0) * 100)}%` }]} /></View>
              </View>
            )}

            {b === 'panel' && needsReconnect && (
              <Pressable style={styles.row} disabled={isLoading}
                onPress={() => { haptic.medium(); touch(); login() }} accessibilityRole="button">
                <Ionicons name="sync" size={16} color={Colors.greenPrimary} />
                <Text style={styles.toastText} numberOfLines={1}>{isLoading ? 'Opening Spotify…' : 'Reconnect Spotify — new features need it'}</Text>
              </Pressable>
            )}

            {b === 'panel' && isTrack && (
              <View style={styles.block}>
                <View style={styles.row}>
                  <Pressable style={styles.songTap} onPress={() => { haptic.light(); close(); emitOpenNowPlaying() }}
                    accessibilityRole="button" accessibilityLabel={`${m.item?.name ?? ''}. Open Now playing`}>
                    {m.art ? <Image source={{ uri: m.art }} style={styles.panelArt} contentFit="cover" transition={150} />
                           : <View style={[styles.panelArt, styles.artFallback]}><Icon name="musical-note" size={18} color={Colors.greenPrimary} /></View>}
                    <View style={styles.songText}>
                      <Text style={styles.songName} numberOfLines={1}>{m.item?.name}</Text>
                      <Text style={styles.sub} numberOfLines={1}>{m.item?.artists?.join(', ')}</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => { touch(); m.onPlayPause() }} disabled={m.busy} hitSlop={8}
                    style={styles.playBtn} accessibilityRole="button" accessibilityLabel={m.playing ? 'Pause' : 'Play'}>
                    <Ionicons name={m.playing ? 'pause' : 'play'} size={18} color="#000" />
                  </Pressable>
                  <Pressable onPress={() => { touch(); m.onNext() }} disabled={m.busy} hitSlop={8}
                    style={styles.nextBtn} accessibilityRole="button" accessibilityLabel="Next track">
                    <Ionicons name="play-skip-forward" size={18} color={ISLAND_TEXT} />
                  </Pressable>
                </View>
                {m.dur > 0 && (
                  <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(m.liveMs / m.dur, 1) * 100}%`, backgroundColor: m.pal?.detail ?? Colors.greenPrimary }]} /></View>
                )}
              </View>
            )}

            {(b === 'peek' || b === 'panel') && (
              <Pressable style={styles.row} disabled={b !== 'panel'}
                onPress={() => { haptic.light(); touch(); nextLine() }}
                accessibilityRole="button" accessibilityLabel={`${rest}. Tap for the next line`}>
                <GlyphOrIcon glyph={glyph} size={14} color={lineAccent} />
                <Text style={styles.lineText} numberOfLines={2}>{rest}</Text>
              </Pressable>
            )}
          </Animated.View>
        )}
      </Animated.View>
    </>
  )
}

// ── small equaliser for the song lobe, in the cover's colour ──
function Equalizer({ playing, color, reduced }: { playing: boolean; color: string; reduced: boolean }) {
  const h1 = useSharedValue(4), h2 = useSharedValue(9), h3 = useSharedValue(6)
  useEffect(() => {
    const bars: Array<[typeof h1, number, number, number]> = [[h1, 12, 4, 460], [h2, 14, 6, 380], [h3, 10, 3, 540]]
    if (playing && !reduced) {
      bars.forEach(([v, hi, lo, dur]) => {
        v.value = withRepeat(withSequence(
          withTiming(hi, { duration: dur, easing: Easing.inOut(Easing.quad) }),
          withTiming(lo, { duration: dur, easing: Easing.inOut(Easing.quad) }),
        ), -1, true)
      })
    } else {
      bars.forEach(([v]) => { cancelAnimation(v); v.value = withTiming(3, { duration: 200 }) })
    }
    return () => { cancelAnimation(h1); cancelAnimation(h2); cancelAnimation(h3) }
  }, [playing, reduced])
  const s1 = useAnimatedStyle(() => ({ height: h1.value }))
  const s2 = useAnimatedStyle(() => ({ height: h2.value }))
  const s3 = useAnimatedStyle(() => ({ height: h3.value }))
  return (
    <View style={styles.eq}>
      <Animated.View style={[styles.eqBar, { backgroundColor: color }, s1]} />
      <Animated.View style={[styles.eqBar, { backgroundColor: color }, s2]} />
      <Animated.View style={[styles.eqBar, { backgroundColor: color }, s3]} />
    </View>
  )
}

// The island is always black (it hides the camera), so its text is always light.
const ISLAND_TEXT = '#F2F0F3'
const ISLAND_MUTED = 'rgba(242,240,243,0.56)'

const styles = StyleSheet.create({
  backdrop: { zIndex: 69, elevation: 69 },
  card: {
    position: 'absolute', zIndex: 70, elevation: 70, overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16,
  },
  lobes:     { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', justifyContent: 'space-between' },
  lobe:      { alignItems: 'center', justifyContent: 'center' },
  lobeArt:   { width: 20, height: 20, borderRadius: 10 },
  lobeText:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.greenPrimary },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.greenPrimary },
  content:   { position: 'absolute', left: '50%', paddingHorizontal: Spacing.lg, gap: Spacing.sm + 2 },
  block:     { gap: Spacing.xs + 2 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toastText: { flex: 1, fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: ISLAND_TEXT },
  lineText:  { flex: 1, fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: ISLAND_MUTED, letterSpacing: 0.3 },
  wakeTitle: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.greenPrimary },
  wakeSecs:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: alpha(Colors.greenPrimary, 0.6) },
  sub:       { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: ISLAND_MUTED },
  track:     { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  fill:      { height: 3, borderRadius: 2, backgroundColor: Colors.greenPrimary },
  songTap:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 0 },
  panelArt:  { width: 44, height: 44, borderRadius: 12 },
  artFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  songText:  { flex: 1, minWidth: 0 },
  songName:  { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: ISLAND_TEXT, letterSpacing: -0.3 },
  playBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: ISLAND_TEXT },
  nextBtn:   { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  eq:        { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  eqBar:     { width: 3, borderRadius: 1.5 },
})
