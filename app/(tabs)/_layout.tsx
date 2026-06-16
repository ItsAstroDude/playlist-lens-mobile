import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { Tabs } from 'expo-router'
import { BlurView } from 'expo-blur'
import { Pressable, StyleSheet, View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, runOnJS,
} from 'react-native-reanimated'
import { Colors, FontFamily, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { tabBarHidden } from '@/utils/tabBar'
import { getNavbarStyle } from '@/utils/settings'
import { NowPlayingBar } from '@/components/nowplaying/NowPlayingBar'

const BAR_H    = 60
const ACTIVE   = Colors.greenPrimary
const INACTIVE = 'rgba(255,255,255,0.65)'   // readable, still clearly "inactive"
const STROKE   = 2                           // one weight across every icon

// ─── Unified icon set — all 2px-stroke line glyphs in a 20px box ───────────────
function Glyph({ name, color }: { name: string; color: string }) {
  switch (name) {
    case 'index': // lenses — concentric rounded squares (an aperture / lens frame)
      return (
        <View style={g.box}>
          <View style={[g.lensOuter, { borderColor: color }]}>
            <View style={[g.lensInner, { borderColor: color }]} />
          </View>
        </View>
      )
    case 'queue': // a play-queue — stacked lines with a little play triangle
      return (
        <View style={[g.box, g.qStack]}>
          <View style={[g.qLine, { width: 16, backgroundColor: color }]} />
          <View style={[g.qLine, { width: 16, backgroundColor: color }]} />
          <View style={g.qBottom}>
            <View style={[g.qLine, { width: 9, backgroundColor: color }]} />
            <View style={[g.qTri, { borderLeftColor: color }]} />
          </View>
        </View>
      )
    case 'wrapped': // vinyl ring + center dot
      return (
        <View style={g.box}>
          <View style={[g.ring, { borderColor: color }]}>
            <View style={[g.ringDot, { backgroundColor: color }]} />
          </View>
        </View>
      )
    case 'swipe': // two stacked cards
      return (
        <View style={g.box}>
          <View style={[g.cardBehind, { borderColor: color }]} />
          <View style={[g.cardFront,  { borderColor: color }]} />
        </View>
      )
    default:
      return <View style={g.box} />
  }
}

// ─── One tab item — bouncy pop + hop + grounded active pill ─────────────────────
const BOUNCE = { mass: 0.5, damping: 8,  stiffness: 230 }
const SOFT   = { mass: 0.6, damping: 13, stiffness: 220 }

function TabItem({ label, routeName, focused, onPress, minimal }: {
  label: string; routeName: string; focused: boolean; onPress: () => void; minimal?: boolean
}) {
  const scale = useSharedValue(1)
  const hop   = useSharedValue(0)
  const pill  = useSharedValue(focused ? 1 : 0)

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(withTiming(0.86, { duration: 90 }), withSpring(1.12, BOUNCE))
      hop.value   = withSequence(withSpring(-3, BOUNCE), withSpring(0, BOUNCE))
    } else {
      scale.value = withSpring(1, SOFT)
      hop.value   = withTiming(0, { duration: 120 })
    }
    pill.value = withTiming(focused ? 1 : 0, { duration: 200 })
  }, [focused])

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { translateY: hop.value }] }))
  const pillStyle = useAnimatedStyle(() => ({ opacity: pill.value, transform: [{ scale: 0.82 + pill.value * 0.18 }] }))

  const color = focused ? ACTIVE : INACTIVE

  return (
    <Pressable style={styles.item} onPress={onPress} hitSlop={6}>
      <View style={styles.iconSlot}>
        <Animated.View style={[styles.activePill, pillStyle]} />
        <Animated.View style={iconStyle}><Glyph name={routeName} color={color} /></Animated.View>
      </View>
      {!minimal && <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>}
    </Pressable>
  )
}

