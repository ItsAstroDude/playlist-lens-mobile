import React, { useCallback, useMemo, useRef } from 'react'
import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { Colors } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { getNavbarStyle } from '@/utils/settings'
import { NowPlayingBar } from '@/components/nowplaying/NowPlayingBar'
import { LiquidTabBar } from '@/components/motion/LiquidTabBar'
import { LiquidBackground } from '@/components/motion/LiquidBackground'

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
          : <LiquidTabBar {...props} minimal={navStyle === 'minimal'} />}
      screenOptions={{
        headerShown: false,
        // One shared aurora (below) behind every tab — scenes are see-through.
        sceneStyle:  { backgroundColor: 'transparent' },
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
      <LiquidBackground />
      {tabs}
      <NowPlayingBar navStyle={navStyle} />
    </View>
  )

  // Gestures mode wraps the whole navigator so a swipe anywhere switches tabs.
  return navStyle === 'gestures'
    ? <GestureDetector gesture={swipe}>{content}</GestureDetector>
    : content
}

// ─── Layout + gestures-only dots ────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1 },
  gestureZone: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, alignItems: 'center' },
  dotsRow:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  dotActive:   { width: 18, backgroundColor: Colors.greenPrimary },
})
