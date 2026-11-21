import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tabs } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { Colors } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { getNavbarStyle } from '@/utils/settings'
import { NowPlayingBar } from '@/components/nowplaying/NowPlayingBar'
import { LiquidTabBar, TAB_ICONS } from '@/components/motion/LiquidTabBar'
import { Icon } from '@/components/ui/Icon'
import { useIsCover } from '@/hooks/useScreen'
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

type TabBarExtra = { navRef: React.MutableRefObject<NavApi | null>; onTab: (name: string) => void }

function GestureDots({ state, navigation, navRef, onTab }: TabBarProps & TabBarExtra) {
  const insets = useSafeAreaInsets()
  navRef.current = { index: state.index, routes: state.routes, navigate: navigation.navigate }
  useEffect(() => { onTab(state.routes[state.index]?.name ?? '') }, [state.index])
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

// ─── Flip cover screen — swipe anywhere + a small icon strip ────────────────────
// The cover screen (≈474×524 dp) has the cameras bottom-right and Samsung's "open on
// main screen" button bottom-centre, so the tab bar shrinks to a strip of icons in
// the free bottom-left corner. Swiping anywhere (away from the edges) switches tabs.
function CoverTabs({ state, navigation, navRef, onTab }: TabBarProps & TabBarExtra) {
  const insets = useSafeAreaInsets()
  navRef.current = { index: state.index, routes: state.routes, navigate: navigation.navigate }
  useEffect(() => { onTab(state.routes[state.index]?.name ?? '') }, [state.index])
  return (
    <View style={[styles.coverStrip, { bottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, i) => {
        const on = i === state.index
        const [filled, outline] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline']
        return (
          <Pressable key={route.key} hitSlop={4} accessibilityRole="tab"
            accessibilityLabel={route.name === 'index' ? 'lenses' : route.name} accessibilityState={{ selected: on }}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!on && !e.defaultPrevented) { haptic.light(); navigation.navigate(route.name) }
            }}
            style={[styles.coverItem, on && styles.coverItemOn]}>
            <Icon name={on ? filled : outline} size={18} color={on ? '#000' : Colors.text} />
          </Pressable>
        )
      })}
    </View>
  )
}

export default function TabLayout() {
  // Read once per launch — changing the style in Settings applies after restart,
  // same as accent/font (see the Appearance section's restart row).
  const navStyle = getNavbarStyle()
  const cover = useIsCover()
  // The Swipe tab's card deck swipes sideways itself, so tab-swiping pauses there.
  const [tab, setTab] = useState('index')

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
    .enabled((navStyle === 'gestures' || cover) && tab !== 'swipe')
    // On the cover screen keep clear of the system's back-gesture edges.
    .hitSlop(cover ? { left: -28, right: -28 } : {})
    .activeOffsetX([-24, 24])
    .failOffsetY([-20, 20])
    .onEnd(e => {
      'worklet'
      if (Math.abs(e.translationX) < 56 || Math.abs(e.velocityX) < Math.abs(e.velocityY)) return
      runOnJS(switchTab)(e.translationX < 0 ? 1 : -1)
    }), [switchTab, cover, tab])

  const tabs = (
    <Tabs
      tabBar={(props: any) =>
        cover
          ? <CoverTabs {...props} navRef={navRef} onTab={setTab} />
          : navStyle === 'gestures'
          ? <GestureDots {...props} navRef={navRef} onTab={setTab} />
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
      <Tabs.Screen name="play"    options={{ title: 'play'    }} />
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

  // Always wrapped (the pan is only enabled in gestures mode or on the cover screen):
  // switching the wrapper on fold/unfold would remount every tab.
  return <GestureDetector gesture={swipe}>{content}</GestureDetector>
}

// ─── Layout + gestures-only dots ────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1 },
  gestureZone: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, alignItems: 'center' },
  dotsRow:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  dotActive:   { width: 18, backgroundColor: Colors.greenPrimary },
  coverStrip:  { position: 'absolute', left: 12, flexDirection: 'row', gap: 4, padding: 4, borderRadius: 24,
                 backgroundColor: 'rgba(12,12,16,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  coverItem:   { width: 38, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  coverItemOn: { backgroundColor: '#fff' },
})
