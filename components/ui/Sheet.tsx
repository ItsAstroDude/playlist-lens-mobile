import React, { useCallback, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, BackHandler, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing, runOnJS } from 'react-native-reanimated'
import { Colors, Spacing, Radius, Type } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useContentHeight } from '@/hooks/useFlex'

const CLOSE_DISTANCE = 110
const CLOSE_VELOCITY = 900

/**
 * Design system — the one bottom sheet. Slides up over a dimmed backdrop; closes on
 * backdrop tap, Android back, or a downward swipe on the handle/title area.
 *
 *   <Sheet open={!!x} onClose={…} title="…" subtitle="…">…</Sheet>
 *
 * Mount it at screen level (it positions itself absolutely). `bottomInset` adds room
 * for floating chrome (the tab bar) under the content. `zIndex` keeps stacked sheets
 * in order — a sheet opened from another sheet passes a higher one.
 *
 * `bleed` makes it a full-height, edge-to-edge sheet (no side/bottom padding, content
 * clipped to the rounded corners) for content with its own hero and insets — the
 * playlist detail sheet. Only the handle area drags, so lists inside keep their own
 * scroll and drag gestures.
 */
export function Sheet({
  open, onClose, title, subtitle, children, header, bottomInset = 0, zIndex = 25, maxHeight = 0.88, bleed = false, style,
}: {
  open:         boolean
  onClose:      () => void
  title?:       string
  subtitle?:    string
  /** Custom header content (replaces title/subtitle), still inside the swipe area. */
  header?:      React.ReactNode
  children:     React.ReactNode
  bottomInset?: number
  zIndex?:      number
  /** Fraction of screen height the sheet may take. */
  maxHeight?:   number
  /** Full-height, edge-to-edge: the content handles its own padding and insets. */
  bleed?:       boolean
  style?:       StyleProp<ViewStyle>
}) {
  const insets = useSafeAreaInsets()
  // The height the screens really have: the live window (the Flip's cover screen is about
  // half the main one's), or the standing half while folded with the Flex panel.
  const SH = useContentHeight()
  const y = useSharedValue(SH)
  const backdrop = useSharedValue(0)

  useEffect(() => {
    if (open) {
      y.value = withSpring(0, Spring.sheet)
      backdrop.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
    } else {
      y.value = withSpring(SH, Spring.sheet)
      backdrop.value = withTiming(0, { duration: 160 })
    }
  }, [open])

  const dismiss = useCallback(() => { haptic.light(); onClose() }, [onClose])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true })
    return () => sub.remove()
  }, [open, dismiss])

  // Swipe down on the handle/header to close; a short drag springs back.
  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate(e => { y.value = Math.max(0, e.translationY) })
    .onEnd(e => {
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) runOnJS(dismiss)()
      else y.value = withSpring(0, Spring.sheet)
    })

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))

  return (
    <>
      <Animated.View style={[styles.backdrop, { zIndex }, backdropStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { zIndex: zIndex + 1, maxHeight: SH * maxHeight },
          bleed ? [styles.bleed, { height: SH * maxHeight }] : { paddingBottom: insets.bottom + Spacing.lg + bottomInset },
          sheetStyle, style,
        ]}
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityViewIsModal={open}
        importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.grab}>
            <View style={styles.handle} />
            {header ?? (title ? (
              <View style={styles.head}>
                <Text style={Type.heading} numberOfLines={1} accessibilityRole="header">{title}</Text>
                {subtitle ? <Text style={[Type.caption, styles.sub]} numberOfLines={2}>{subtitle}</Text> : null}
              </View>
            ) : null)}
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.sheet,
    borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    borderTopWidth: 1, borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.lg,
  },
  bleed:  { paddingHorizontal: 0, overflow: 'hidden', borderLeftWidth: 1, borderRightWidth: 1 },
  grab:   { paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, marginBottom: Spacing.md },
  head:   { gap: 2 },
  sub:    { marginTop: 2 },
})
