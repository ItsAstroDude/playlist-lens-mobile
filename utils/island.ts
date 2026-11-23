/**
 * The top island's geometry (components/island). Pure maths, tested.
 *
 * Main screen: a black pill centred on the selfie camera (top centre on the Flip), inside
 * the status bar. Compact content sits in two lobes either side of the camera, never
 * over it; expanded, the pill grows down into a card and the camera sits in its top edge.
 * Cover screen: there's no camera up there (the cover's cameras are bottom-right), so
 * there's no pill: only cards, just under the status bar.
 */

export type IslandCompact = 'idle' | 'song' | 'waking' | 'reconnect'

/** Width of each lobe beside the camera, per compact state (idle = just the pill). */
export const LOBE: Record<IslandCompact, number> = { idle: 0, song: 34, waking: 40, reconnect: 30 }
/** Extra width on an idle pill so it reads as a pill, not a dot round the camera. */
const IDLE_PAD = 22

export interface IslandGeometry {
  /** Pill height (also the gap kept clear round the camera). */
  h: number
  /** Top of the pill / card, window dp. */
  top: number
  /** Where expanded content starts, measured from the card's top (below the camera). */
  contentTop: number
  /** Expanded card width. */
  expandedW: number
  /** False on the cover screen: no pill, cards only. */
  pill: boolean
}

export function islandGeometry(windowW: number, insetTop: number, cover: boolean): IslandGeometry {
  const expandedW = Math.max(200, Math.min(windowW - 16, 400))
  if (cover) return { h: 0, top: insetTop + 6, contentTop: 12, expandedW: Math.min(expandedW, windowW - 32), pill: false }
  // Fit inside the status bar with a little air above and below; sane on phones without one.
  const h = Math.max(24, Math.min(32, insetTop - 8))
  const top = Math.max(2, (insetTop - h) / 2)
  return { h, top, contentTop: h + 6, expandedW, pill: true }
}

/** The compact pill's width for a state: the camera's gap plus a lobe each side. */
export function compactWidth(g: IslandGeometry, state: IslandCompact): number {
  if (!g.pill) return 0
  return g.h + 2 * LOBE[state] + (state === 'idle' ? IDLE_PAD : 0)
}
