import { compactWidth, islandGeometry, LOBE } from '@/utils/island'

describe('islandGeometry', () => {
  it('fits a pill inside the status bar, centred on its height', () => {
    const g = islandGeometry(411, 40, false)
    expect(g.pill).toBe(true)
    expect(g.h).toBe(32)
    expect(g.top).toBe(4)
    expect(g.top + g.h).toBeLessThanOrEqual(40)
    expect(g.contentTop).toBeGreaterThan(g.h)
  })
  it('keeps a usable pill on a short status bar', () => {
    const g = islandGeometry(411, 24, false)
    expect(g.h).toBe(24)
    expect(g.top).toBeGreaterThanOrEqual(2)
  })
  it('caps the expanded card and keeps a margin', () => {
    expect(islandGeometry(411, 40, false).expandedW).toBe(395)
    expect(islandGeometry(900, 40, false).expandedW).toBe(400)
  })
  it('has no pill on the cover screen, only cards under the status bar', () => {
    const g = islandGeometry(474, 30, true)
    expect(g.pill).toBe(false)
    expect(g.top).toBe(36)
    expect(g.expandedW).toBeLessThanOrEqual(474 - 32)
    expect(compactWidth(g, 'song')).toBe(0)
  })
})

describe('compactWidth', () => {
  const g = islandGeometry(411, 40, false)
  it('leaves the camera gap clear and adds a lobe each side', () => {
    expect(compactWidth(g, 'song')).toBe(g.h + 2 * LOBE.song)
    expect(compactWidth(g, 'waking')).toBeGreaterThan(compactWidth(g, 'song'))
  })
  it('is a small pill when idle', () => {
    expect(compactWidth(g, 'idle')).toBeGreaterThan(g.h)
    expect(compactWidth(g, 'idle')).toBeLessThan(compactWidth(g, 'song'))
  })
})
