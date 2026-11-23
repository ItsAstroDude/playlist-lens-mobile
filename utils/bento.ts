/**
 * Cover-screen Lenses (components/cover/CoverBento + PlaylistCard 'tile'): three
 * columns. `tile` is one cell (a playlist cover, the week tiles); `big` spans two
 * columns and two rows (the now-playing tile). Pure, tested.
 */
export const BENTO_PAD = 16
export const BENTO_GAP = 12

export function bentoSizes(windowW: number): { tile: number; big: number; gap: number } {
  const tile = Math.max(60, Math.floor((windowW - BENTO_PAD * 2 - BENTO_GAP * 2) / 3))
  return { tile, big: tile * 2 + BENTO_GAP, gap: BENTO_GAP }
}
