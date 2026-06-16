/**
 * The "queue cart" (v1.5 "Custom Queues").
 *
 * A persistent tray the user fills from anywhere in the app — a ＋ on every track
 * surface (playlists, Wrapped top tracks, swipe KEEPs, smart suggestions) drops
 * the track in; one "Start queue" button fires it onto their Spotify. Backed by
 * MMKV so a half-built queue survives a relaunch; deduped by URI; capped.
 *
 * Module-level pub/sub (same shape as utils/scopeStatus) so the ＋ buttons, the
 * floating tray, and the start sheet all react to the same source of truth.
 */
import { storage } from '@/utils/cache'

export interface QueueItem {
  uri:    string          // spotify:track:… — the only thing playback actually needs
  name:   string
  artist: string
  image?: string          // optional cover for the tray/list
}

const KEY = 'queue_cart'
export const CART_MAX = 200   // matches playback MAX_QUEUE (play 100 + append 100)

type Listener = (items: QueueItem[]) => void
const listeners = new Set<Listener>()

let _cart: QueueItem[] | null = null   // in-memory mirror so reads don't hit MMKV each render

function read(): QueueItem[] {
  if (_cart) return _cart
  const raw = storage.getString(KEY)
  if (!raw) { _cart = []; return _cart }
  try {
    const parsed = JSON.parse(raw)
    _cart = Array.isArray(parsed) ? parsed.filter(isItem) : []
  } catch {
    _cart = []
  }
  return _cart
}

function isItem(x: any): x is QueueItem {
  return x && typeof x.uri === 'string' && x.uri.startsWith('spotify:track:')
}

function write(items: QueueItem[]): void {
  _cart = items
  storage.set(KEY, JSON.stringify(items))
  listeners.forEach(cb => cb(items))
}

// ─── Reads ────────────────────────────────────────────────────────────────────
export function getCart(): QueueItem[] { return read() }
export function cartCount(): number { return read().length }
export function inCart(uri: string): boolean { return read().some(i => i.uri === uri) }

// ─── Writes (all no-op gracefully on bad input) ───────────────────────────────

/** Add one track. Ignores non-track URIs, duplicates, and adds past the cap. */
export function addToCart(item: QueueItem): boolean {
  if (!isItem(item)) return false
  const cart = read()
  if (cart.some(i => i.uri === item.uri)) return false
  if (cart.length >= CART_MAX) return false
  write([...cart, item])
  return true
}

/** Add many at once (e.g. "Add all" from a playlist), preserving order, deduped, capped. */
export function addManyToCart(items: QueueItem[]): number {
  const cart = read()
  const seen = new Set(cart.map(i => i.uri))
  const next = cart.slice()
  let added = 0
  for (const it of items) {
    if (!isItem(it) || seen.has(it.uri) || next.length >= CART_MAX) continue
    seen.add(it.uri)
    next.push(it)
    added++
  }
  if (added) write(next)
  return added
}

export function removeFromCart(uri: string): void {
  const cart = read()
  const next = cart.filter(i => i.uri !== uri)
  if (next.length !== cart.length) write(next)
}

/** Add if absent, remove if present — drives the ＋/✓ toggle on track rows. */
export function toggleCart(item: QueueItem): boolean {
  if (inCart(item.uri)) { removeFromCart(item.uri); return false }
  return addToCart(item)
}

/** Reorder to match a list of URIs (from the draggable list); unknown URIs dropped. */
export function reorderCart(orderedUris: string[]): void {
  const cart = read()
  const byUri = new Map(cart.map(i => [i.uri, i]))
  const next: QueueItem[] = []
  for (const uri of orderedUris) {
    const it = byUri.get(uri)
    if (it) { next.push(it); byUri.delete(uri) }
  }
  for (const leftover of byUri.values()) next.push(leftover)   // safety: keep any unlisted
  write(next)
}

export function clearCart(): void {
  if (read().length) write([])
}

// ─── Subscribe ────────────────────────────────────────────────────────────────
export function onCart(cb: Listener): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** Test hook — drop the in-memory mirror so the next read re-hydrates from storage. */
export function _resetCartMirror(): void { _cart = null }
