import { storage } from '@/utils/cache'
import { insertPlays, _resetForTests } from '@/utils/playDb'
import {
  periodRange, periodStats, comparePeriod, historyPage, historyTotals, dayTotals, localDay, playSpan,
} from '@/utils/stats'
import type { StreamRow } from '@/utils/wrapped'

const row = (ts: string, track: string, artist: string, ms = 180_000, album: string | null = 'Al', uri = `spotify:track:${track}`): StreamRow => ({
  ts, ms_played: ms, spotify_track_uri: uri,
  master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: album,
})

const UTC = 0
const BUCHAREST = 2 * 3600          // UTC+2 (winter)
// Wed 2026-11-18 12:00 UTC
const NOW = new Date(Date.UTC(2026, 10, 18, 12))

beforeEach(() => { storage.clearAll(); _resetForTests() })

describe('periodRange', () => {
  it('weeks start Monday at local midnight', () => {
    const { start, end } = periodRange('week', NOW, UTC)
    expect(start).toBe(Date.UTC(2026, 10, 16) / 1000)       // Mon 16 Nov
    expect(end - start).toBe(7 * 86_400)
  })
  it('shifts boundaries to the local clock', () => {
    const { start } = periodRange('month', NOW, BUCHAREST)
    expect(start).toBe(Date.UTC(2026, 10, 1) / 1000 - BUCHAREST)   // 1 Nov 00:00 local = 31 Oct 22:00 UTC
  })
  it('goes back whole periods', () => {
    expect(periodRange('year', NOW, UTC, 1)).toEqual({ start: Date.UTC(2025, 0, 1) / 1000, end: Date.UTC(2026, 0, 1) / 1000 })
    expect(periodRange('month', NOW, UTC, 11).start).toBe(Date.UTC(2025, 11, 1) / 1000)
  })
})

describe('periodStats', () => {
  beforeEach(() => {
    insertPlays([
      row('2026-11-16T08:00:00Z', 'One', 'A', 200_000),          // Mon
      row('2026-11-16T09:00:00Z', 'One', 'A', 200_000),          // Mon
      row('2026-11-17T20:00:00Z', 'Two', 'B', 100_000, 'Bee'),   // Tue
      row('2026-11-18T23:30:00Z', 'Three', 'A', 50_000, null),   // Wed (UTC) / Thu 01:30 local
      row('2026-11-09T10:00:00Z', 'Old', 'C', 300_000),          // last week
      row('2025-03-01T10:00:00Z', 'Ancient', 'D', 400_000),      // last year
    ], 'recent')
  })

  it('totals, uniques and top lists for a week', () => {
    const s = periodStats('week', { now: NOW, offsetSec: UTC })
    expect(s.plays).toBe(4)
    expect(s.ms).toBe(550_000)
    expect(s.artists).toBe(2)
    expect(s.tracks).toBe(3)
    expect(s.albums).toBe(2)                 // Al by A, Bee by B (Three has no album)
    expect(s.activeDays).toBe(3)
    expect(s.topArtists.map(a => [a.name, a.ms, a.plays])).toEqual([['A', 450_000, 3], ['B', 100_000, 1]])
    expect(s.topTracks[0]).toMatchObject({ name: 'One', sub: 'A', plays: 2, uri: 'spotify:track:One' })
    expect(s.buckets).toEqual([400_000, 100_000, 50_000, 0, 0, 0, 0])
    expect(s.bucketLabels[0]).toBe('Mon')
  })

  it('listening clock and weekdays follow the local clock', () => {
    const s = periodStats('week', { now: NOW, offsetSec: BUCHAREST })
    expect(s.clock[10]).toBe(200_000)        // 08:00 UTC → 10:00 local
    expect(s.clock[1]).toBe(50_000)          // 23:30 UTC Wed → 01:30 Thu local
    expect(s.weekdays[3]).toBe(50_000)       // Thu
    expect(s.buckets[3]).toBe(50_000)
  })

  it('a year buckets by month, all time by year', () => {
    const y = periodStats('year', { now: NOW, offsetSec: UTC })
    expect(y.buckets[10]).toBe(850_000)      // November
    expect(y.buckets).toHaveLength(12)
    const all = periodStats('all', { now: NOW, offsetSec: UTC })
    expect(all.plays).toBe(6)
    expect(all.bucketLabels).toEqual(['2025', '2026'])
    expect(all.buckets).toEqual([400_000, 850_000])
    expect(playSpan()?.first).toBe(Date.UTC(2025, 2, 1, 10) / 1000)
  })

  it('compares this week so far with last week at the same point', () => {
    const c = comparePeriod('week', { now: NOW, offsetSec: UTC })
    expect(c.current.plays).toBe(3)          // up to Wed 12:00 — the 23:30 play hasn't happened yet
    expect(c.previous.plays).toBe(1)
    expect(c.deltaPlays).toBe(200)
  })

  it('an empty database gives zeros, not errors', () => {
    _resetForTests(); storage.clearAll()
    const empty = require('@/utils/playDb')
    empty._resetForTests()
    const s = periodStats('all', { now: NOW, offsetSec: UTC })
    expect(s.plays).toBe(0)
    expect(s.topArtists).toEqual([])
  })
})

describe('history', () => {
  beforeEach(() => {
    const rows: StreamRow[] = []
    for (let i = 0; i < 25; i++) rows.push(row(`2026-11-${String(10 + (i % 5)).padStart(2, '0')}T${String(8 + i % 10).padStart(2, '0')}:00:00Z`, `Song ${i}`, i % 2 ? 'Odd Band' : 'Even Band', 60_000, i % 3 ? 'Album 100%' : 'Other'))
    insertPlays(rows, 'recent')
  })

  it('pages newest first without gaps or repeats', () => {
    const seen: string[] = []
    let after = null as null | { t: number; uri: string }
    for (let p = 0; p < 10; p++) {
      const page = historyPage({}, after, 7)
      if (!page.length) break
      seen.push(...page.map(x => x.uri))
      after = page[page.length - 1]
    }
    expect(seen).toHaveLength(25)
    expect(new Set(seen).size).toBe(25)
    const ts = historyPage({}, null, 25).map(x => x.t)
    expect([...ts].sort((a, b) => b - a)).toEqual(ts)
  })

  it('searches every word across track, artist and album, literally', () => {
    expect(historyTotals({ query: 'odd song' }).plays).toBe(12)
    expect(historyTotals({ query: '100%' }).plays).toBe(16)
    expect(historyTotals({ query: '_' }).plays).toBe(0)        // not a wildcard
    expect(historyTotals({ query: 'nothing here' }).plays).toBe(0)
  })

  it('filters by artist / album and totals match', () => {
    const t = historyTotals({ artist: 'Even Band' })
    expect(t.plays).toBe(13)
    expect(t.ms).toBe(13 * 60_000)
    expect(historyPage({ artist: 'Even Band', album: 'Other' }, null).every(p => p.artist === 'Even Band' && p.album === 'Other')).toBe(true)
  })

  it('per-day totals by local day', () => {
    const day = localDay(Date.UTC(2026, 10, 10) / 1000, UTC)
    const m = dayTotals({}, day, day + 4, UTC)
    expect([...m.values()].reduce((a, x) => a + x.plays, 0)).toBe(25)
    expect(m.get(day)?.plays).toBe(5)
  })
})
