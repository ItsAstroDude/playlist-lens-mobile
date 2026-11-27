import React, { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Canvas, Group, Paint, Blur, ColorMatrix, RoundedRect } from '@shopify/react-native-skia'
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue, withSpring, withDelay, withTiming, withSequence,
} from 'react-native-reanimated'
import { Colors, Floating } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { tabBarHidden, hideTabBar } from '@/utils/tabBar'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useMotionReduced } from './reduced'

// Same footprint as the 1.x bar (60 tall, 50 minimal; 18 / 80 side gutters), which the
// tour spotlight and the now-playing bar are positioned against.
const BAR_H = 60
const BAR_H_MIN = 50
const PAD = 6
// Alpha threshold after the blur: the two pills melt into one blob where they overlap.
const GOO = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 22, -9]

export const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index:   ['aperture', 'aperture-outline'],
  queue:   ['list',     'list-outline'],
  play:    ['game-controller', 'game-controller-outline'],
  swipe:   ['layers',   'layers-outline'],
}

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] }
  descriptors: Record<string, { options: { title?: string } }>
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean }
    navigate: (name: string) => void
  }
  minimal?: boolean
}

/**
 * Motion #4 — the Liquid tab bar. A frosted pill whose active highlight is a metaball:
 * a lead blob springs to the tapped tab and a trailing blob follows a beat later, so
 * the highlight stretches, pulls apart and re-merges like a drop of liquid.
 */
export function LiquidTabBar({ state, descriptors, navigation, minimal }: TabBarProps) {
  const insets = useSafeAreaInsets()
  const reduced = useMotionReduced()
  const [w, setW] = useState(0)
  const n = state.routes.length
  const itemW = w > 0 ? (w - PAD * 2) / n : 0
  const pillW = Math.min(itemW - 8, 76)
  const h = minimal ? BAR_H_MIN : BAR_H
  const pillH = h - PAD * 2
  const target = (i: number) => PAD + itemW * i + (itemW - pillW) / 2

  const lead = useSharedValue(0)
  const trail = useSharedValue(0)
  const placed = useRef(false)
  useEffect(() => {
    if (!w) return
    const t = target(state.index)
    if (!placed.current || reduced) { lead.value = t; trail.value = t; placed.current = true; return }
    lead.value = withSpring(t, { mass: 0.7, damping: 13, stiffness: 240 })
    trail.value = withDelay(50, withSpring(t, { mass: 1, damping: 16, stiffness: 110 }))
  }, [state.index, w, reduced])

  // Any tab switch ends the scroll auto-hide (other reasons, like an open sheet, stay).
  useEffect(() => { hideTabBar('scroll', false) }, [state.index])
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarHidden.value * (BAR_H + insets.bottom + 40) }],
    opacity: 1 - tabBarHidden.value * 0.25,
  }))

  const trailX = useDerivedValue(() => trail.value + pillW * 0.14)
  const pillColor = Colors.text

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, minimal && styles.wrapMinimal, { bottom: Math.max(insets.bottom, 8) + 10 }, barStyle]}
    >
      <View style={[styles.bar, { height: h, borderRadius: h / 2 }]} onLayout={e => setW(e.nativeEvent.layout.width)}>
        <BlurView intensity={30} tint={Floating.blur} style={StyleSheet.absoluteFill} />
        {w > 0 && (
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Group layer={<Paint><Blur blur={7} /><ColorMatrix matrix={GOO} /></Paint>}>
              <RoundedRect x={lead} y={PAD} width={pillW} height={pillH} r={pillH / 2} color={pillColor} />
              {!reduced && <RoundedRect x={trailX} y={PAD + pillH * 0.12} width={pillW * 0.72} height={pillH * 0.76} r={pillH * 0.38} color={pillColor} />}
            </Group>
          </Canvas>
        )}
        <View style={styles.row} accessibilityRole="tabbar">
          {state.routes.map((route, i) => {
            const focused = state.index === i
            const label = (descriptors[route.key]?.options.title ?? route.name) as string
            const onPress = () => {
              haptic.light()
              const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !ev.defaultPrevented) navigation.navigate(route.name)
            }
            return <TabIcon key={route.key} name={route.name} label={label} focused={focused} onPress={onPress} />
          })}
        </View>
      </View>
    </Animated.View>
  )
}

function TabIcon({ name, label, focused, onPress }: { name: string; label: string; focused: boolean; onPress: () => void }) {
  const reduced = useMotionReduced()
  const s = useSharedValue(1)
  useEffect(() => {
    if (focused && !reduced) s.value = withSequence(withTiming(0.78, { duration: 90 }), withSpring(1.14, { mass: 0.5, damping: 7, stiffness: 260 }), withSpring(1))
  }, [focused])
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))
  const pair = TAB_ICONS[name] ?? ['ellipse', 'ellipse-outline']
  return (
    <Pressable style={styles.item} onPress={onPress} hitSlop={6}
      accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }}>
      <Animated.View style={a}>
        <Icon name={focused ? pair[0] : pair[1]} size={23} color={focused ? Colors.background : Floating.inactive} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap:        { position: 'absolute', left: 18, right: 18 },
  wrapMinimal: { left: 80, right: 80 },
  bar: {
    overflow: 'hidden',
    backgroundColor: Floating.bg, borderWidth: 1, borderColor: Colors.glassBorder,
    shadowColor: '#000', shadowOpacity: Floating.shadowOpacity, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 14,
  },
  row:  { ...StyleSheet.absoluteFillObject, flexDirection: 'row', paddingHorizontal: PAD },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
