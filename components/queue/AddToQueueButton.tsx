import React, { useEffect, useState } from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Colors, FontFamily, Radius, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { inCart, toggleCart, onCart, type QueueItem } from '@/utils/queueCart'

/**
 * The ＋ that lives on every track surface (v1.5 Custom Queues). Toggles the track
 * in/out of the queue cart and reflects membership (＋ → ✓) live across surfaces,
 * since the cart is a shared pub/sub source.
 */
export function AddToQueueButton({ item, size = 28 }: { item: QueueItem; size?: number }) {
  const [added, setAdded] = useState(() => inCart(item.uri))
  const scale = useSharedValue(1)

  useEffect(() => {
    setAdded(inCart(item.uri))
    return onCart(() => setAdded(inCart(item.uri)))
  }, [item.uri])

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const onPress = () => {
    const nowAdded = toggleCart(item)
    setAdded(nowAdded)
    nowAdded ? haptic.medium() : haptic.light()
    scale.value = 0.78
    scale.value = withSpring(1, Spring.snappy)
  }

  return (
    <Animated.View style={aStyle}>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={added ? 'Remove from queue' : 'Add to queue'}
        style={[
          styles.btn,
          { width: size, height: size, borderRadius: size / 2 },
          added ? styles.btnOn : styles.btnOff,
        ]}
      >
        <Text style={[styles.glyph, { color: added ? Colors.background : Colors.greenPrimary }]}>
          {added ? '✓' : '+'}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnOff: { backgroundColor: alpha(Colors.greenPrimary, 0.1), borderColor: alpha(Colors.greenPrimary, 0.35) },
  btnOn:  { backgroundColor: Colors.greenPrimary, borderColor: Colors.greenPrimary },
  glyph:  { fontFamily: FontFamily.syneBold, fontSize: 15, lineHeight: 18, marginTop: -1 },
})
