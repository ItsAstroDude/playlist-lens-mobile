import { periodRange, summarize, comparePeriods, periodTitle, bucketLabels } from '@/utils/listening'
import type { StreamRow } from '@/utils/wrapped'

const row = (ts: string, track: string, artist = 'A', ms = 180_000, album: string | null = 'Al'): StreamRow => ({
  ts, ms_played: ms, master_metadata_track_name: track, master_metadata_album_artist_name: artist,
  master_metadata_album_album_name: album, spotify_track_uri: `spotify:track:${track}`,
})
const NOW = new Date('2026-11-18T12:00:00Z')   // a Wednesday

describe('periodRange', () => {
  it('weeks start Monday 00:00 UTC; back shifts by whole periods', () => {
    expect(new Date(periodRange('week', NOW).start).toISOString()).toBe('2026-11-16T00:00:00.000Z')
    expect(new Date(periodRange('week', NOW, 1).start).toISOString()).toBe('2026-11-09T00:00:00.000Z')
    const sun = new Date('2026-11-22T23:00:00Z')
    expect(new Date(periodRange('week', sun).start).toISOString()).toBe('2026-11-16T00:00:00.000Z')
  })
  it('months and years, including across a year boundary', () => {
    const jan = new Date('2027-01-05T00:00:00Z')
    expect(new Date(periodRange('month', jan, 1).start).toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(new Date(periodRange('year', NOW).end).toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})

describe('summarize', () => {
  const rows = [
    row('2026-11-16T09:00:00Z', 'One', 'A', 200_000),
    row('2026-11-16T10:00:00Z', 'One', 'A', 100_000),
    row('2026-11-17T09:00:00Z', 'Two', 'B', 400_000, 'Bl'),
    row('2026-11-15T09:00:00Z', 'Old', 'C'),                     // previous week
    { ...row('2026-11-17T11:00:00Z', 'Pod'), spotify_episode_uri: 'spotify:episode:x' },
  ]
  const s = summarize(rows, 'week', periodRange('week', NOW))
  it('totals, uniques and daily buckets (music only, in range only)', () => {
    expect(s.ms).toBe(700_000)
    expect(s.plays).toBe(3)
    expect([s.artists, s.tracks]).toEqual([2, 2])
    expect(s.buckets).toEqual([300_000, 400_000, 0, 0, 0, 0, 0])
  })
  it('ranks artists by time, tracks by plays, and keeps a uri for queueing', () => {
    expect(s.topArtists.map(a => a.name)).toEqual(['B', 'A'])
    expect(s.topTracks[0]).toMatchObject({ name: 'One', sub: 'A', plays: 2, uri: 'spotify:track:One' })
    expect(s.topAlbums.map(a => a.name)).toEqual(['Bl', 'Al'])
  })
})

describe('comparePeriods', () => {
  it('compares to the same elapsed point of the previous period', () => {
    const rows = [
      row('2026-11-16T09:00:00Z', 'x', 'A', 300_000),   // this Mon
      row('2026-11-09T09:00:00Z', 'y', 'A', 100_000),   // last Mon — counts
      row('2026-11-13T09:00:00Z', 'z', 'A', 900_000),   // last Fri — after the cut, ignored
    ]
    const c = comparePeriods(rows, 'week', NOW)
    expect(c.previous.ms).toBe(100_000)
    expect(c.deltaMs).toBe(200)
    expect(c.deltaPlays).toBe(0)
  })
  it('has no delta with nothing to compare against', () => {
    expect(comparePeriods([row('2026-11-16T09:00:00Z', 'x')], 'week', NOW).deltaMs).toBeNull()
  })
})

describe('labels', () => {
  it('titles and bucket labels', () => {
    expect(periodTitle({ kind: 'year', start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) })).toBe('2026')
    expect(periodTitle({ kind: 'week', ...periodRange('week', NOW) })).toMatch(/16.*22/)
    expect(bucketLabels({ kind: 'week', buckets: new Array(7).fill(0) })).toHaveLength(7)
    expect(bucketLabels({ kind: 'month', buckets: new Array(30).fill(0) })[6]).toBe('7')
  })
})
