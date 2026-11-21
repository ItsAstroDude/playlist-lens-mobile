import { buildStory, fmtListen, bucketName } from '@/utils/story'
import type { PeriodComparison, PeriodSummary } from '@/utils/listening'

const H = 3_600_000
function summary(over: Partial<PeriodSummary> = {}): PeriodSummary {
  return {
    kind: 'week', start: Date.UTC(2026, 10, 16), end: Date.UTC(2026, 10, 23), ms: 18 * H + 24 * 60_000, plays: 412,
    artists: 96, tracks: 210, buckets: [2 * H, 5 * H, 3 * H, 0, 0, 0, 0],
    topArtists: [{ name: 'Radiohead', ms: 3 * H, plays: 48 }],
    topTracks: [{ name: 'Reckoner', sub: 'Radiohead', ms: H, plays: 9 }],
    topAlbums: [], ...over,
  }
}
const comp = (cur: PeriodSummary, delta: number | null = 12): PeriodComparison => ({ current: cur, previous: summary({ plays: 0 }), deltaMs: delta, deltaPlays: null })

describe('story slides', () => {
  it('tells the week in order: intro, time, artist, track, peak day, range, outro', () => {
    const s = buildStory(comp(summary()))
    expect(s.map(x => x.id)).toEqual(['intro', 'time', 'artist', 'track', 'peak', 'range', 'outro'])
    expect(s[1]).toMatchObject({ big: '18h 24m', roll: true, sub: 'Up 12% on last week · 412 plays' })
    expect(s[2]).toMatchObject({ big: 'Radiohead', sub: '3h 00m · 48 plays' })
    expect(s[4]).toMatchObject({ kicker: 'Your biggest day', big: 'Tuesday', sub: '5h 00m' })
    expect(s[5]).toMatchObject({ big: '96', sub: 'artists and 210 different songs' })
    s.forEach(x => expect(x.palette).toHaveLength(4))
  })
  it('skips what it has no data for, and says so when the period is empty', () => {
    const s = buildStory(comp(summary({ topArtists: [], topTracks: [], buckets: [0, 0, 0, 0, 0, 0, 0] }), null))
    expect(s.map(x => x.id)).toEqual(['intro', 'time', 'range', 'outro'])
    expect(s[1].sub).toBe('412 plays')
    expect(buildStory(comp(summary({ plays: 0 })))).toEqual([expect.objectContaining({ id: 'empty', big: 'Nothing yet' })])
  })
  it('names the busiest month in a year', () => {
    const y = summary({ kind: 'year', start: Date.UTC(2026, 0, 1), buckets: [0, 0, 9 * H, 1, 0, 0, 0, 0, 0, 0, 0, 0] })
    expect(buildStory(comp(y)).find(x => x.id === 'peak')).toMatchObject({ kicker: 'Your biggest month', big: 'March' })
  })
  it('formats listening time', () => {
    expect(fmtListen(45 * 60_000)).toBe('45m')
    expect(fmtListen(18 * H + 4 * 60_000)).toBe('18h 04m')
    expect(fmtListen(312 * H)).toBe('312h')
    expect(bucketName('week', 0, 6)).toBe('Sunday')
  })
})

describe('fitting headlines', () => {
  const { fitScale } = require('@/components/story/FitHeadline')
  it('short titles stay full size', () => {
    expect(fitScale([180], 340)).toBe(1)
    expect(fitScale([120, 90], 340)).toBe(1)
  })
  it('one long word shrinks until it fits the line (the CONTRADICTIONS case)', () => {
    const s = fitScale([690], 340)
    expect(690 * s).toBeLessThanOrEqual(338)
    expect(s).toBeGreaterThan(0.45)
  })
  it('many words shrink to fit three lines', () => {
    const words = Array(12).fill(150)                    // 1800 pt of words, 340 pt lines
    const s = fitScale(words, 340, 3)
    expect(1800 * s).toBeLessThanOrEqual(3 * 340 * 0.85 + 1)
  })
  it('never below the floor', () => {
    expect(fitScale([5000], 340)).toBe(0.42)
  })
})
