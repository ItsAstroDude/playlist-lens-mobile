import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, Pressable, BackHandler, Dimensions,
  type LayoutChangeEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Svg, { Defs, Mask, Rect } from 'react-native-svg'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, FadeIn,
} from 'react-native-reanimated'
import {
  ACCENTS, Colors, FontFamily, FontSize, Spacing, Radius, OnDark,
  activeAccentId, alpha,
} from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { setTabBarHidden } from '@/utils/tabBar'
import { measureTourTarget, type TourRect } from '@/utils/tourTargets'
import { loadCachedWrapped } from '@/hooks/useWrapped'

// The tour scrim is always dark (it dims the live app), so — like the now-playing
// bar on its dark surface — it uses the RAW accent hue + OnDark text rather than
// the light-mode-darkened Colors.greenPrimary, which would wash out on the dim.
const RAW_ACCENT = (ACCENTS.find(a => a.id === activeAccentId()) ?? ACCENTS[0]).hex
const SCRIM      = '#070709'
const BODY_TXT   = 'rgba(231,228,236,0.74)'
const HOLE_PAD   = 10
const HOLE_RADIUS = 18

type TabRoute = 'index' | 'compare' | 'wrapped' | 'swipe'

interface Step {
  route:    TabRoute
  targetId: string | null   // tour target to spotlight; null = centred card
  glyph:    string
  tint:     string
  title:    string
  body:     string
}

// Tab routes are navigated imperatively from this root overlay (the bar items
// register themselves as tour targets; see utils/tourTargets).
const ROUTE_HREF: Record<TabRoute, string> = {
  index:   '/(tabs)',
  compare: '/compare',
  wrapped: '/wrapped',
  swipe:   '/swipe',
}

// Built once per run so the Wrapped step can be dropped when there's no history
// imported yet (nothing to show there — locked decision, see v1.3 progress).
function buildSteps(): Step[] {
  const hasWrapped = !!loadCachedWrapped()
  const steps: Step[] = [
    {
      route: 'index', targetId: null, glyph: '✦', tint: RAW_ACCENT,
      title: 'Welcome to playlist.lens',
      body:  'Your library, seen in a new light. Here’s a quick guided tour — tap anywhere or Next to move along.',
    },
    {
      route: 'index', targetId: 'tab:index', glyph: '◎', tint: RAW_ACCENT,
      title: 'Lenses',
      body:  'Every playlist you own, analysed. Tap a lens for its sound, genres and era — long-press one for quick actions: Pin, Share or Re-analyze.',
    },
    {
      route: 'compare', targetId: 'tab:compare', glyph: '◍', tint: Colors.pink,
      title: 'Compare',
      body:  'Put two playlists head-to-head and see how their vibes stack up.',
    },
  ]
  if (hasWrapped) {
    steps.push({
      route: 'wrapped', targetId: 'tab:wrapped', glyph: '◐', tint: Colors.lavender,
      title: 'Wrapped',
      body:  'Your all-time listening stats. Tap any artist, track or album for its artwork — and fix it yourself if it’s ever wrong.',
    })
  }
  steps.push({
    route: 'swipe', targetId: 'tab:swipe', glyph: '◆', tint: RAW_ACCENT,
    title: 'Swipe — new',
    body:  'Tidy a playlist Tinder-style: swipe to keep or cut, with 30-second previews. Nothing changes until you confirm — save the keepers as a new playlist, or trim the original with a backup.',
  })
  steps.push({
    route: 'index', targetId: null, glyph: '⟳', tint: RAW_ACCENT,
    title: 'You’re all set',
    body:  'When Spotify’s playing, a live bar shows your track — tap it for your personal stats. Updates arrive on their own; grab them anytime from Settings › Check for updates.',
  })
  return steps
}

