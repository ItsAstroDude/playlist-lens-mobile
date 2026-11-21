/**
 * Cover-screen camera outline: where the two rear cameras sit on the Flip's cover
 * screen. Stored in the cover panel's PHYSICAL PIXELS (Flip 7: 948×1048, cameras
 * bottom-right, flash to their left). `toDp` scales by window size ÷ panel size.
 * Don't use PixelRatio.get() for this: React Native keeps the MAIN screen's value
 * (e.g. ×2.625) after the app moves to the cover screen, where apps really run at
 * ×2.0 (474×524 dp). Pure maths, no Skia, so it's testable and usable from worklets.
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

/** Galaxy Z Flip 7 cover screen, in panel px. Estimated from a photo of the phone. */
export const FLIP7_OUTLINE: CameraOutline = { cx1: 649, cx2: 836, cy: 935, r: 85 }

/** The Flip 7 cover panel, physical px. */
export const FLIP7_PANEL = { width: 948, height: 1048 }

/** dp per panel px for a window that fills the panel (≈0.5 on the Flip 7 cover). */
export function panelScale(windowWidth: number, panelWidth = FLIP7_PANEL.width): number {
  return windowWidth > 0 && panelWidth > 0 ? windowWidth / panelWidth : 0.5
}

/** Panel px → the window's dp. `scale` from panelScale(). */
export function toDp(o: CameraOutline, scale: number): CameraOutline {
  const k = scale > 0 ? scale : 0.5
  return { cx1: o.cx1 * k, cx2: o.cx2 * k, cy: o.cy * k, r: o.r * k }
}

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
    r:   Math.min(300, Math.max(8, num(o.r, fallback.r))),
  }
}