// Minimal structural type for the navigator props we actually use (avoids a
// dependency on @react-navigation/bottom-tabs' types, which don't resolve here).
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] }
  descriptors: Record<string, { options: { title?: string } }>
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean }
    navigate: (name: string) => void
  }
}

// ─── The floating bar — auto-hides via the shared `tabBarHidden` value ──────────
// `minimal` = the icons-only variant: a narrower, shorter centered pill.
function FloatingTabBar({ state, descriptors, navigation, minimal }: TabBarProps & { minimal?: boolean }) {
  const insets = useSafeAreaInsets()
  // Any tab switch reveals the bar (in case it was auto-hidden by scroll).
  useEffect(() => { tabBarHidden.value = withTiming(0, { duration: 200 }) }, [state.index])

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarHidden.value * (BAR_H + insets.bottom + 40) }],
    opacity:   1 - tabBarHidden.value * 0.25,
  }))

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.barWrap,
        minimal && styles.barWrapMinimal,
        { bottom: Math.max(insets.bottom, 8) + 10 },
        barStyle,
      ]}
    >
      <View style={[styles.bar, minimal && styles.barMinimal]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.barInner}>
          {state.routes.map((route, i) => {
            const focused = state.index === i
            const { options } = descriptors[route.key]
            const label = (options.title ?? route.name) as string
            const onPress = () => {
              haptic.light()
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
            }
            return <TabItem key={route.key} label={label} routeName={route.name} focused={focused} onPress={onPress} minimal={minimal} />
          })}
        </View>
      </View>
    </Animated.View>
  )
}

// ─── Gestures-only mode — swipe ANYWHERE to switch tabs ─────────────────────────
// The swipe is a full-screen pan in TabLayout (NOT a bottom hot-zone — that clashed
// with the OS back/home gesture area on Android and iOS). This component renders
// only a non-interactive dots position indicator, and publishes the live nav state
// to the swipe via `navRef` (the detector lives outside the navigator and can't
// otherwise reach `navigation`/`state`).
type NavApi = { index: number; routes: { key: string; name: string }[]; navigate: (n: string) => void }

function GestureDots({ state, navigation, navRef }: TabBarProps & { navRef: React.MutableRefObject<NavApi | null> }) {
  const insets = useSafeAreaInsets()
  navRef.current = { index: state.index, routes: state.routes, navigate: navigation.navigate }
  return (
    <View pointerEvents="none" style={[styles.gestureZone, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.dotsRow}>
        {state.routes.map((route, i) => (
          <View key={route.key} style={[styles.dot, i === state.index && styles.dotActive]} />
        ))}
      </View>
    </View>
  )
}

export default function TabLayout() {
  // Read once per launch — changing the style in Settings applies after restart,
  // same as accent/font (see the Appearance section's restart row).
  const navStyle = getNavbarStyle()

  // Bridge: the full-screen swipe lives outside the navigator, so GestureDots
  // publishes the current tab + navigate fn here on each render.
  const navRef = useRef<NavApi | null>(null)
  const switchTab = useCallback((dir: 1 | -1) => {
    const api = navRef.current
    if (!api) return
    const next = api.index + dir
    if (next < 0 || next >= api.routes.length) return
    haptic.light()
    api.navigate(api.routes[next].name)
  }, [])
  // Horizontal-only: yields to vertical scroll (failOffsetY) and only claims a
  // clearly-horizontal swipe (activeOffsetX), so taps + list scrolling still work.
  const swipe = useMemo(() => Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-20, 20])
    .onEnd(e => {
      'worklet'
      if (Math.abs(e.translationX) < 56 || Math.abs(e.velocityX) < Math.abs(e.velocityY)) return
      runOnJS(switchTab)(e.translationX < 0 ? 1 : -1)
    }), [switchTab])

  const tabs = (
    <Tabs
      tabBar={(props: any) =>
        navStyle === 'gestures'
          ? <GestureDots {...props} navRef={navRef} />
          : <FloatingTabBar {...props} minimal={navStyle === 'minimal'} />}
      screenOptions={{
        headerShown: false,
        sceneStyle:  { backgroundColor: Colors.background },
        animation:   'fade',
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'lenses'  }} />
      <Tabs.Screen name="queue"   options={{ title: 'queue'   }} />
      <Tabs.Screen name="wrapped" options={{ title: 'wrapped' }} />
      <Tabs.Screen name="swipe"   options={{ title: 'swipe'   }} />
    </Tabs>
  )

  // The live now-playing bar floats above whichever navbar variant is active.
  const content = (
    <View style={styles.flex}>
      {tabs}
      <NowPlayingBar navStyle={navStyle} />
    </View>
  )

  // Gestures mode wraps the whole navigator so a swipe anywhere switches tabs.
  return navStyle === 'gestures'
    ? <GestureDetector gesture={swipe}>{content}</GestureDetector>
    : content
}

