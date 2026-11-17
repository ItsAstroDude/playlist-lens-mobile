import React, { useEffect, useState } from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Colors, FontFamily, Radius, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { inCart, toggleCart, onCart, cartFull, CART_MAX, type QueueItem } from '@/utils/queueCart'
import { showToast } from '@/utils/dialog'
import { Icon } from '@/components/ui/Icon'

/**
 * The ＋ that lives on every track surface (v1.5 Custom Queues). Toggles the track
 * in/out of the queue cart and reflects membership (＋ → ✓) live across surfaces,
 * since the cart is a shared pub/sub source.
 */
export function AddToQueueButton({ item, size = 28, onFeedback = showToast }: {
  item: QueueItem
  size?: number
  /** Where a "queue is full" notice goes. Defaults to the root toast; surfaces
   *  inside a native <Modal> (which covers the toast) pass their own. */
  onFeedback?: (msg: string) => void
}) {
  const [added, setAdded] = useState(() => inCart(item.uri))
  const scale = useSharedValue(1)

  useEffect(() => {
    setAdded(inCart(item.uri))
    return onCart(() => setAdded(inCart(item.uri)))
  }, [item.uri])

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const onPress = () => {
    if (!added && cartFull()) {
      haptic.warning()
      onFeedback(`Your queue is full (${CART_MAX} max)`)
      return
    }
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
        <Icon
          name={added ? 'checkmark' : 'add'}
          size={Math.round(size * 0.58)}
          color={added ? Colors.background : Colors.greenPrimary}
        />
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
