import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Colors, FontFamily, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { SaveBurst } from '@/components/motion/SaveBurst'
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

  useEffect(() => {
    setAdded(inCart(item.uri))
    return onCart(() => setAdded(inCart(item.uri)))
  }, [item.uri])

  const onPress = () => {
    if (!added && cartFull()) {
      haptic.warning()
      onFeedback(`Your queue is full (${CART_MAX} max)`)
      return
    }
    const nowAdded = toggleCart(item)
    setAdded(nowAdded)
    if (!nowAdded) haptic.light()   // adding: SaveBurst gives the success buzz
  }

  // 2.0: adding bursts (spring pop, ring, confetti) — motion #2.
  return (
    <SaveBurst
      active={added} onPress={onPress} size={size} distance={size * 1.3}
      colors={[Colors.greenPrimary, Colors.lavender, Colors.pink, Colors.warning]}
      label={added ? 'Remove from queue' : 'Add to queue'}
    >
      <View style={[styles.btn, { width: size, height: size, borderRadius: size / 2 }, added ? styles.btnOn : styles.btnOff]}>
        <Icon name={added ? 'checkmark' : 'add'} size={Math.round(size * 0.58)} color={added ? Colors.background : Colors.greenPrimary} />
      </View>
    </SaveBurst>
  )
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnOff: { backgroundColor: alpha(Colors.greenPrimary, 0.1), borderColor: alpha(Colors.greenPrimary, 0.35) },
  btnOn:  { backgroundColor: Colors.greenPrimary, borderColor: Colors.greenPrimary },
  glyph:  { fontFamily: FontFamily.syneBold, fontSize: 15, lineHeight: 18, marginTop: -1 },
})
