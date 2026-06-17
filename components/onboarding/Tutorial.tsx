import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, Pressable, BackHandler, Dimensions,
  type LayoutChangeEvent,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, FadeIn, Easing,
} from 'react-native-reanimated'
import {
  ACCENTS, Colors, FontFamily, FontSize, Spacing, Radius, OnDark,
  activeAccentId, alpha,
} from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { setTabBarHidden } from '@/utils/tabBar'
import { getNavbarStyle } from '@/utils/settings'
import { loadCachedWrapped } from '@/hooks/useWrapped'

// The tour scrim is always dark (it dims the live app), so — like the now-playing
// bar on its dark surface — it uses the RAW accent hue + OnDark text rather than
// the light-mode-darkened Colors.greenPrimary, which would wash out on the dim.
const RAW_ACCENT  = (ACCENTS.find(a => a.id === activeAccentId()) ?? ACCENTS[0]).hex
const SCRIM_RGBA  = 'rgba(7,7,9,0.93)'
const BODY_TXT    = 'rgba(231,228,236,0.74)'
const HOLE_RADIUS = 16

// Glide between spotlights / collapse when there's nothing to highlight.
const GLIDE    = { duration: 460, easing: Easing.out(Easing.cubic) }
const COLLAPSE = { duration: 300, easing: Easing.in(Easing.cubic) }

type TabRoute = 'index' | 'queue' | 'wrapped' | 'swipe'
const ROUTE_INDEX: Record<TabRoute, number> = { index: 0, queue: 1, wrapped: 2, swipe: 3 }

interface Step {
  route:    TabRoute
  spotlight: boolean        // false = centred card, no cut-out (welcome / closing)
  glyph:    string
  tint:     string
  title:    string
  body:     string
}

// Tab routes are navigated imperatively from this root overlay so the live app
// behind the scrim shows the screen each step is describing.
const ROUTE_HREF: Record<TabRoute, string> = {
  index:   '/(tabs)',
  queue:   '/queue',
  wrapped: '/wrapped',
  swipe:   '/swipe',
}

// Built once per run so the Wrapped step can be dropped when there's no history
// imported yet (nothing to show there — locked decision, see v1.3 progress).
function buildSteps(): Step[] {
  const hasWrapped = !!loadCachedWrapped()
  const steps: Step[] = [
    {
      route: 'index', spotlight: false, glyph: '✦', tint: RAW_ACCENT,
      title: 'Welcome to playlist.lens',
      body:  'Your library, seen in a new light. Here’s a quick guided tour — tap anywhere or Next to move along.',
    },
    {
      route: 'index', spotlight: true, glyph: '◎', tint: RAW_ACCENT,
      title: 'Lenses',
      body:  'Every playlist you own, analysed. Tap a lens for its sound, genres and era — long-press one for quick actions: Pin, Share or Re-analyze.',
    },
    {
      route: 'queue', spotlight: true, glyph: '◍', tint: Colors.pink,
      title: 'Queue — new',
      body:  'Build a queue from anywhere and play it on your Spotify — hand-pick tracks or let the rediscovery shelves resurface old favorites. (Compare now lives in a playlist’s long-press menu.)',
    },
  ]
  if (hasWrapped) {
    steps.push({
      route: 'wrapped', spotlight: true, glyph: '◐', tint: Colors.lavender,
      title: 'Wrapped',
      body:  'Your all-time listening stats. Tap any artist, track or album for its artwork — and fix it yourself if it’s ever wrong.',
    })
  }
  steps.push({
    route: 'swipe', spotlight: true, glyph: '◆', tint: RAW_ACCENT,
    title: 'Swipe — new',
    body:  'Tidy a playlist Tinder-style: swipe to keep or cut, with 30-second previews. Nothing changes until you confirm — save the keepers as a new playlist, or trim the original with a backup.',
  })
  steps.push({
    route: 'index', spotlight: false, glyph: '⟳', tint: RAW_ACCENT,
    title: 'You’re all set',
    body:  'When Spotify’s playing, a live bar shows your track — tap it for your personal stats. Updates arrive on their own; grab them anytime from Settings › Check for updates.',
  })
  return steps
}

