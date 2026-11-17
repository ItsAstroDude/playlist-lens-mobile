import type { SpotifyPlaylist } from '@/types'

/** Lowercase + strip accents, so "beyonce" finds "Beyoncé". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Filter lenses by a free-text query. Every whitespace-separated word must appear
 * in the playlist name or owner (any order) — "chill jazz" finds "Jazz to chill to".
 * An empty query returns the list untouched (same array, keeps memo identity).
 */
export function filterPlaylists(list: SpotifyPlaylist[], query: string): SpotifyPlaylist[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return list
  return list.filter(p => {
    const hay = normalize(`${p.name ?? ''} ${p.owner?.display_name ?? ''}`)
    return words.every(w => hay.includes(w))
  })
}