// ─── Bar + item layout ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1 },
  barWrap: {
    position: 'absolute', left: 18, right: 18, height: BAR_H,
  },
  bar: {
    flex: 1,
    borderRadius: BAR_H / 2,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: 'rgba(18,18,22,0.82)', // uniform semi-opaque base under the blur
    overflow: 'hidden',
    // float
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  // Equal distribution — every item gets the same flex slot.
  barInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  iconSlot: {
    width: 40, height: 26, alignItems: 'center', justifyContent: 'center',
  },
  activePill: {
    position: 'absolute',
    width: 40, height: 26, borderRadius: 13,
    backgroundColor: alpha(Colors.greenPrimary, 0.14),
  },
  label: {
    fontFamily:    FontFamily.monoMedium, // weight 500
    fontSize:      9.5,
    letterSpacing: 0.4,                    // ~0.04em
  },

  // ── Minimal variant — narrower, shorter, icons only ──
  barWrapMinimal: {
    left: 80, right: 80, height: 50,
  },
  barMinimal: {
    borderRadius: 25,
  },

  // ── Gestures-only variant — bottom hot-zone + dots ──
  gestureZone: {
    position:   'absolute',
    left:       0,
    right:      0,
    bottom:     0,
    paddingTop: 14,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dotActive: {
    width:           18,
    backgroundColor: Colors.greenPrimary,
  },
})

// ─── Icon geometry (shared box; per-icon shapes) ───────────────────────────────
const g = StyleSheet.create({
  box:    { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  rowEnd: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },

  // lenses — aperture
  lensOuter: { width: 18, height: 18, borderRadius: 5, borderWidth: STROKE, alignItems: 'center', justifyContent: 'center' },
  lensInner: { width: 7,  height: 7,  borderRadius: 2, borderWidth: STROKE },

  // compare — rounded strokes (kept; unused now that compare left the tab bar)
  stroke: { width: STROKE + 0.5, borderRadius: STROKE },

  // queue — stacked lines + play triangle
  qStack:  { gap: 3 },
  qLine:   { height: STROKE, borderRadius: STROKE },
  qBottom: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  qTri:    { width: 0, height: 0, borderTopWidth: 3, borderBottomWidth: 3, borderLeftWidth: 5, borderTopColor: 'transparent', borderBottomColor: 'transparent' },

  // wrapped — ring
  ring:    { width: 18, height: 18, borderRadius: 9, borderWidth: STROKE, alignItems: 'center', justifyContent: 'center' },
  ringDot: { width: 4, height: 4, borderRadius: 2 },

  // swipe — stacked cards
  cardBehind: { position: 'absolute', width: 13, height: 17, borderRadius: 3, borderWidth: STROKE, transform: [{ rotate: '12deg' }, { translateX: 3 }] },
  cardFront:  { width: 13, height: 17, borderRadius: 3, borderWidth: STROKE, backgroundColor: Colors.background, transform: [{ rotate: '-6deg' }] },
})
