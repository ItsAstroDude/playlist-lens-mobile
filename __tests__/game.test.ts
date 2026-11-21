import { buildPool, canPlay, playableKinds, firstPair, nextPair, pickChallenger, isRight, itemKey, verdict, type GameItem } from '@/utils/game'

const r = (name: string, plays: number, sub?: string) => ({ name, sub, plays, ms: plays * 180_000 })
const stats = {
  topTracks: [r('A', 50, 'X'), r('B', 40, 'X'), r('C', 30, 'Y'), r('D', 20, 'Y'), r('E', 10, 'Z'), r('F', 5, 'Z'), r('G', 1, 'Z'), r('A', 50, 'X')],
  topArtists: [r('X', 90), r('Y', 50)],
}

// Deterministic "random": cycles through the given values.
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length] }

describe('More or less', () => {
  it('builds a de-duplicated pool of items with 2+ plays', () => {
    const pool = buildPool(stats)
    expect(pool.filter(i => i.kind === 'track').map(i => i.name)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(pool.filter(i => i.kind === 'artist')).toHaveLength(2)
    expect(buildPool(null)).toEqual([])
  })

  it('only plays kinds with enough items', () => {
    const pool = buildPool(stats)
    expect(playableKinds(pool)).toEqual(['track'])   // 2 artists is too few
    expect(canPlay(pool)).toBe(true)
    expect(canPlay(buildPool({ topTracks: [r('A', 5), r('B', 5), r('C', 5), r('D', 5), r('E', 5), r('F', 5)], topArtists: [] }))).toBe(false) // all ties
  })

  it('never pairs a tie or the same item, and avoids recent ones', () => {
    const pool = buildPool(stats)
    const known = pool[0]
    for (let i = 0; i < 50; i++) {
      const c = pickChallenger(pool, known, [], Math.random)!
      expect(c.kind).toBe(known.kind)
      expect(c.plays).not.toBe(known.plays)
    }
    const recent = pool.slice(1, 5).map(itemKey)
    expect(pickChallenger(pool, known, recent, seq(0))!.name).toBe('F')
  })

  it('chains: the challenger becomes the known card', () => {
    const pool = buildPool(stats)
    const [a, b] = firstPair(pool, seq(0, 0, 0))!
    expect(a.kind).toBe(b.kind)
    const [k, c] = nextPair(pool, b, [itemKey(a), itemKey(b)], seq(0.9, 0))!
    expect(k).toBe(b)
    expect(c.plays).not.toBe(b.plays)
  })

  it('judges more and less', () => {
    const lo: GameItem = { kind: 'track', name: 'lo', plays: 3 }
    const hi: GameItem = { kind: 'track', name: 'hi', plays: 9 }
    expect(isRight('more', lo, hi)).toBe(true)
    expect(isRight('less', lo, hi)).toBe(false)
    expect(isRight('less', hi, lo)).toBe(true)
  })

  it('has a line for every score', () => {
    for (const s of [0, 1, 5, 10, 40]) expect(verdict(s).length).toBeGreaterThan(5)
  })
})
