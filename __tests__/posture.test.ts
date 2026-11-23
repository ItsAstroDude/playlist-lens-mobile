import { NO_FOLD, parsePosture, simulatedPosture, tabletopSplit } from '@/utils/posture'

describe('parsePosture', () => {
  it('reads a half fold from the native module', () => {
    const p = parsePosture({ state: 'half', orientation: 'horizontal', top: 480, bottom: 480, left: 0, right: 411 })
    expect(p).toEqual({ state: 'half', orientation: 'horizontal', top: 480, bottom: 480, left: 0, right: 411, source: 'native' })
  })
  it('treats missing, odd or no-fold payloads as no fold', () => {
    expect(parsePosture(null)).toBe(NO_FOLD)
    expect(parsePosture('half')).toBe(NO_FOLD)
    expect(parsePosture({ state: 'none' })).toBe(NO_FOLD)
    expect(parsePosture({ state: 'weird', top: 1 })).toBe(NO_FOLD)
  })
  it('zeroes non-numeric bounds and unknown orientations', () => {
    const p = parsePosture({ state: 'flat', orientation: 'diagonal', top: 'x', bottom: NaN })
    expect(p.state).toBe('flat')
    expect(p.orientation).toBeNull()
    expect(p.top).toBe(0)
    expect(p.bottom).toBe(0)
  })
})

describe('tabletopSplit', () => {
  const H = 960
  it('splits at a horizontal half-fold hinge', () => {
    const p = parsePosture({ state: 'half', orientation: 'horizontal', top: 470, bottom: 470, left: 0, right: 411 })
    expect(tabletopSplit(p, H)).toEqual({ top: 470, bottom: 490 })
  })
  it('subtracts a hinge with thickness', () => {
    const p = parsePosture({ state: 'half', orientation: 'horizontal', top: 460, bottom: 480, left: 0, right: 411 })
    expect(tabletopSplit(p, H)).toEqual({ top: 460, bottom: 480 })
  })
  it('is null when flat, vertical (book posture) or no fold', () => {
    expect(tabletopSplit(parsePosture({ state: 'flat', orientation: 'horizontal', top: 480, bottom: 480 }), H)).toBeNull()
    expect(tabletopSplit(parsePosture({ state: 'half', orientation: 'vertical', top: 0, bottom: 960 }), H)).toBeNull()
    expect(tabletopSplit(NO_FOLD, H)).toBeNull()
  })
  it('ignores a hinge too near an edge to be a real split', () => {
    expect(tabletopSplit(parsePosture({ state: 'half', orientation: 'horizontal', top: 120, bottom: 120 }), H)).toBeNull()
    expect(tabletopSplit(parsePosture({ state: 'half', orientation: 'horizontal', top: 860, bottom: 860 }), H)).toBeNull()
  })
  it('simulates a fold across the middle', () => {
    const p = simulatedPosture(H, 411)
    expect(p.source).toBe('simulated')
    expect(tabletopSplit(p, H)).toEqual({ top: 480, bottom: 480 })
  })
})
