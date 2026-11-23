import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePathname } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useMotionReduced } from '@/components/motion'
import { Icon } from '@/components/ui/Icon'
import { WakeDot } from '@/components/ui/ServerState'
import { useNowPlaying, type NowPlaying } from '@/hooks/useNowPlaying'
import { useAuth } from '@/hooks/useAuth'
import { useServerWaking } from '@/hooks/useServerWaking'
import { useIsCover } from '@/hooks/useScreen'
import { useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'
import { onToast, type ToastOptions } from '@/utils/dialog'
import { emitOpenNowPlaying } from '@/utils/overlayEvents'
import { storage } from '@/utils/cache'
import { wakeCopy, wakeProgress } from '@/utils/serverStatus'
import {
  CARD, DEFAULT_REST, SPOT, cardRect, clamp, restPoint, restX, snapSide, yRange,
  type SpotArea, type SpotSide,
} from '@/utils/spot'

/**
 * The spot (2.0.23): a small glowing dot that floats over the app. Drag it anywhere —
 * let go and it springs to the nearest side, stretching as it flies and wobbling as it
 * lands. It stays a dot until it has something to say, then opens into a card from
 * where it sits:
 *   · a toast ("added to queue", errors) for 2.6 s
 *   · the server waking up (once, then the dot pulses until it's awake)
 *   · Spotify needing a reconnect (once a session)
 * Tap it for the song playing (play/pause, skip, open Now playing) and anything pending.
 * Its colour follows the song's cover; a new song sends one ripple out of it.
 *
 * No motion while idle: it only moves when dragged, opened or a song changes.
 * Cover screen: keeps clear of the cameras. Hidden (unless it has news) in stories.
 */

const TOAST_MS = 2600
const WAKE_MS = 4000
const RECONNECT_MS = 5000
const PANEL_MS = 7000
const REST_KEY = 'spot.rest.v1'

type Body = 'toast' | 'wake' | 'reconnect' | 'panel'

function readRest(): { side: SpotSide; yFrac: number } {
  try {
    const raw = storage.getString(REST_KEY)
    const v = raw ? JSON.parse(raw) : null
    if (v && (v.side === 'left' || v.side === 'right') && typeof v.yFrac === 'number' && Number.isFinite(v.yFrac)) {
      return { side: v.side, yFrac: clamp(v.yFrac, 0, 1) }
    }
  } catch {}
  return { ...DEFAULT_REST }
}

export function Spot({ authed }: { authed: boolean }) {
  // Logged out (the sign-in screen): toasts and the wake-up only — no Spotify polling.
  return authed ? <AuthedSpot /> : <SpotView np={null} needsReconnect={false} />
}

function AuthedSpot() {
  const { np, needsReconnect } = useNowPlaying()
  return <SpotView np={np} needsReconnect={needsReconnect} />
}

function SpotView({ np, needsReconnect }: { np: NowPlaying | null; needsReconnect: boolean }) {
  const { width: W, height: H } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const cover = useIsCover()
  const reduced = useMotionReduced()
  const path = usePathname()
  const area: SpotArea = { W, H, insetTop: insets.top, insetBottom: insets.bottom, cover }
  const { login, isLoading } = useAuth()
  const waking = useServerWaking()

  // ── where it rests ──
  const [rest, setRest] = useState(readRest)
  const start = restPoint(rest.side, rest.yFrac, area)
  const x = useSharedValue(start.x)
  const y = useSharedValue(start.y)
  // The window changed (fold/unfold, cover screen): settle onto the same side and height.
  useEffect(() => {
    const p = restPoint(rest.side, rest.yFrac, area)
    x.value = reduced ? p.x : withSpring(p.x, Spring.default)
    y.value = reduced ? p.y : withSpring(p.y, Spring.default)
  }, [W, H, cover, insets.top])

  const saveRest = useCallback((side: SpotSide, cy: number) => {
    const r = { side, yFrac: H > 0 ? cy / H : DEFAULT_REST.yFrac }
    setRest(r)
    try { storage.set(REST_KEY, JSON.stringify(r)) } catch {}
  }, [H])

  // ── what it has to say ──
  const [body, setBodyState] = useState<Body | null>(null)
  const bodyRef = useRef<Body | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toast, setToast] = useState<ToastOptions | null>(null)
  const setBody = useCallback((b: Body | null, ms?: number) => {
    if (timer.current) clearTimeout(timer.current)
    bodyRef.current = b
    setBodyState(b)
    if (b && ms) timer.current = setTimeout(() => { bodyRef.current = null; setBodyState(null) }, ms)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  useEffect(() => onToast(t => {
    AccessibilityInfo.announceForAccessibility(t.message)
    setToast(t)
    setBody('toast', t.duration ?? TOAST_MS)
  }), [])

  // The server starts waking: say so once, then pulse until it's up.
  const isWaking = waking !== null
  useEffect(() => {
    if (isWaking && (!bodyRef.current || bodyRef.current === 'panel')) setBody('wake', WAKE_MS)
    if (!isWaking && bodyRef.current === 'wake') setBody(null)
  }, [isWaking])

  // Spotify needs a reconnect: say so once a session.
  const saidReconnect = useRef(false)
  useEffect(() => {
    if (!needsReconnect || saidReconnect.current) return
    saidReconnect.current = true
    if (!bodyRef.current) setBody('reconnect', RECONNECT_MS)
  }, [needsReconnect])

  const isTrack = !!np?.item && np.type === 'track'
  const m = useNowPlayingModel(isTrack ? np : null, body === 'panel', false)
  const dotColor = isWaking ? Colors.greenPrimary : (isTrack && m.pal?.detail) || Colors.greenPrimary

  // ── motion ──
  const t = useSharedValue(0)                 // 0 = dot, 1 = card
  const cl = useSharedValue(0), ct = useSharedValue(0), cw = useSharedValue(0), ch = useSharedValue(60)
  const sx = useSharedValue(0), sy = useSharedValue(0)  // stretch (drag velocity)
  const ripple = useSharedValue(0)
  const pulse = useSharedValue(0)
  const [contentH, setContentH] = useState(60)
  // Content is laid out at the card's final width, so its height doesn't change mid-open.
  const cardW = cardRect(rest.side, 0, 0, area).width

  const open = body !== null
  useEffect(() => {
    if (open) {
      const r = cardRect(rest.side, y.value, contentH, area)
      cl.value = r.left; ct.value = r.top; cw.value = r.width
      t.value = reduced ? withTiming(1, { duration: 180 }) : withSpring(1, Spring.bouncy)
    } else {
      t.value = reduced ? withTiming(0, { duration: 160 }) : withSpring(0, Spring.default)
    }
  }, [open])
  useEffect(() => {
    ch.value = reduced ? contentH : withSpring(contentH, Spring.snappy)
    if (open) ct.value = withSpring(cardRect(rest.side, y.value, contentH, area).top, Spring.snappy)
  }, [contentH])

  // A new song: one ripple out of the dot.
  const songId = isTrack ? m.item?.id : null
  useEffect(() => {
    if (!songId || reduced) return
    ripple.value = 0
    ripple.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })
  }, [songId])
  // Waking: the dot pulses (only while it lasts).
  useEffect(() => {
    if (isWaking && !reduced) {
      pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1)
    } else { cancelAnimation(pulse); pulse.value = withTiming(0, { duration: 200 }) }
    return () => cancelAnimation(pulse)
  }, [isWaking, reduced])

  // ── drag + tap (only while it's a dot) ──
  const [lo, hi] = yRange(area)
  const dragStart = useSharedValue({ x: 0, y: 0 })
  const onTap = useCallback(() => {
    haptic.light()
    if (bodyRef.current === 'panel') setBody(null)
    else setBody('panel', PANEL_MS)
  }, [])
  const onLand = useCallback((side: SpotSide, cy: number) => { haptic.light(); saveRest(side, cy) }, [saveRest])
  const pan = Gesture.Pan()
    .enabled(!open)
    .minDistance(4)
    .onBegin(() => { dragStart.value = { x: x.value, y: y.value } })
    .onUpdate(e => {
      x.value = clamp(dragStart.value.x + e.translationX, SPOT.margin, W - SPOT.margin)
      y.value = clamp(dragStart.value.y + e.translationY, lo, hi)
      sx.value = clamp(e.velocityX / 2200, -0.5, 0.5)
      sy.value = clamp(e.velocityY / 2200, -0.5, 0.5)
    })
    .onEnd(e => {
      const side = snapSide(x.value, e.velocityX, W)
      const ty = clamp(y.value + e.velocityY * 0.08, lo, hi)
      x.value = withSpring(restX(side, W), { ...Spring.bouncy, velocity: e.velocityX })
      y.value = withSpring(ty, { ...Spring.default, velocity: e.velocityY })
      sx.value = withSpring(0, Spring.bouncy)
      sy.value = withSpring(0, Spring.bouncy)
      runOnJS(onLand)(side, ty)
    })
  const tap = Gesture.Tap().enabled(!open).onEnd((_e, ok) => { if (ok) runOnJS(onTap)() })
  const gesture = Gesture.Exclusive(pan, tap)

  // ── styles ──
  const D = SPOT.dot
  const cardStyle = useAnimatedStyle(() => {
    const k = t.value, kc = Math.min(1, Math.max(0, k))
    const w = D + (cw.value - D) * k
    const h = D + (ch.value - D) * k
    // Stretch along the drag: longer the way it's flying, thinner across.
    const speed = Math.min(0.5, Math.sqrt(sx.value * sx.value + sy.value * sy.value))
    const angle = Math.atan2(sy.value, sx.value)
    return {
      left: x.value - D / 2 + (cl.value - (x.value - D / 2)) * k,
      top: y.value - D / 2 + (ct.value - (y.value - D / 2)) * k,
      width: Math.max(D * 0.6, w),
      height: Math.max(D * 0.6, h),
      borderRadius: D / 2 + (CARD.radius - D / 2) * kc,
      transform: [
        { rotate: `${angle}rad` }, { scaleX: 1 + speed * (1 - kc) }, { scaleY: 1 - speed * 0.45 * (1 - kc) }, { rotate: `${-angle}rad` },
        { scale: 1 + pulse.value * 0.25 * (1 - kc) },
      ],
    }
  })
  const fillStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - t.value * 2) }))
  const contentStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (t.value - 0.45) / 0.45)) }))
  const hitStyle = useAnimatedStyle(() => ({ left: x.value - SPOT.hit / 2, top: y.value - SPOT.hit / 2 }))
  const rippleStyle = useAnimatedStyle(() => ({
    left: x.value - D / 2, top: y.value - D / 2,
    opacity: ripple.value > 0 && ripple.value < 1 ? (1 - ripple.value) * 0.7 : 0,
    transform: [{ scale: 1 + ripple.value * 2.6 }],
  }))

  // In stories (full-screen) and the cover lab the dot stays out of the way unless it has news.
  const quiet = path === '/story' || path === '/cover-lab'
  if (quiet && !open) return null

  const close = () => setBody(null)
  const keep = () => { if (bodyRef.current === 'panel') setBody('panel', PANEL_MS) }
  const label = isWaking ? `Waking up the server, ${waking} seconds. Tap for details`
    : isTrack ? `Spot: ${m.item?.name ?? ''} is playing. Tap for controls, drag to move`
    : 'Spot. Tap to open, drag to move'

  return (
    <>
      {body === 'panel' && (
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={close}
          accessibilityRole="button" accessibilityLabel="Close" />
      )}

      <Animated.View pointerEvents="none" style={[styles.ripple, { width: D, height: D, borderRadius: D / 2, borderColor: dotColor }, rippleStyle]} />

      <Animated.View style={[styles.card, cardStyle]} pointerEvents={open ? 'box-none' : 'none'}>
        {/* the dot itself: a glowing fill that fades as it opens into the card */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: dotColor, shadowColor: dotColor }, styles.glow, fillStyle]} />

        {body && (
          <Animated.View style={[styles.content, { width: cardW }, contentStyle]} pointerEvents={open ? 'box-none' : 'none'}
            onLayout={e => setContentH(Math.round(e.nativeEvent.layout.height))} accessibilityLiveRegion="polite">
            {body === 'toast' && toast && (
              <View style={styles.row}>
                {toast.glyph ? <Icon name={toast.glyph} size={16} color={Colors.greenPrimary} /> : null}
                <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
              </View>
            )}

            {(body === 'wake' || (body === 'panel' && isWaking)) && (
              <View style={styles.block}>
                <View style={styles.row}>
                  <WakeDot />
                  <Text style={styles.wakeTitle}>Waking up the server<Text style={styles.wakeSecs}>{'  '}{waking ?? 0}s</Text></Text>
                </View>
                <Text style={styles.sub} numberOfLines={1}>{wakeCopy(waking ?? 0)}</Text>
                <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(wakeProgress(waking ?? 0) * 100)}%` }]} /></View>
              </View>
            )}

            {(body === 'reconnect' || (body === 'panel' && needsReconnect)) && (
              <Pressable style={styles.row} disabled={isLoading} accessibilityRole="button"
                onPress={() => { haptic.medium(); close(); login() }}>
                <Ionicons name="sync" size={16} color={Colors.greenPrimary} />
                <Text style={styles.text} numberOfLines={2}>{isLoading ? 'Opening Spotify…' : 'Reconnect Spotify — new features need a quick sign-in'}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </Pressable>
            )}

            {body === 'panel' && isTrack && (
              <View style={styles.block}>
                <View style={styles.row}>
                  <Pressable style={styles.songTap} onPress={() => { haptic.light(); close(); emitOpenNowPlaying() }}
                    accessibilityRole="button" accessibilityLabel={`${m.item?.name ?? ''}. Open Now playing`}>
                    {m.art ? <Image source={{ uri: m.art }} style={styles.art} contentFit="cover" transition={150} />
                           : <View style={[styles.art, styles.artFallback]}><Icon name="musical-note" size={18} color={Colors.greenPrimary} /></View>}
                    <View style={styles.songText}>
                      <Text style={styles.songName} numberOfLines={1}>{m.item?.name}</Text>
                      <Text style={styles.sub} numberOfLines={1}>{m.item?.artists?.join(', ')}</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => { keep(); m.onPlayPause() }} disabled={m.busy} hitSlop={8}
                    style={[styles.playBtn, { backgroundColor: dotColor }]} accessibilityRole="button" accessibilityLabel={m.playing ? 'Pause' : 'Play'}>
                    <Ionicons name={m.playing ? 'pause' : 'play'} size={18} color={Colors.background} />
                  </Pressable>
                  <Pressable onPress={() => { keep(); m.onNext() }} disabled={m.busy} hitSlop={8}
                    style={styles.nextBtn} accessibilityRole="button" accessibilityLabel="Next track">
                    <Ionicons name="play-skip-forward" size={18} color={Colors.text} />
                  </Pressable>
                </View>
                {m.dur > 0 && (
                  <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(m.liveMs / m.dur, 1) * 100}%`, backgroundColor: dotColor }]} /></View>
                )}
              </View>
            )}

            {body === 'panel' && !isTrack && !isWaking && !needsReconnect && (
              <Text style={styles.sub}>Nothing to say right now. Drag me anywhere — I'll pop open when there's news.</Text>
            )}
          </Animated.View>
        )}
      </Animated.View>

      {/* touch target round the dot (drag + tap); off while it's open */}
      {!open && (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.hit, hitStyle]} accessible accessibilityRole="button" accessibilityLabel={label}
            onAccessibilityTap={onTap} />
        </GestureDetector>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { zIndex: 69, elevation: 69 },
  card: {
    position: 'absolute', zIndex: 70, elevation: 70, overflow: 'hidden',
    backgroundColor: Colors.sheet, borderWidth: 1, borderColor: Colors.glassBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16,
  },
  glow:      { shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  ripple:    { position: 'absolute', zIndex: 70, elevation: 70, borderWidth: 2 },
  hit:       { position: 'absolute', zIndex: 71, elevation: 71, width: SPOT.hit, height: SPOT.hit, borderRadius: SPOT.hit / 2 },
  content:   { position: 'absolute', left: 0, top: 0, padding: Spacing.md + 2, gap: Spacing.sm + 2 },
  block:     { gap: Spacing.xs + 2 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  text:      { flex: 1, fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  wakeTitle: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.greenPrimary },
  wakeSecs:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: alpha(Colors.greenPrimary, 0.6) },
  sub:       { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  track:     { height: 3, borderRadius: 2, backgroundColor: alpha(Colors.greenPrimary, 0.16), overflow: 'hidden' },
  fill:      { height: 3, borderRadius: 2, backgroundColor: Colors.greenPrimary },
  songTap:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 0 },
  art:       { width: 44, height: 44, borderRadius: 12 },
  artFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.glass },
  songText:  { flex: 1, minWidth: 0 },
  songName:  { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text, letterSpacing: -0.3 },
  playBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  nextBtn:   { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
})
