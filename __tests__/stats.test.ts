import { storage } from '@/utils/cache'
import { insertPlays, _resetForTests } from '@/utils/playDb'
import {
  periodRange, localOffsetSec, periodStats, comparePeriod, historyPage, historyTotals, dayTotals, localDay, playSpan,
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

  it('in the phone’s zone, a summer “this year” starts at January’s midnight, not July’s offset', () => {
    // Berlin 2025–26: UTC+2 from 30 Mar 2025 01:00 UTC to 26 Oct 2025 01:00, and from 29 Mar 2026 01:00 to 25 Oct 2026 01:00.
    const summer = (ms: number) => (ms >= Date.UTC(2025, 2, 30, 1) && ms < Date.UTC(2025, 9, 26, 1)) || (ms >= Date.UTC(2026, 2, 29, 1) && ms < Date.UTC(2026, 9, 25, 1))
    const spy = jest.spyOn(Date.prototype, 'getTimezoneOffset').mockImplementation(function (this: Date) { return summer(this.getTime()) ? -120 : -60 })
    try {
      const july = new Date(Date.UTC(2026, 6, 15, 12))
      const { start, end } = periodRange('year', july, localOffsetSec(july))
      expect(start).toBe(Date.UTC(2025, 11, 31, 23) / 1000)            // Jan 1 00:00 CET (UTC+1)
      expect(end).toBe(Date.UTC(2026, 11, 31, 23) / 1000)
      const w = periodRange('week', new Date(Date.UTC(2026, 2, 30, 12)), localOffsetSec(new Date(Date.UTC(2026, 2, 30, 12))))
      expect(w.start).toBe(Date.UTC(2026, 2, 29, 22) / 1000)            // Mon 30 Mar 00:00 CEST
      // (the week before held the switch to summer time: it is 167 hours long)
      const prev = periodRange('week', new Date(Date.UTC(2026, 2, 30, 12)), localOffsetSec(new Date(Date.UTC(2026, 2, 30, 12))), 1)
      expect(prev.end - prev.start).toBe(167 * 3600)
    } finally { spy.mockRestore() }
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

describe('recaps from the database', () => {
  const { recapsFromDb } = require('@/utils/stats')
  const { beginImport, addImportChunk, finishImport } = require('@/utils/playDb')

  it('keys and labels match the 1.x bundle, newest first, with top lists', () => {
    insertPlays([
      row('2026-11-16T10:00:00Z', 'Ghost', 'DECO', 200_000),
      row('2026-11-17T10:00:00Z', 'Ghost', 'DECO', 200_000),
      row('2026-11-17T11:00:00Z', 'Aurora', 'HOYO', 100_000, 'B'),
      row('2026-01-09T10:00:00Z', 'Iarta', 'Smiley', 300_000, 'C'),
      row('2025-12-20T10:00:00Z', 'Snow', 'Smiley', 300_000, 'C'),
    ], 'recent')
    const r = recapsFromDb(null, NOW, UTC)
    expect(r.years.map((y: any) => y.key)).toEqual(['2026', '2025'])
    expect(r.years[0]).toMatchObject({ label: '2026', streams: 4, ms: 800_000 })
    expect(r.years[0].topArtists[0]).toMatchObject({ name: 'DECO', ms: 400_000 })
    expect(r.years[0].topTracks[0]).toMatchObject({ name: 'Ghost', artist: 'DECO', plays: 2 })
    // Dec 2025 + Jan 2026 are one winter, labelled by the year it began
    const winter = r.seasons.find((s: any) => s.key === '2025-Winter')
    expect(winter).toMatchObject({ label: 'Winter 2025', streams: 2 })
    expect(r.seasons[0].key).toBe('2026-Autumn')
    expect(r.months[0]).toMatchObject({ key: '2026-11', label: 'November 2026', streams: 3 })
    expect(r.weeks[0]).toMatchObject({ key: '2026-W47', label: 'Week 47 · 2026', streams: 3 })
  })

  it('weeks follow the local clock', () => {
    // Sunday 23:30 UTC = Monday 01:30 in Bucharest → next ISO week there
    insertPlays([row('2026-11-15T23:30:00Z', 'Late', 'A')], 'recent')
    expect(recapsFromDb(null, NOW, UTC).weeks[0].key).toBe('2026-W46')
    expect(recapsFromDb(null, NOW, BUCHAREST).weeks[0].key).toBe('2026-W47')
  })

  it('keeps a pre-2.0 stored bundle for history the database does not have', () => {
    const old = { key: '2019', label: '2019', kind: 'year', ms: 1, streams: 1, topArtists: [], topTracks: [], topAlbums: [] }
    const stored = { version: 1, generatedAt: '', years: [old], seasons: [], months: [], weeks: [] }
    insertPlays([row('2026-11-16T10:00:00Z', 'Ghost', 'DECO')], 'recent')
    expect(recapsFromDb(stored, NOW, UTC).years.map((y: any) => y.key)).toEqual(['2026', '2019'])
    // …but once the database holds an import, it is the whole history
    beginImport(); addImportChunk([row('2018-05-01T10:00:00Z', 'Old', 'Z')]); finishImport()
    expect(recapsFromDb(stored, NOW, UTC).years.map((y: any) => y.key)).toEqual(['2026', '2018'])
  })

  it('nothing anywhere → null', () => {
    expect(recapsFromDb(null, NOW, UTC)).toBeNull()
  })
})

describe('all time', () => {
  const { allTimeStats, yearsWithTopArtist } = require('@/utils/stats')
  const { beginImport, addImportChunk, finishImport } = require('@/utils/playDb')
  const stored = { version: 1, generatedAt: '', totalMs: 9, totalStreams: 100, realListens: 1, podcastStreams: 7, skipCount: 25,
    uniqueArtists: 1, uniqueTracks: 1, firstTs: null, lastTs: null, topArtists: [], topTracks: [], topAlbums: [], byYear: [], clock: [], weekday: [] }

  it('tracking only (no import): all time comes from the database', () => {
    insertPlays([row('2026-11-16T10:00:00Z', 'Ghost', 'DECO', 200_000), row('2025-02-01T10:00:00Z', 'Old', 'Z', 10_000)], 'recent')
    const s = allTimeStats(null, NOW, UTC)
    expect(s).toMatchObject({ totalStreams: 2, totalMs: 210_000, realListens: 1, skipCount: 0, uniqueArtists: 2 })
    expect(s.byYear).toEqual([
      { year: 2025, ms: 10_000, streams: 1, topArtist: 'Z' },
      { year: 2026, ms: 200_000, streams: 1, topArtist: 'DECO' },
    ])
    expect(s.weekday[1]).toBe(200_000)       // Monday, in the Sunday-first array
    expect(s.firstTs).toBe('2025-02-01T10:00:00.000Z')
  })

  it('a pre-2.0 import (only the stored summary) stays the source', () => {
    insertPlays([row('2026-11-16T10:00:00Z', 'Ghost', 'DECO')], 'recent')
    expect(allTimeStats(stored, NOW, UTC)).toBe(stored)
  })

  it('with an import in the database: engine numbers + the import skip rate and podcasts', () => {
    beginImport(); addImportChunk([row('2024-05-01T10:00:00Z', 'A1', 'X'), row('2024-05-02T10:00:00Z', 'A2', 'X')]); finishImport()
    insertPlays([row('2026-11-16T10:00:00Z', 'Ghost', 'DECO')], 'tracked')
    const s = allTimeStats(stored, NOW, UTC)
    expect(s.totalStreams).toBe(3)            // import + plays tracked since
    expect(s.skipCount).toBe(1)               // 25% of 3, rounded
    expect(s.podcastStreams).toBe(7)
    expect(yearsWithTopArtist(UTC).map((y: any) => y.year)).toEqual([2024, 2026])
  })

  it('nothing at all → null', () => {
    expect(allTimeStats(null, NOW, UTC)).toBeNull()
  })
})

describe('calendar', () => {
  const { yearCalendar, heatLevel, yearsWithPlays } = require('@/utils/stats')

  it('one entry per day of the year, leap years included', () => {
    expect(yearCalendar(2024, UTC).days).toBe(366)
    expect(yearCalendar(2026, UTC).days).toBe(365)
    expect(yearCalendar(2026, UTC).firstDay).toBe(Date.UTC(2026, 0, 1) / 86_400_000)
  })

  it('totals, active days, longest streak, local days', () => {
    insertPlays([
      row('2026-03-01T10:00:00Z', 'a', 'A', 100_000),
      row('2026-03-02T10:00:00Z', 'b', 'A', 200_000),
      row('2026-03-03T10:00:00Z', 'c', 'A', 300_000),
      row('2026-03-03T11:00:00Z', 'd', 'A', 300_000),
      row('2026-03-10T23:30:00Z', 'e', 'A', 50_000),     // 11 Mar in Bucharest
      row('2025-12-31T23:30:00Z', 'f', 'A', 50_000),     // 1 Jan 2026 in Bucharest
    ], 'recent')
    const c = yearCalendar(2026, UTC)
    expect(c.activeDays).toBe(4)
    expect(c.longestStreak).toBe(3)
    expect(c.ms[59]).toBe(100_000)                       // 1 Mar = day index 59
    expect(c.plays[61]).toBe(2)
    const b = yearCalendar(2026, BUCHAREST)
    expect(b.ms[0]).toBe(50_000)                          // New Year's Eve play lands on 1 Jan locally
    expect(b.ms[69]).toBe(50_000)                         // 11 Mar
    expect(yearsWithPlays(UTC)).toEqual([2026, 2025])
    expect(yearsWithPlays(BUCHAREST)).toEqual([2026])
  })

  it('heat levels: 0 for silence, then this year’s quartiles', () => {
    const lv: [number, number, number] = [10, 20, 30]
    expect([0, 5, 10, 15, 25, 31].map(v => heatLevel(v, lv))).toEqual([0, 1, 1, 2, 3, 4])
  })

  it('history can be cut to one local day', () => {
    insertPlays([row('2026-03-10T23:30:00Z', 'late', 'A'), row('2026-03-10T12:00:00Z', 'noon', 'A')], 'recent')
    const day = localDay(Date.UTC(2026, 2, 11) / 1000, UTC)
    const from = day * 86_400 - BUCHAREST, to = from + 86_400
    expect(historyPage({ from, to }, null).map(p => p.track)).toEqual(['late'])
  })
})


describe('period comparison carries the clock and weekdays', () => {
  it('for the screens that draw them', () => {
    const { periodComparison } = require('@/utils/stats')
    insertPlays([row('2026-11-17T21:00:00Z', 'a', 'A', 120_000)], 'recent')     // Tue 21:00 UTC
    const c = periodComparison('month', NOW, UTC)
    expect(c.current.clock[21]).toBe(120_000)
    expect(c.current.weekdays[1]).toBe(120_000)
    expect(c.current.clock).toHaveLength(24)
    expect(c.current.weekdays).toHaveLength(7)
  })
})
