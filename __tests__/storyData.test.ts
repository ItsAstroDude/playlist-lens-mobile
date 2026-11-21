import { storage } from '@/utils/cache'
import { insertPlays, _resetForTests } from '@/utils/playDb'
import { runSync } from '@/utils/sqlJob'
import { storyJob, backFromKey } from '@/utils/storyData'
import { buildStory, clockPersona, bucketName } from '@/utils/story'
import type { StreamRow } from '@/utils/wrapped'

const row = (ts: string, track: string, artist: string, ms = 180_000): StreamRow => ({
  ts, ms_played: ms, spotify_track_uri: `spotify:track:${track}`,
  master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: 'Al',
})
const UTC = 0
const NOW = new Date(Date.UTC(2026, 10, 18, 12))     // Wed 18 Nov 2026

beforeEach(() => { storage.clearAll(); _resetForTests() })

describe('backFromKey', () => {
  it('years, months and ISO weeks back from now', () => {
    expect(backFromKey('year', '2026', NOW, UTC)).toBe(0)
    expect(backFromKey('year', '2024', NOW, UTC)).toBe(2)
    expect(backFromKey('month', '2026-11', NOW, UTC)).toBe(0)
    expect(backFromKey('month', '2025-12', NOW, UTC)).toBe(11)
    expect(backFromKey('week', '2026-W47', NOW, UTC)).toBe(0)
    expect(backFromKey('week', '2026-W46', NOW, UTC)).toBe(1)
    expect(backFromKey('week', '2026-W01', NOW, UTC)).toBe(46)      // starts Mon 29 Dec 2025
    expect(backFromKey('week', '2025-W52', NOW, UTC)).toBe(47)
  })
  it('nothing for seasons, the future or nonsense', () => {
    expect(backFromKey('season', '2026-Autumn', NOW, UTC)).toBeNull()
    expect(backFromKey('year', '2027', NOW, UTC)).toBeNull()
    expect(backFromKey('week', 'garbage', NOW, UTC)).toBeNull()
  })
})

describe('storyJob', () => {
  beforeEach(() => {
    insertPlays([
      row('2026-11-09T10:00:00Z', 'Last', 'A', 600_000),         // last week
      row('2026-11-10T10:00:00Z', 'Last', 'A', 600_000),
      row('2026-11-03T10:00:00Z', 'Before', 'B', 300_000),        // the week before
      row('2026-11-16T10:00:00Z', 'Now', 'C', 100_000),           // this week
      row('2024-05-01T10:00:00Z', 'Old', 'D', 900_000),
    ], 'recent')
  })

  it('a past week is the whole week, compared with the whole week before', () => {
    const d = runSync(storyJob('week', 1, NOW, UTC))
    expect(d.past).toBe(true)
    expect(d.comparison.current.plays).toBe(2)
    expect(d.comparison.current.ms).toBe(1_200_000)
    expect(d.comparison.deltaMs).toBe(300)                        // 1.2M vs 300k
    const slides = buildStory(d.comparison, { past: true })
    expect(slides.find(s => s.id === 'time')?.sub).toMatch(/on the week before/)
    expect(slides.at(-1)).toMatchObject({ id: 'outro', kicker: 'That was your week', share: true })
  })

  it('all time: years as buckets, the biggest year named', () => {
    const d = runSync(storyJob('all', 0, NOW, UTC))
    expect(d.all).toBe(true)
    const slides = buildStory(d.comparison, { all: true })
    expect(slides[0]).toMatchObject({ id: 'intro', big: 'All time' })
    expect(slides.find(s => s.id === 'time')?.bars?.peakText).toMatch(/^Biggest year: 2026 · /)
  })
})

describe('story slides (Phase 4)', () => {
  it('top-5 lists, covers and the clock slide when there is data for them', () => {
    const d = (() => { insertPlays([
      row('2026-11-16T22:00:00Z', 't1', 'A'), row('2026-11-16T22:10:00Z', 't2', 'B'), row('2026-11-16T22:20:00Z', 't3', 'C'),
    ], 'recent'); return runSync(storyJob('week', 0, NOW, UTC)) })()
    const slides = buildStory(d.comparison)
    const ids = slides.map(s => s.id)
    expect(ids).toEqual(expect.arrayContaining(['artists', 'tracks', 'clock']))
    expect(slides.find(s => s.id === 'artists')?.hero).toMatchObject({ kind: 'artist', name: expect.any(String) })
    expect(slides.find(s => s.id === 'artists')?.list).toHaveLength(2)          // #2 and #3 under the hero
    expect(slides.find(s => s.id === 'clock')).toMatchObject({ big: 'A night owl', sub: 'Most of your listening: 22:00–23:00' })
  })

  it('personas by hour', () => {
    expect([23, 2, 6, 10, 15, 20].map(clockPersona)).toEqual(
      ['A night owl', 'A night owl', 'An early bird', 'A morning listener', 'An afternoon listener', 'An evening listener'])
  })

  it('a month’s biggest day is named on the local calendar', () => {
    // 1 Nov 2026 00:00 in UTC+2 is 31 Oct 22:00 UTC; day 0 must still read "November 1".
    const start = Date.UTC(2026, 10, 1) - 2 * 3_600_000
    expect(bucketName('month', start, 0)).toMatch(/1/)
    expect(bucketName('month', start, 0)).not.toMatch(/31/)
  })
})

describe('story pictures (2.0.13)', () => {
  const { barLabels } = require('@/utils/story')

  it('time slide carries the bars, comparison and numbers; intro a mosaic; range a pyramid', () => {
    const rows: StreamRow[] = []
    // this week: 9 artists, a peak on Tuesday; last week up to the same point: less
    const days = ['16', '17', '17', '17', '18']
    for (let a = 0; a < 9; a++) rows.push(row(`2026-11-${days[a % days.length]}T0${a}:00:00Z`, `t${a}`, `A${a}`))
    rows.push(row('2026-11-10T08:00:00Z', 'old', 'Z'))
    insertPlays(rows, 'recent')
    const d = runSync(storyJob('week', 0, NOW, UTC))
    const slides = buildStory(d.comparison)
    const by = (id: string) => slides.find(s => s.id === id)!
    expect(by('time').bars).toMatchObject({ peak: 1, labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] })
    expect(by('time').bars!.values).toHaveLength(7)
    expect(by('time').compare).toMatchObject({ nowLabel: 'This week so far', beforeLabel: 'Last week, same point' })
    expect(by('time').chips!.map(c => c.label)).toEqual(['plays', 'days with music', 'per listening day'])
    expect(by('time').chips![1].value).toBe('3')                       // Mon, Tue, Wed
    expect(by('intro').mosaic).toHaveLength(6)
    expect(by('range').pyramid).toHaveLength(9)
    expect(by('artists').list).toHaveLength(8)                          // #2..#9 under the hero
  })

  it('bar labels per period', () => {
    expect(barLabels('year', 12, false)).toHaveLength(12)
    const m = barLabels('month', 30, false)
    expect(m[0]).toBe('1'); expect(m[7]).toBe('8'); expect(m[1]).toBe('')
    expect(barLabels('year', 3, true, ['2024', '2025', '2026'])).toEqual(["'24", "'25", "'26"])
  })
})
