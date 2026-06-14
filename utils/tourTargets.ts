/**
 * Tiny registry that lets the root-mounted guided tour (components/onboarding/
 * Tutorial.tsx) locate live UI deep inside the navigator — e.g. the floating
 * tab-bar items — so it can punch a spotlight cut-out over them.
 *
 * `measureInWindow` returns window-absolute coords, and the tour scrim is an
 * absoluteFill at the same window origin, so the measured rect lines up with the
 * cut-out directly. Targets register themselves on mount and unregister on
 * unmount; an absent target just resolves to null (the tour falls back to a
 * centred caption — e.g. the gestures-only navbar has no tab items to highlight).
 */
import type { View } from 'react-native'

export interface TourRect { x: number; y: number; width: number; height: number }

type Measure = () => Promise<TourRect | null>

const registry = new Map<string, Measure>()

/** Register a measurable target under `id`. Returns an unregister fn. */
export function registerTourTarget(id: string, measure: Measure): () => void {
  registry.set(id, measure)
  return () => { if (registry.get(id) === measure) registry.delete(id) }
}

/** Measure a registered target. null if it isn't mounted / has zero size. */
export async function measureTourTarget(id: string): Promise<TourRect | null> {
  const m = registry.get(id)
  if (!m) return null
  try { return await m() } catch { return null }
}

/** Build a Measure from a ref to any component exposing `measureInWindow`. */
export function measureRef(ref: React.RefObject<View | null>): Measure {
  return () => new Promise<TourRect | null>(resolve => {
    const node = ref.current
    if (!node || typeof node.measureInWindow !== 'function') return resolve(null)
    node.measureInWindow((x, y, width, height) => {
      // A not-yet-laid-out / detached node reports a zero-size rect.
      if (!width && !height) resolve(null)
      else resolve({ x, y, width, height })
    })
  })
}
