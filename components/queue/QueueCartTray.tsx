import React, { useEffect, useState } from 'react'
import { Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha, Floating, CHROME_FONT_MAX } from '@/constants/theme'
import { router, usePathname } from 'expo-router'
import { Spring, haptic } from '@/constants/animation'
import { cartCount, onCart, clearCart } from '@/utils/queueCart'
import { tabBarHidden } from '@/utils/tabBar'
import { confirmDialog } from '@/utils/dialog'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { Icon } from '@/components/ui/Icon'

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
        <BlurView intensity={30} tint={Floating.blur} style={StyleSheet.absoluteFill} />
        <Icon name="list" style={styles.spark} />
        <Text style={styles.count} maxFontSizeMultiplier={CHROME_FONT_MAX}>
          {count} <Text style={styles.countLabel}>queued</Text>
        </Text>
        <Pressable
          hitSlop={10}
          onPress={() => {
            haptic.light()
            confirmDialog({
              glyph: 'trash-outline', destructive: true, confirmLabel: 'Clear',
              title: 'Clear the queue?',
              message: `Remove all ${count} ${count === 1 ? 'track' : 'tracks'}?`,
              onConfirm: clearCart,
            })
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear queue cart"
          style={styles.clear}
        >
          <Icon name="close" style={styles.clearGlyph} />
        </Pressable>
        <Text style={styles.start} maxFontSizeMultiplier={CHROME_FONT_MAX}>Open <Icon name="arrow-forward" inline style={styles.start} /></Text>
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
    backgroundColor: Floating.bg, overflow: 'hidden',
    elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: Floating.shadowOpacity, shadowRadius: 18,
  },
  spark: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.greenPrimary },
  // Floating chrome tokens — matches the tab bar + now-playing pill in both themes.
  count: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Floating.text },
  countLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Floating.textMuted },
  clear: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(Floating.text, 0.08) },
  clearGlyph: { fontFamily: FontFamily.mono, fontSize: 12, color: Floating.textMuted },
  start: {
    fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.background,
    backgroundColor: Colors.greenPrimary, overflow: 'hidden',
    borderRadius: Radius.full, paddingVertical: 8, paddingHorizontal: Spacing.md,
  },
})