export function Tutorial({ onDone }: { onDone: () => void }) {
  const steps = useMemo(buildSteps, [])
  const [i, setI]       = useState(0)
  const [rect, setRect] = useState<TourRect | null>(null)
  const [size, setSize] = useState(() => {
    const { width, height } = Dimensions.get('window')
    return { width, height }
  })
  const step = steps[i]
  const last = i === steps.length - 1

  const finish = useCallback(() => {
    haptic.success()
    go('index')
    onDone()
  }, [onDone])

  // Hardware back finishes the tour (don't trap the user behind the scrim).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { finish(); return true })
    return () => sub.remove()
  }, [finish])

  // Replay can launch from Settings (pushed on the stack) — drop back to the
  // tabs so the spotlights land on the live navbar.
  useEffect(() => {
    try { if (router.canDismiss?.()) router.dismissAll() } catch {}
  }, [])

  // Per step: navigate to its tab, reveal the bar, then measure the target. The
  // bar mounts every item regardless of the active tab, so this resolves quickly;
  // we still retry once in case the reveal animation is mid-flight.
  useEffect(() => {
    let cancelled = false
    setRect(null)
    go(step.route)
    setTabBarHidden(false)
    if (!step.targetId) return

    const attempt = async () => {
      const r = await measureTourTarget(step.targetId!)
      if (!cancelled && r) setRect(r)
    }
    const t1 = setTimeout(attempt, 360)
    const t2 = setTimeout(attempt, 720)
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2) }
  }, [i])

  const next = () => { if (last) finish(); else { haptic.light(); setI(i + 1) } }
  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width && height) setSize({ width, height })
  }

  // ── Spotlight ring pulse ──
  const pulse = useSharedValue(0)
  useEffect(() => { pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true) }, [])
  const ringStyle = useAnimatedStyle(() => ({
    opacity:   0.55 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.045 }],
  }))

  const { width: W, height: H } = size
  const hole = rect
    ? { x: rect.x - HOLE_PAD, y: rect.y - HOLE_PAD, w: rect.width + HOLE_PAD * 2, h: rect.height + HOLE_PAD * 2 }
    : null

  // Tabs sit at the bottom, so anchor the caption above the hole; centre it when
  // there's nothing to spotlight (welcome / closing steps).
  const cardWrapStyle = hole
    ? { position: 'absolute' as const, left: Spacing.xl, right: Spacing.xl, bottom: H - hole.y + Spacing.lg }
    : { position: 'absolute' as const, left: Spacing.xl, right: Spacing.xl, top: 0, bottom: 0, justifyContent: 'center' as const }

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      {/* Dimming scrim with a rounded cut-out punched over the target */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="tourHole">
            <Rect x={0} y={0} width={W} height={H} fill="#fff" />
            {hole && (
              <Rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={HOLE_RADIUS} ry={HOLE_RADIUS} fill="#000" />
            )}
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={SCRIM} fillOpacity={0.93} mask="url(#tourHole)" />
      </Svg>

      {/* Tap anywhere to advance (sits above the scrim, below the controls) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={next} />

      {/* Spotlight ring around the cut-out */}
      {hole && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            ringStyle,
            { left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderColor: step.tint, shadowColor: step.tint },
          ]}
        />
      )}

      {/* Caption card */}
      <View style={cardWrapStyle} pointerEvents="box-none">
        <Animated.View key={i} entering={FadeIn.duration(220)}>
          <Pressable style={styles.card} onPress={next}>
            <View style={[styles.glyphChip, { borderColor: alpha(step.tint, 0.5), backgroundColor: alpha(step.tint, 0.12) }]}>
              <Text style={[styles.glyph, { color: step.tint }]}>{step.glyph}</Text>
            </View>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>

            <View style={styles.cardFooter}>
              <View style={styles.dots}>
                {steps.map((_, idx) => (
                  <View key={idx} style={[styles.dot, idx === i && [styles.dotActive, { backgroundColor: step.tint }]]} />
                ))}
              </View>
              <Pressable style={[styles.btn, { backgroundColor: step.tint }]} onPress={next} hitSlop={8}>
                <Text style={styles.btnText}>{last ? 'Start exploring' : 'Next'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Skip — always available */}
      <SafeAreaView style={styles.skipWrap} edges={['top']} pointerEvents="box-none">
        <Pressable hitSlop={12} onPress={() => { haptic.light(); finish() }}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  )
}

function go(route: TabRoute) {
  try { router.navigate(ROUTE_HREF[route] as never) } catch {}
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 70 },

  ring: {
    position: 'absolute',
    borderRadius: HOLE_RADIUS,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 0,
  },

  card: {
    backgroundColor: 'rgba(23,23,27,0.98)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: Spacing.xl,
  },
  glyphChip: {
    width: 48, height: 48, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  glyph: { fontSize: 24 },
  title: {
    fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: OnDark.text,
    letterSpacing: -0.6,
  },
  body: {
    fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: BODY_TXT,
    lineHeight: FontSize.sm * 1.6, marginTop: Spacing.sm,
  },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.xl,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotActive: { width: 20 },

  btn: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xl,
  },
  btnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: '#0b0b0d' },

  skipWrap: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
  },
  skip: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: 'rgba(231,228,236,0.6)' },
})
