import {
  addAllMessage, cartFull,
  getCart, cartCount, inCart, addToCart, addManyToCart, removeFromCart,
  toggleCart, reorderCart, clearCart, onCart, _resetCartMirror, CART_MAX,
  type QueueItem,
} from '@/utils/queueCart'
import { storage } from '@/utils/cache'

const item = (n: string): QueueItem => ({
  uri: `spotify:track:${n}`, name: `Song ${n}`, artist: 'Artist',
})

beforeEach(() => {
  storage.clearAll()
  _resetCartMirror()
})

describe('queueCart writes', () => {
  it('adds, dedupes by uri, and rejects non-track uris', () => {
    expect(addToCart(item('a'))).toBe(true)
    expect(addToCart(item('a'))).toBe(false)             // duplicate
    expect(addToCart({ uri: 'spotify:album:x', name: 'n', artist: 'a' })).toBe(false) // not a track
    expect(cartCount()).toBe(1)
  })

  it('toggle adds when absent, removes when present', () => {
    expect(toggleCart(item('a'))).toBe(true)
    expect(inCart('spotify:track:a')).toBe(true)
    expect(toggleCart(item('a'))).toBe(false)
    expect(inCart('spotify:track:a')).toBe(false)
  })

  it('addMany preserves order, dedupes, and respects the cap', () => {
    addToCart(item('a'))
    const added = addManyToCart([item('a'), item('b'), item('c')])  // 'a' already in
    expect(added).toBe(2)
    expect(getCart().map(i => i.uri)).toEqual([
      'spotify:track:a', 'spotify:track:b', 'spotify:track:c',
    ])
  })

  it('caps the cart at CART_MAX', () => {
    const many = Array.from({ length: CART_MAX + 25 }, (_, i) => item(String(i)))
    expect(addManyToCart(many)).toBe(CART_MAX)
    expect(cartCount()).toBe(CART_MAX)
    expect(addToCart(item('overflow'))).toBe(false)
  })

  it('removes and clears', () => {
    addManyToCart([item('a'), item('b')])
    removeFromCart('spotify:track:a')
    expect(getCart().map(i => i.uri)).toEqual(['spotify:track:b'])
    clearCart()
    expect(cartCount()).toBe(0)
  })

  it('reorder follows the given uri order, keeping unlisted items at the end', () => {
    addManyToCart([item('a'), item('b'), item('c')])
    reorderCart(['spotify:track:c', 'spotify:track:a'])   // 'b' omitted
    expect(getCart().map(i => i.uri)).toEqual([
      'spotify:track:c', 'spotify:track:a', 'spotify:track:b',
    ])
  })
})

describe('queueCart persistence + pub/sub', () => {
  it('survives a fresh read from storage (mirror reset)', () => {
    addToCart(item('a'))
    _resetCartMirror()                 // simulate a relaunch — re-hydrate from MMKV
    expect(cartCount()).toBe(1)
    expect(inCart('spotify:track:a')).toBe(true)
  })

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const seen: number[] = []
    const off = onCart(items => seen.push(items.length))
    addToCart(item('a'))
    addToCart(item('b'))
    off()
    addToCart(item('c'))
    expect(seen).toEqual([1, 2])       // not 3 — unsubscribed before the last add
  })
})

describe('add-all feedback', () => {
  it('reports a clean add', () => {
    expect(addAllMessage(1, 1, false)).toBe('Added 1 track to your queue')
    expect(addAllMessage(12, 12, false)).toBe('Added 12 tracks to your queue')
  })
  it('explains partial adds — dupes vs the cap', () => {
    expect(addAllMessage(3, 5, false)).toBe('Added 3 tracks · 2 already queued')
    expect(addAllMessage(3, 5, true)).toBe(`Added 3 tracks — your queue is full (${CART_MAX} max)`)
  })
  it('explains a no-op', () => {
    expect(addAllMessage(0, 4, false)).toBe('Already in your queue')
    expect(addAllMessage(0, 4, true)).toBe(`Your queue is full (${CART_MAX} max)`)
    expect(addAllMessage(0, 0, false)).toBe('Nothing to add')
  })
  it('cartFull flips at CART_MAX', () => {
    expect(cartFull()).toBe(false)
    addManyToCart(Array.from({ length: CART_MAX }, (_, i) => item(String(i))))
    expect(cartFull()).toBe(true)
  })
})
