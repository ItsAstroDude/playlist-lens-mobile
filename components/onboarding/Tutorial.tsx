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
  ACCENTS, Colors, FontSize, Spacing, Radius, Type, OnDark,
  activeAccentId, alpha,
} from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { setTabBarHidden } from '@/utils/tabBar'
import { getNavbarStyle, reduceMotionEnabled } from '@/utils/settings'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'

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

type TabRoute = 'index' | 'queue' | 'play' | 'swipe'
const ROUTE_INDEX: Record<TabRoute, number> = { index: 0, queue: 1, play: 2, swipe: 3 }

interface Step {
  route:    TabRoute
  spotlight: boolean        // false = centred card, no cut-out (welcome / closing)
  glyph:    IconName
  tint:     string
  title:    string
  body:     string
}

// Tab routes are navigated imperatively from this root overlay so the live app
// behind the scrim shows the screen each step is describing.
const ROUTE_HREF: Record<TabRoute, string> = {
  index:   '/(tabs)',
  queue:   '/queue',
  play: '/play',
  swipe:   '/swipe',
}

// Wrapped always has something to show now (Spotify's recent plays, tracked plays
// or an import), so every tab gets its step.
function buildSteps(): Step[] {
  return [
    {
      route: 'index', spotlight: false, glyph: 'sparkles', tint: RAW_ACCENT,
      title: 'Welcome to playlist.lens',
      body:  'Your library, seen in a new light. Here’s a quick guided tour — tap anywhere or Next to move along.',
    },
    {
      route: 'index', spotlight: true, glyph: 'aperture', tint: RAW_ACCENT,
      title: 'Lenses',
      body:  'Every playlist in your library, analysed. Tap a lens for its sound, genres and era — long-press one to pin, share, re-analyze or compare it.',
    },
    {
      route: 'queue', spotlight: true, glyph: 'list', tint: Colors.pink,
      title: 'Queue',
      body:  'Build a queue from anywhere and play it on your Spotify — hand-pick tracks, or let the rediscovery shelves bring back old favorites.',
    },
    {
      route: 'play', spotlight: true, glyph: 'game-controller', tint: Colors.lavender,
      title: 'Play',
      body:  'More or less: did you play this song more or less than that one? A game on your own listening. Wrapped is being rebuilt meanwhile; find it in Settings › About › Labs.',
    },
    {
      route: 'swipe', spotlight: true, glyph: 'layers', tint: RAW_ACCENT,
      title: 'Swipe',
      body:  'Tidy a playlist by swiping: keep or cut, with 30-second previews. Nothing changes until you confirm — save the keepers as a new playlist, or trim the original with a backup.',
    },
    {
      route: 'index', spotlight: false, glyph: 'refresh-circle', tint: RAW_ACCENT,
      title: 'You’re all set',
      body:  'When Spotify’s playing, a live bar shows your track — tap it for your stats on it. Updates arrive on their own; grab them anytime from Settings › Check for updates.',
    },
  ]
}

export function Tutorial({ onDone }: { onDone: () => void }) {
  const steps   = useMemo(buildSteps, [])
  // Reduce motion: the spotlight jumps instead of gliding, and the ring doesn't pulse.
  const still   = useMemo(reduceMotionEnabled, [])
  const glide    = still ? { duration: 0 } : GLIDE
  const collapse = still ? { duration: 0 } : COLLAPSE
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
  useEffect(() => { if (!still) pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true) }, [])

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
      hx.value = withTiming(hole.x, glide)
      hy.value = withTiming(hole.y, glide)
      hw.value = withTiming(hole.w, glide)
      hh.value = withTiming(hole.h, glide)
      ringO.value = withTiming(1, glide)
    } else {
      // Collapse toward the current centre so it shrinks away in place.
      const cx = hx.value + hw.value / 2
      const cy = hy.value + hh.value / 2
      hx.value = withTiming(cx, collapse)
      hy.value = withTiming(cy, collapse)
      hw.value = withTiming(0, collapse)
      hh.value = withTiming(0, collapse)
      ringO.value = withTiming(0, collapse)
    }
  }, [i, navStyle, W, H, insets.bottom])

  // `quiet` = the Button already gave its own press haptic.
  const next = (quiet = false) => { if (last) finish(); else { if (!quiet) haptic.light(); setI(i + 1) } }
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
      <Pressable style={StyleSheet.absoluteFill} onPress={() => next()} importantForAccessibility="no" accessible={false} />

      {/* Spotlight ring around the cut-out */}
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderColor: step.tint, shadowColor: step.tint }, ringStyle]}
      />

      {/* Caption card */}
      <View style={[styles.cardWrap, { bottom: cardBottom }]} pointerEvents="box-none">
        <Animated.View key={i} entering={still ? undefined : FadeIn.duration(240)}>
          <Pressable style={styles.card} onPress={() => next()} accessible={false}>
            <View style={[styles.glyphChip, { borderColor: alpha(step.tint, 0.5), backgroundColor: alpha(step.tint, 0.12) }]}>
              <Icon name={step.glyph} style={[styles.glyph, { color: step.tint }]} />
            </View>
            <Text style={[Type.overline, styles.stepNo]}>{i + 1} of {steps.length}</Text>
            <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>

            <View style={styles.cardFooter}>
              <View style={styles.dots} importantForAccessibility="no-hide-descendants">
                {steps.map((_, idx) => (
                  <View key={idx} style={[styles.dot, idx === i && [styles.dotActive, { backgroundColor: step.tint }]]} />
                ))}
              </View>
              <Button
                label={last ? 'Start exploring' : 'Next'}
                onPress={() => next(true)}
                style={{ backgroundColor: step.tint }}
                textStyle={styles.btnText}
                hitSlop={8}
                accessibilityRole="button"
              />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Skip — always available */}
      <SafeAreaView style={styles.skipWrap} edges={['top']} pointerEvents="box-none">
        <Pressable hitSlop={12} onPress={() => { haptic.light(); finish() }} accessibilityRole="button" accessibilityLabel="Skip the tour">
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
  // The scrim is always dark → Type styles with OnDark colours, never the theme's.
  stepNo: { color: OnDark.textMuted, marginBottom: Spacing.xs },
  title:  { ...Type.stat, color: OnDark.text },
  body:   { ...Type.body, fontSize: FontSize.sm, color: BODY_TXT, lineHeight: FontSize.sm * 1.6, marginTop: Spacing.sm },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.xl,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotActive: { width: 20 },

  btnText: { fontSize: FontSize.md, color: '#0b0b0d' },

  skipWrap: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
  },
  skip: { ...Type.body, fontSize: FontSize.sm, color: 'rgba(231,228,236,0.6)' },
})
