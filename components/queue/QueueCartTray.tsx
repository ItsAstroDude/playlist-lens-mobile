import React, { useEffect, useState } from 'react'
import { Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { router, usePathname } from 'expo-router'
import { Spring, haptic } from '@/constants/animation'
import { cartCount, onCart, clearCart } from '@/utils/queueCart'
import { tabBarHidden } from '@/utils/tabBar'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'

// Sits just above the floating tab bar (BAR_H 60 at bottom+10). Tweakable from a
// device screenshot if it crowds the now-playing bar in some now-playing placements.
const BAR_OFFSET = 78

/**
 * The slim "queue cart" tray (v1.5 Custom Queues). Appears whenever the cart has
 * tracks; one tap jumps to the Queue tab (the real home for building + starting a
 * queue). Mounted at the root so it's reachable from any screen, hidden on the
 * Queue tab itself, and it rides the tab bar's auto-hide value so a scroll-down
 * tucks both away together.
 */
export function QueueCartTray() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const gutter = useNowPlayingGutter()   // lift above the now-playing pill when it's docked
  const [count, setCount] = useState(cartCount())
  const appear = useSharedValue(count > 0 ? 1 : 0)

  useEffect(() => {
    setCount(cartCount())
    return onCart(items => setCount(items.length))
  }, [])

  useEffect(() => {
    appear.value = withSpring(count > 0 ? 1 : 0, Spring.entrance)
  }, [count])

  const aStyle = useAnimatedStyle(() => ({
    opacity:   appear.value * (1 - tabBarHidden.value * 0.4),
    transform: [{ translateY: (1 - appear.value) * 28 + tabBarHidden.value * 80 }],
  }))

  // Hidden when empty or when we're already on the Queue tab (it's redundant there).
  if (count === 0 || pathname === '/queue') return null

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) + BAR_OFFSET + gutter }, aStyle]}
    >
      <Pressable
        style={styles.pill}
        onPress={() => { haptic.medium(); router.navigate('/queue') }}
        accessibilityRole="button"
        accessibilityLabel={`Open your queue of ${count} tracks`}
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Text style={styles.spark}>✦</Text>
        <Text style={styles.count}>
          {count} <Text style={styles.countLabel}>queued</Text>
        </Text>
        <Pressable
          hitSlop={10}
          onPress={() => { haptic.light(); clearCart() }}
          accessibilityRole="button"
          accessibilityLabel="Clear queue cart"
          style={styles.clear}
        >
          <Text style={styles.clearGlyph}>✕</Text>
        </Pressable>
        <Text style={styles.start}>Open →</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 40 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10, paddingLeft: Spacing.lg, paddingRight: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.4),
    backgroundColor: 'rgba(18,18,22,0.82)', overflow: 'hidden',
    elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 18,
  },
  spark: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.greenPrimary },
  count: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text },
  countLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  clear: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(Colors.text, 0.08) },
  clearGlyph: { fontFamily: FontFamily.mono, fontSize: 11, color: Colors.textMuted, marginTop: -1 },
  start: {
    fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.background,
    backgroundColor: Colors.greenPrimary, overflow: 'hidden',
    borderRadius: Radius.full, paddingVertical: 8, paddingHorizontal: Spacing.md,
  },
})
