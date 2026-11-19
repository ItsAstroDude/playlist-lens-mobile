import { rollingParts, rollDelays, rippleDelay, apertureGeometry, waveY, burstVectors } from '@/components/motion/math'

describe('rolling numbers', () => {
  it('splits digits from units and keys columns from the right', () => {
    const p = rollingParts('18h 24m')
    expect(p.map(x => x.kind)).toEqual(['digit', 'digit', 'char', 'char', 'digit', 'digit', 'char'])
    expect(p[0]).toEqual({ kind: 'digit', d: 1, key: '7' })
    // the ones column keeps its key when the number grows a digit
    expect(rollingParts('9%')[0].key).toBe(rollingParts('10%')[1].key)
  })
  it('staggers digits left to right so the ones column lands last', () => {
    const p = rollingParts('18h 24m')
    expect(rollDelays(p, 70)).toEqual([0, 70, 0, 0, 140, 210, 0])
  })
})

describe('calendar ripple', () => {
  it('runs a diagonal wave', () => {
    expect(rippleDelay(0, 0)).toBe(0)
    expect(rippleDelay(2, 3)).toBe(120)
    expect(rippleDelay(3, 2)).toBe(rippleDelay(2, 3))
  })
})

describe('aperture geometry', () => {
  it('draws a hexagonal iris and six separators', () => {
    const g = apertureGeometry(50, 50, 48, 1, 0)
    expect((g.iris.match(/L/g) ?? []).length).toBe(5)
    expect(g.iris.endsWith('Z')).toBe(true)
    expect((g.seps.match(/M/g) ?? []).length).toBe(6)
  })
  it('the iris shrinks as it closes and stays inside the rim', () => {
    const open = apertureGeometry(50, 50, 48, 1, 0).r, shut = apertureGeometry(50, 50, 48, 0, 0).r
    expect(shut).toBeLessThan(open)
    expect(open).toBeLessThan(48)
    expect(apertureGeometry(50, 50, 48, 5, 0).r).toBeLessThan(48)   // clamped
  })
  it('separators end at the rim', () => {
    const g = apertureGeometry(0, 0, 40, 1, 0.3)
    const ends = [...g.seps.matchAll(/L(-?[\d.]+),(-?[\d.]+)/g)].map(m => Math.hypot(+m[1], +m[2]))
    expect(ends).toHaveLength(6)
    ends.forEach(d => { expect(d).toBeGreaterThan(39); expect(d).toBeLessThan(45) })
  })
})

describe('liquid + burst helpers', () => {
  it('wave stays within base ± 1.4 × amplitude', () => {
    for (let x = 0; x < 200; x += 7) expect(Math.abs(waveY(x, 100, 10, 0.4) - 100)).toBeLessThanOrEqual(14.0001)
  })
  it('burst vectors spread around the circle at roughly the given distance', () => {
    const v = burstVectors(14, 50)
    expect(v).toHaveLength(14)
    v.forEach(p => { const d = Math.hypot(p.x, p.y); expect(d).toBeGreaterThan(36); expect(d).toBeLessThan(62) })
    expect(burstVectors(14, 50)).toEqual(v)   // deterministic
  })
})
