/**
 * Fold posture (the Flip's main screen): flat, or half-folded like a laptop ("Flex
 * mode" / tabletop). Android reports it through Jetpack WindowManager's FoldingFeature;
 * the DisplayInfo native module (modules/display-info, APK versionCode 5+) passes it on.
 * Pure helpers here (tested); the hook is hooks/usePosture.ts.
 */

export type FoldState = 'flat' | 'half' | 'none'

export interface Posture {
  /** 'none' = no fold in this window (the cover screen, a normal phone, an old APK). */
  state: FoldState
  /** The hinge line: 'horizontal' on a Flip held upright (tabletop), 'vertical' on a Fold. */
  orientation: 'horizontal' | 'vertical' | null
  /** The hinge's box in window dp. A Flip's hinge has no thickness (top === bottom). */
  top: number
  bottom: number
  left: number
  right: number
  /** 'native' = from Android; 'simulated' = Labs switch; 'none' = nothing to go on. */
  source: 'native' | 'simulated' | 'none'
}

export const NO_FOLD: Posture = { state: 'none', orientation: null, top: 0, bottom: 0, left: 0, right: 0, source: 'none' }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Whatever the native module sent → a Posture (defensive: old/odd payloads read as no fold). */
export function parsePosture(raw: unknown): Posture {
  const r = raw as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return NO_FOLD
  const state: FoldState = r.state === 'half' ? 'half' : r.state === 'flat' ? 'flat' : 'none'
  if (state === 'none') return NO_FOLD
  const orientation = r.orientation === 'horizontal' ? 'horizontal' : r.orientation === 'vertical' ? 'vertical' : null
  return { state, orientation, top: num(r.top), bottom: num(r.bottom), left: num(r.left), right: num(r.right), source: 'native' }
}

/** The Labs preview: a half fold across the middle of the window. */
export function simulatedPosture(windowHeight: number, windowWidth: number): Posture {
  const mid = Math.round(windowHeight / 2)
  return { state: 'half', orientation: 'horizontal', top: mid, bottom: mid, left: 0, right: windowWidth, source: 'simulated' }
}

/**
 * Tabletop: half-folded with the hinge across the screen, so the top half stands up and
 * the bottom half lies on the table. Returns the two halves' heights (window dp), or
 * null when the phone isn't in that posture or the hinge isn't somewhere sensible.
 */
export function tabletopSplit(p: Posture, windowHeight: number): { top: number; bottom: number } | null {
  if (p.state !== 'half' || p.orientation !== 'horizontal' || windowHeight <= 0) return null
  const top = Math.max(0, p.top)
  const bottom = Math.max(0, windowHeight - Math.max(p.bottom, p.top))
  // A hinge near an edge isn't a usable split (e.g. a stale reading mid-rotation).
  if (top < windowHeight * 0.25 || bottom < windowHeight * 0.25) return null
  return { top, bottom }
}
