/**
 * Custom lens ordering — persisted on-device (MMKV). The user can drag-reorder
 * or pin a lens to the top; we store the id sequence and re-apply it whenever the
 * list renders. New playlists (not in the saved order) fall to the bottom in
 * their original API order, so the feed never hides anything.
 */
import { storage } from '@/utils/cache'

const KEY = 'playlist_order'

export function loadOrder(): string[] {
  try {
    const raw = storage.getString(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveOrder(ids: string[]): void {
  storage.set(KEY, JSON.stringify(ids))
}

/** Reorder `items` to match the saved id sequence; unknown ids keep API order at the end. */
export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items
  const pos = new Map(order.map((id, i) => [id, i]))
  const known   = items.filter(i => pos.has(i.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!)
  const unknown = items.filter(i => !pos.has(i.id))
  return [...known, ...unknown]
}

/** Move one id to the front, preserving the rest of the current visible order. */
export function pinToTop(currentIds: string[], id: string): string[] {
  return [id, ...currentIds.filter(x => x !== id)]
}