export function Tutorial({ onDone }: { onDone: () => void }) {
  const steps   = useMemo(buildSteps, [])
  const insets  = useSafeAreaInsets()
  const navStyle = getNavbarStyle()
  const [i, setI]       = useState(0)
  const [size, setSize] = useState(() => {
    const { width, height } = Dimensions.get('window')
    return { width, height }
  })
  const step = steps[i]
  const last = i === steps.length - 1
  const { width: W, height: H } = size

  // The floating bar is a fixed, known layout — derive each tab's rect from the
  // same safe-area insets the bar itself uses (utils/tabBar + (tabs)/_layout), so
  // the cut-out lands dead-on the icon. Measuring the live node instead drifts on
  // Android under edge-to-edge (window coords vs the full-screen overlay). null =
  // gestures-only navbar (no bar to spotlight) → centred card.
  const tabHole = useCallback((route: TabRoute) => {
    if (navStyle === 'gestures') return null
    const barBottom = Math.max(insets.bottom, 8) + 10
    const barH = navStyle === 'minimal' ? 50 : 60
    const side = navStyle === 'minimal' ? 80 : 18
    const innerPad = 6
    const barTop  = H - barBottom - barH
    const innerW  = W - side * 2 - innerPad * 2
    const itemW   = innerW / 4
    const cx = side + innerPad + (ROUTE_INDEX[route] + 0.5) * itemW
    const cy = barTop + barH / 2
    const sz = Math.min(itemW - 6, 58)
    return { x: cx - sz / 2, y: cy - sz / 2, w: sz, h: sz }
  }, [navStyle, insets.bottom, W, H])

  // ── Animated spotlight (glides between steps; collapses on centred steps) ──
  const hx = useSharedValue(0)
  const hy = useSharedValue(0)
  const hw = useSharedValue(0)
  const hh = useSharedValue(0)
  const ringO = useSharedValue(0)
  const pulse = useSharedValue(0)
  useEffect(() => { pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true) }, [])

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

  // Per step: navigate to its tab, reveal the bar, then glide the spotlight.
  useEffect(() => {
    go(step.route)
    setTabBarHidden(false)
    const hole = step.spotlight ? tabHole(step.route) : null
    if (hole) {
      // First appearance (currently collapsed): seed at the hole's centre so it
      // grows outward in place rather than sliding in from the corner.
      if (hw.value === 0 && hh.value === 0) {
        hx.value = hole.x + hole.w / 2
        hy.value = hole.y + hole.h / 2
      }
      hx.value = withTiming(hole.x, GLIDE)
      hy.value = withTiming(hole.y, GLIDE)
      hw.value = withTiming(hole.w, GLIDE)
      hh.value = withTiming(hole.h, GLIDE)
      ringO.value = withTiming(1, GLIDE)
    } else {
      // Collapse toward the current centre so it shrinks away in place.
      const cx = hx.value + hw.value / 2
      const cy = hy.value + hh.value / 2
      hx.value = withTiming(cx, COLLAPSE)
      hy.value = withTiming(cy, COLLAPSE)
      hw.value = withTiming(0, COLLAPSE)
      hh.value = withTiming(0, COLLAPSE)
      ringO.value = withTiming(0, COLLAPSE)
    }
  }, [i, navStyle, W, H, insets.bottom])

  const next = () => { if (last) finish(); else { haptic.light(); setI(i + 1) } }
  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width && height) setSize({ width, height })
  }

  // Scrim = four dark bands framing the hole. Animating plain Views on the UI
  // thread stays smooth even while the next tab screen mounts; an animated SVG
  // mask re-rasterized the full screen every frame and stuttered.
  const bandTop    = useAnimatedStyle(() => ({ height: Math.max(0, hy.value) }))
  const bandBottom = useAnimatedStyle(() => ({ top: hy.value + hh.value }))
  const bandLeft   = useAnimatedStyle(() => ({ top: hy.value, height: hh.value, width: Math.max(0, hx.value) }))
  const bandRight  = useAnimatedStyle(() => ({ top: hy.value, height: hh.value, left: hx.value + hw.value }))
  const ringStyle  = useAnimatedStyle(() => ({
    left: hx.value, top: hy.value, width: hw.value, height: hh.value,
    opacity:   ringO.value * (0.6 + pulse.value * 0.4),
    transform: [{ scale: 1 + pulse.value * 0.035 }],
  }))

  // Caption card sits just above the navbar, fixed across steps so only its
  // content cross-fades (no jump) while the spotlight glides beneath it.
  const cardBottom = navStyle === 'gestures'
    ? insets.bottom + Spacing.xl
    : Math.max(insets.bottom, 8) + 10 + (navStyle === 'minimal' ? 50 : 60) + Spacing.lg

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      {/* Dimming scrim — four bands framing the cut-out (UI-thread cheap) */}
      <Animated.View pointerEvents="none" style={[styles.bandTop, bandTop]} />
      <Animated.View pointerEvents="none" style={[styles.bandBottom, bandBottom]} />
      <Animated.View pointerEvents="none" style={[styles.bandLeft, bandLeft]} />
      <Animated.View pointerEvents="none" style={[styles.bandRight, bandRight]} />

      {/* Tap anywhere to advance (sits above the scrim, below the controls) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={next} />

      {/* Spotlight ring around the cut-out */}
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderColor: step.tint, shadowColor: step.tint }, ringStyle]}
      />

      {/* Caption card */}
      <View style={[styles.cardWrap, { bottom: cardBottom }]} pointerEvents="box-none">
        <Animated.View key={i} entering={FadeIn.duration(240)}>
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

  bandTop:    { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: SCRIM_RGBA },
  bandBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: SCRIM_RGBA },
  bandLeft:   { position: 'absolute', left: 0, backgroundColor: SCRIM_RGBA },
  bandRight:  { position: 'absolute', right: 0, backgroundColor: SCRIM_RGBA },

  ring: {
    position: 'absolute',
    borderRadius: HOLE_RADIUS,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 0,
  },

  cardWrap: { position: 'absolute', left: Spacing.xl, right: Spacing.xl },
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
