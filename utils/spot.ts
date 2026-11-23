/**
 * The spot (components/spot): a small floating dot you can drag anywhere. Let go and
 * it springs to the nearest side edge; when it has something to say it opens into a
 * card from where it sits. Pure geometry here (tested); positions are the dot's centre
 * in window dp.
 */

export type SpotSide = 'left' | 'right'

export interface SpotArea {
  W: number
  H: number
  insetTop: number
  insetBottom: number
  /** The Flip's cover screen: keep clear of the cameras in the bottom-right. */
  cover: boolean
}

/** The dot's size, its touch target, and its gap from the edge it rests on. */
export const SPOT = { dot: 14, hit: 44, margin: 14 } as const
/** Opened card: corner radius and side margin. */
export const CARD = { radius: 22, margin: 10, maxW: 360 } as const

/** Where it rests by default: the right edge, a little below the top. */
export const DEFAULT_REST: { side: SpotSide; yFrac: number } = { side: 'right', yFrac: 0.2 }

/** The band it may rest in vertically (clear of the status bar and the bottom chrome). */
export function yRange(a: SpotArea): [number, number] {
  const min = a.insetTop + 28
  // Bottom: the tab bar + now-playing pill on the main screen; the cameras on the cover.
  const max = a.H - (a.cover ? 150 : a.insetBottom + 150)
  return [min, Math.max(min, max)]
}

export function clamp(v: number, lo: number, hi: number): number {
  'worklet'
  return Math.min(hi, Math.max(lo, v))
}

export function restX(side: SpotSide, W: number): number {
  'worklet'
  return side === 'left' ? SPOT.margin + SPOT.dot / 2 : W - SPOT.margin - SPOT.dot / 2
}

export function restPoint(side: SpotSide, yFrac: number, a: SpotArea): { x: number; y: number } {
  const [lo, hi] = yRange(a)
  return { x: restX(side, a.W), y: clamp(yFrac * a.H, lo, hi) }
}

/** Which edge a release goes to: where it's heading (a flick counts), not just where it is. */
export function snapSide(x: number, vx: number, W: number): SpotSide {
  'worklet'
  const projected = x + vx * 0.18
  return projected < W / 2 ? 'left' : 'right'
}

/** The card it opens into: on its own side, level with it, kept on screen. */
export function cardRect(side: SpotSide, y: number, cardH: number, a: SpotArea): { left: number; top: number; width: number } {
  const width = Math.max(200, Math.min(a.W - CARD.margin * 2, CARD.maxW))
  const left = side === 'left' ? CARD.margin : a.W - CARD.margin - width
  const lo = a.insetTop + 8
  const hi = Math.max(lo, a.H - (a.cover ? 140 : a.insetBottom + 16) - cardH)
  return { left, top: clamp(y - 22, lo, hi), width }
}
