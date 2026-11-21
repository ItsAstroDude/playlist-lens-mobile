import { storage } from '@/utils/cache'
import { insertPlays, _resetForTests } from '@/utils/playDb'
import { newToYou, streaks, milestones, milestoneTitle, onThisDay } from '@/utils/highlights'
import { periodRange } from '@/utils/stats'
import type { StreamRow } from '@/utils/wrapped'

const row = (ts: string, track: string, artist: string, ms = 180_000): StreamRow => ({
  ts, ms_played: ms, spotify_track_uri: `spotify:track:${track}`,
  master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: 'Al',
})
const UTC = 0
const NOW = new Date(Date.UTC(2026, 10, 18, 12))           // Wed 18 Nov 2026
const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000

beforeEach(() => { storage.clearAll(); _resetForTests() })

describe('new to you', () => {
  it('counts artists and songs first heard in the period', () => {
    insertPlays([
      row('2026-06-01T10:00:00Z', 'Old Song', 'Old Artist'),
      row('2026-11-16T10:00:00Z', 'Old Song', 'Old Artist'),     // not new
      row('2026-11-16T11:00:00Z', 'New Song', 'Old Artist'),     // new song, old artist
      row('2026-11-17T10:00:00Z', 'Fresh', 'Newcomer', 300_000),
      row('2026-11-17T11:00:00Z', 'Fresh', 'Newcomer', 300_000),
      row('2026-11-18T10:00:00Z', 'Other', 'Second', 100_000),
    ], 'recent')
    const { start, end } = periodRange('week', NOW, UTC)
    const n = newToYou(start, end)
    expect(n.trusted).toBe(true)
    expect(n.artists).toBe(2)
    expect(n.tracks).toBe(3)
    expect(n.topArtists.map(a => [a.name, a.ms, a.plays])).toEqual([['Newcomer', 600_000, 2], ['Second', 100_000, 1]])
  })

  it('is not trusted when the history barely predates the period', () => {
    insertPlays([row('2026-11-10T10:00:00Z', 'A', 'A'), row('2026-11-17T10:00:00Z', 'B', 'B')], 'recent')
    const { start, end } = periodRange('week', NOW, UTC)
    expect(newToYou(start, end).trusted).toBe(false)
  })
})

describe('streaks', () => {
  it('current and longest day streaks, and artist runs', () => {
    insertPlays([
      // a 4-day run in March, all Radiohead
      ...['01', '02', '03', '04'].map(d => row(`2026-03-${d}T10:00:00Z`, `r${d}`, 'Radiohead')),
      // a current 3-day run ending today, Björk every day + Caribou once
      row('2026-11-16T10:00:00Z', 'b1', 'Björk'), row('2026-11-17T10:00:00Z', 'b2', 'Björk'),
      row('2026-11-18T09:00:00Z', 'b3', 'Björk'), row('2026-11-18T10:00:00Z', 'c1', 'Caribou'),
    ], 'recent')
    const s = streaks(NOW, UTC)
    expect(s.current).toBe(3)
    expect(s.longest).toEqual({ length: 4, startDay: day('2026-03-01'), endDay: day('2026-03-04') })
    expect(s.artistBest).toMatchObject({ artist: 'Radiohead', length: 4 })
    expect(s.artistNow).toMatchObject({ artist: 'Björk', length: 3, endDay: day('2026-11-18') })
  })

  it('a streak that ended yesterday still counts until today is over; older ones do not', () => {
    insertPlays([row('2026-11-16T10:00:00Z', 'a', 'A'), row('2026-11-17T10:00:00Z', 'b', 'A')], 'recent')
    expect(streaks(NOW, UTC).current).toBe(2)
    expect(streaks(new Date(Date.UTC(2026, 10, 20, 12)), UTC).current).toBe(0)
  })

  it('empty → zeros', () => {
    expect(streaks(NOW, UTC)).toEqual({ current: 0, longest: null, artistBest: null, artistNow: null })
  })
})

describe('milestones', () => {
  it('finds the 100th play, the 10th artist and the 10th hour, with what was playing', () => {
    const rows: StreamRow[] = []
    // 120 plays of 6 minutes = 12 hours; a new artist every 10 plays → 12 artists
    for (let i = 0; i < 120; i++) {
      const ts = new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString()
      rows.push(row(ts, `t${i}`, `artist${Math.floor(i / 10)}`, 360_000))
    }
    insertPlays(rows, 'recent')
    const { reached, next } = milestones()
    const by = (k: string, n: number) => reached.find(m => m.kind === k && m.n === n)
    expect(by('plays', 100)).toMatchObject({ track: 't99' })
    expect(by('artists', 10)).toMatchObject({ artist: 'artist9', track: 't90' })
    expect(by('hours', 10)).toMatchObject({ track: 't99' })          // 100 × 6 min = 10 h
    expect(reached.map(m => m.t)).toEqual([...reached.map(m => m.t)].sort((a, b) => b - a))
    expect(next.find(n => n.kind === 'plays')).toMatchObject({ n: 500, have: 120 })
    expect(next.find(n => n.kind === 'artists')).toMatchObject({ n: 50, have: 12 })
    expect(next.find(n => n.kind === 'hours')?.progress).toBeCloseTo(2 / 40)
  })

  it('titles', () => {
    expect(milestoneTitle({ kind: 'plays', n: 10_000 })).toBe('10,000th play')
    expect(milestoneTitle({ kind: 'artists', n: 1 })).toBe('1st artist')
    expect(milestoneTitle({ kind: 'artists', n: 2_500 })).toBe('2,500th artist')
    expect(milestoneTitle({ kind: 'hours', n: 1_000 })).toBe('1,000 hours')
  })

  it('empty → nothing', () => {
    expect(milestones()).toEqual({ reached: [], next: [] })
  })
})

describe('on this day', () => {
  it('today’s date in earlier years, top songs first, not this year', () => {
    insertPlays([
      row('2024-11-18T10:00:00Z', 'Hit', 'A'), row('2024-11-18T11:00:00Z', 'Hit', 'A'), row('2024-11-18T12:00:00Z', 'Side', 'B'),
      row('2023-11-18T10:00:00Z', 'Older', 'C'),
      row('2024-11-17T10:00:00Z', 'Wrong day', 'D'),
      row('2026-11-18T10:00:00Z', 'Today', 'E'),
    ], 'recent')
    const y = onThisDay(NOW, UTC)
    expect(y.map(x => x.year)).toEqual([2024, 2023])
    expect(y[0]).toMatchObject({ plays: 3 })
    expect(y[0].tracks.map(t => [t.name, t.plays])).toEqual([['Hit', 2], ['Side', 1]])
    expect(y[0].tracks[0].uri).toBe('spotify:track:Hit')
  })

  it('uses the local date', () => {
    insertPlays([row('2024-11-17T23:30:00Z', 'Late', 'A')], 'recent')   // 18 Nov 01:30 in UTC+2
    expect(onThisDay(NOW, UTC)).toEqual([])
    expect(onThisDay(NOW, 2 * 3600).map(x => x.year)).toEqual([2024])
  })
})
