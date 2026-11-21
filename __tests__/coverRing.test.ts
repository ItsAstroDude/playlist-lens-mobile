import { pointAt, perimeter, stadium, cleanOutline, toDp, FLIP7_OUTLINE, type CameraOutline } from '@/components/cover/outline'
import { isCoverWindow } from '@/hooks/useCoverScreen'
import { liveFraction } from '@/components/cover/useRingProgress'

const o: CameraOutline = { cx1: 50, cx2: 130, cy: 390, r: 30 }
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6)

describe('camera ring geometry', () => {
  it('perimeter is two straights plus a full circle', () => {
    near(perimeter(o, 5), 2 * 80 + 2 * Math.PI * 35)
  })

  it('starts at the top centre and ends there', () => {
    const s = pointAt(o, 5, 0), e = pointAt(o, 5, 1)
    near(s.x, 90); near(s.y, 355)
    near(e.x, 90); near(e.y, 355)
  })

  it('goes clockwise: right lens first, bottom at the middle', () => {
    const P = perimeter(o, 5), R = 35
    const right = pointAt(o, 5, (40 + (Math.PI * R) / 2) / P)   // rightmost point
    near(right.x, 130 + R); near(right.y, 390)
    const bottom = pointAt(o, 5, 0.5)
    near(bottom.x, 90); near(bottom.y, 390 + R)
    const left = pointAt(o, 5, (40 + Math.PI * R + 80 + (Math.PI * R) / 2) / P)
    near(left.x, 50 - R); near(left.y, 390)
  })

  it('every point sits on the stadium', () => {
    const R = 35
    for (let i = 0; i <= 200; i++) {
      const { x, y } = pointAt(o, 5, i / 200)
      const cx = Math.min(130, Math.max(50, x))           // nearest point on the centre line
      near(Math.hypot(x - cx, y - 390), R)
    }
  })

  it('handles swapped lenses and a single lens', () => {
    const s = stadium({ ...o, cx1: 130, cx2: 50 }, 0)
    expect(s.left).toBe(20); expect(s.width).toBe(140)
    const one = { cx1: 60, cx2: 60, cy: 100, r: 10 }
    near(perimeter(one, 0), 2 * Math.PI * 10)
    near(pointAt(one, 0, 0.5).y, 110)
  })

  it('cleans stored outlines', () => {
    expect(cleanOutline(null)).toEqual(FLIP7_OUTLINE)
    expect(cleanOutline({ cx1: 'x', cx2: 100, cy: NaN, r: 900 })).toEqual({ cx1: FLIP7_OUTLINE.cx1, cx2: 100, cy: FLIP7_OUTLINE.cy, r: 300 })
  })

  it('converts panel px to dp, and the Flip 7 cameras sit bottom-right on the panel', () => {
    expect(toDp({ cx1: 600, cx2: 800, cy: 900, r: 80 }, 2)).toEqual({ cx1: 300, cx2: 400, cy: 450, r: 40 })
    const s = stadium(FLIP7_OUTLINE, 0)
    expect(s.left).toBeGreaterThan(948 / 2)
    expect(s.left + s.width).toBeLessThan(948)
    expect(s.top).toBeGreaterThan(1048 / 2)
    expect(s.top + s.height).toBeLessThan(1048)
  })
})

describe('cover screen detection', () => {
  it('Flip 7 cover window is the cover; the main screen is not', () => {
    expect(isCoverWindow(474, 524)).toBe(true)         // Flip 7 cover, as apps get it
    expect(isCoverWindow(399.2, 441.3)).toBe(true)
    expect(isCoverWindow(360, 840)).toBe(false)
    expect(isCoverWindow(840, 360)).toBe(false)        // main screen, landscape
    expect(isCoverWindow(360, 420)).toBe(true)         // short and squarish
    expect(isCoverWindow(360, 260)).toBe(false)        // split-screen strip
    expect(isCoverWindow(0, 0)).toBe(false)
  })
})

describe('ring progress', () => {
  it('advances while playing, holds while paused, clamps', () => {
    const t = { id: 'a', playing: true, progressMs: 10_000, durationMs: 100_000, receivedAt: 1_000 }
    near(liveFraction(t, 11_000), 0.2)
    near(liveFraction({ ...t, playing: false }, 11_000), 0.1)
    expect(liveFraction(t, 1e9)).toBe(1)
    expect(liveFraction({ ...t, durationMs: 0 })).toBe(0)
  })
})
