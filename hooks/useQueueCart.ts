import { useCallback, useEffect, useState } from 'react'
import {
  getCart, onCart, addToCart, addManyToCart, removeFromCart, toggleCart,
  reorderCart, clearCart, inCart, type QueueItem,
} from '@/utils/queueCart'

// ─── Queue-cart binding (v1.5 "Custom Queues") ───────────────────────────────
// One source of truth (utils/queueCart) drives every subscriber: the ＋ buttons
// on track rows, the floating tray, and the start sheet all read this hook so
// adding from one surface instantly updates the others.
export function useQueueCart() {
  const [items, setItems] = useState<QueueItem[]>(getCart())

  useEffect(() => {
    setItems(getCart())          // re-sync in case the cart changed before mount
    return onCart(setItems)
  }, [])

  return {
    items,
    count: items.length,
    add:     useCallback((i: QueueItem) => addToCart(i), []),
    addMany: useCallback((i: QueueItem[]) => addManyToCart(i), []),
    remove:  useCallback((uri: string) => removeFromCart(uri), []),
    toggle:  useCallback((i: QueueItem) => toggleCart(i), []),
    reorder: useCallback((uris: string[]) => reorderCart(uris), []),
    clear:   useCallback(() => clearCart(), []),
    has:     useCallback((uri: string) => inCart(uri), [items]),
  }
}
