/**
 * Cover-screen camera outline: where the two rear cameras sit on the Flip's cover
 * screen, in dp of the cover window. Pure maths, no Skia, so it's testable and
 * usable from worklets.
 *
 * The cameras are modelled as two lenses of radius `r` side by side on one row
 * (`cy`), and the ring hugs their hull: a stadium (pill) `gap` dp outside the glass.
 *
 * PROTOTYPE: the Flip 7 numbers are a hardcoded estimate. Tune them on the phone in
 * Settings › About › Cover screen lab, which saves its own copy (see utils/settings).
 */

export interface CameraOutline {
  /** Centre x of the left lens. */
  cx1: number
  /** Centre x of the right lens. */
  cx2: number
  /** Centre y of both lenses. */
  cy: number
  /** Lens radius, glass edge. */
  r: number
}

/** Galaxy Z Flip 7 cover screen (948×1048 px @ 380 dpi ≈ 399×441 dp). Estimate. */
export const FLIP7_OUTLINE: CameraOutline = { cx1: 52, cx2: 128, cy: 391, r: 34 }

/** The ring's stadium for a given outline and gap: its box and corner radius. */
export function stadium(o: CameraOutline, gap: number) {
  'worklet'
  const a = Math.min(o.cx1, o.cx2), b = Math.max(o.cx1, o.cx2)
  const R = Math.max(0, o.r + gap)
  return { left: a - R, top: o.cy - R, width: b - a + 2 * R, height: 2 * R, R, a, b }
}

/** Length of the ring around the cameras. */
export function perimeter(o: CameraOutline, gap: number): number {
  'worklet'
  const s = stadium(o, gap)
  return 2 * (s.b - s.a) + 2 * Math.PI * s.R
}

/**
 * The point `t` (0–1, wraps) of the way round the ring, starting at the top centre
 * and going clockwise (right lens first). Matches the path `ringPath` draws, so a
 * dot placed here sits on the tip of a stroke trimmed to `end = t`.
 */
export function pointAt(o: CameraOutline, gap: number, t: number): { x: number; y: number } {
  'worklet'
  const { a, b, R } = stadium(o, gap)
  const L = b - a, mid = (a + b) / 2, cy = o.cy
  const P = 2 * L + 2 * Math.PI * R
  if (P <= 0) return { x: mid, y: cy }
  let s = (((t % 1) + 1) % 1) * P
  if (t >= 1) s = P          // t = 1 is the end, not the start again
  const arc = Math.PI * R

  if (s <= L / 2) return { x: mid + s, y: cy - R }
  s -= L / 2
  if (s <= arc) {
    const ang = -Math.PI / 2 + (R > 0 ? s / R : 0)
    return { x: b + R * Math.cos(ang), y: cy + R * Math.sin(ang) }
  }
  s -= arc
  if (s <= L) return { x: b - s, y: cy + R }
  s -= L
  if (s <= arc) {
    const ang = Math.PI / 2 + (R > 0 ? s / R : 0)
    return { x: a + R * Math.cos(ang), y: cy + R * Math.sin(ang) }
  }
  s -= arc
  return { x: a + Math.min(s, L / 2), y: cy - R }
}

/** Sanitise a stored/edited outline: finite numbers, sane sizes. */
export function cleanOutline(v: unknown, fallback: CameraOutline = FLIP7_OUTLINE): CameraOutline {
  const o = v as Partial<CameraOutline> | null
  const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d)
  if (!o || typeof o !== 'object') return { ...fallback }
  return {
    cx1: num(o.cx1, fallback.cx1),
    cx2: num(o.cx2, fallback.cx2),
    cy:  num(o.cy, fallback.cy),
    r:   Math.min(120, Math.max(4, num(o.r, fallback.r))),
  }
}
