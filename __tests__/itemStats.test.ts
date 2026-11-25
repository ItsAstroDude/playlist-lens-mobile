import { storage } from '@/utils/cache'
import { insertPlays, _resetForTests } from '@/utils/playDb'
import { itemStats, hasPlays, seriesFromDays, longestRunOf, itemStatsAsync, peekItemStats, roundLinkList, _clearItemCache } from '@/utils/itemStats'
import type { StreamRow } from '@/utils/wrapped'

const row = (ts: string, track: string, artist: string, ms = 180_000, album: string | null = 'Al', uri = `spotify:track:${track}`): StreamRow => ({
  ts, ms_played: ms, spotify_track_uri: uri,
  master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: album,
})

const UTC = 0
const DAY = 86_400
const dayOf = (iso: string) => Math.floor(Date.parse(iso) / 1000 / DAY)

beforeEach(() => { storage.clearAll(); _resetForTests(); _clearItemCache() })

describe('itemStats — artist', () => {
  beforeEach(() => {
    insertPlays([
      row('2024-03-01T10:00:00Z', 'First', 'A', 100_000, 'Debut'),     // first ever with A
      row('2024-03-02T10:00:00Z', 'Hit', 'A', 200_000, 'Debut'),
      row('2024-03-03T10:00:00Z', 'Hit', 'A', 200_000, 'Debut'),
      row('2024-03-03T22:00:00Z', 'Hit', 'A', 200_000, 'Debut'),
      row('2024-05-10T08:00:00Z', 'Later', 'A', 300_000, 'Second'),
      row('2024-03-02T11:00:00Z', 'Other', 'B', 2_000_000),            // B: more time than A
      row('2024-04-01T11:00:00Z', 'Small', 'C', 10_000),
    ], 'import')
  })

  it('totals, first listen, last play and days', () => {
    const s = itemStats({ kind: 'artist', artist: 'A' }, UTC)
    expect(s.plays).toBe(5)
    expect(s.ms).toBe(1_000_000)
    expect(s.days).toBe(4)
    expect(s.first).toMatchObject({ track: 'First', album: 'Debut', t: Date.parse('2024-03-01T10:00:00Z') / 1000 })
    expect(s.last).toBe(Date.parse('2024-05-10T08:00:00Z') / 1000)
    expect(s.trackCount).toBe(3)
  })

  it('ranks by lifetime time and knows its share', () => {
    const s = itemStats({ kind: 'artist', artist: 'A' }, UTC)
    expect(s.rank).toEqual({ n: 2, of: 3 })
    expect(s.share).toBeCloseTo(1_000_000 / 3_010_000)
    expect(itemStats({ kind: 'artist', artist: 'B' }, UTC).rank).toEqual({ n: 1, of: 3 })
  })

  it('top songs by plays, albums by time', () => {
    const s = itemStats({ kind: 'artist', artist: 'A' }, UTC)
    // a tie on plays: more time first
    expect(s.topTracks.map(t => [t.name, t.plays])).toEqual([['Hit', 3], ['Later', 1], ['First', 1]])
    expect(s.topTracks[0]).toMatchObject({ uri: 'spotify:track:Hit', sub: 'Debut' })
    expect(s.topAlbums.map(a => [a.name, a.ms])).toEqual([['Debut', 700_000], ['Second', 300_000]])
  })

  it('longest run, biggest day, clock and weekdays', () => {
    const s = itemStats({ kind: 'artist', artist: 'A' }, UTC)
    expect(s.longestRun).toEqual({ length: 3, startDay: dayOf('2024-03-01'), endDay: dayOf('2024-03-03') })
    expect(s.biggestDay).toEqual({ day: dayOf('2024-03-03'), plays: 2, ms: 400_000 })
    expect(s.clock[10]).toBe(500_000)
    expect(s.clock[22]).toBe(200_000)
    // 1 Mar and 10 May 2024 were Fridays
    expect(s.weekdays[4]).toBe(400_000)
  })

  it('local time moves plays across midnight', () => {
    // 22:00 UTC on 3 Mar is 00:00 on 4 Mar at UTC+2: four days in a row, and the
    // biggest day is now the 2nd/3rd at 200k each — ties go to the later day.
    const s = itemStats({ kind: 'artist', artist: 'A' }, 2 * 3600)
    expect(s.longestRun?.length).toBe(4)
    expect(s.clock[0]).toBe(200_000)
  })

  it('over time: months from the first play to the last, gaps included', () => {
    const s = itemStats({ kind: 'artist', artist: 'A' }, UTC)
    expect(s.series?.unit).toBe('month')
    expect(s.series?.labels).toEqual(['Mar 2024', 'Apr 2024', 'May 2024'])
    expect(s.series?.ms).toEqual([700_000, 0, 300_000])
    expect(s.series?.peak).toBe(0)
  })

  it('an unknown artist is empty, not an error', () => {
    const s = itemStats({ kind: 'artist', artist: 'Nobody' }, UTC)
    expect(s.plays).toBe(0)
    expect(s.series).toBeNull()
    expect(hasPlays({ kind: 'artist', artist: 'Nobody' })).toBe(false)
    expect(hasPlays({ kind: 'artist', artist: 'A' })).toBe(true)
  })
})

describe('itemStats — song', () => {
  beforeEach(() => {
    insertPlays([
      row('2024-01-01T10:00:00Z', 'Intro', 'A', 60_000, 'One'),
      row('2024-01-01T11:00:00Z', 'Intro', 'A', 60_000, 'One'),
      row('2024-01-01T12:00:00Z', 'Intro', 'A', 60_000, 'One'),
      row('2024-02-01T10:00:00Z', 'Intro', 'A', 60_000, 'Deluxe', 'spotify:track:IntroDeluxe'),
      row('2024-01-05T10:00:00Z', 'Intro', 'B', 60_000, 'Other'),         // same title, other artist
      row('2024-01-05T11:00:00Z', 'Big', 'B', 600_000, 'Other'),
      row('2024-01-06T11:00:00Z', 'Big', 'B', 600_000, 'Other'),
      row('2024-01-07T11:00:00Z', 'Big', 'B', 600_000, 'Other'),
      row('2024-01-08T11:00:00Z', 'Big', 'B', 600_000, 'Other'),
    ], 'import')
  })

  it('matches title and artist together', () => {
    const s = itemStats({ kind: 'track', track: 'Intro', artist: 'A' }, UTC)
    expect(s.plays).toBe(4)
    expect(s.uri).toBe('spotify:track:Intro')        // the URI it's played from most
    expect(s.album).toBe('One')
    expect(itemStats({ kind: 'track', track: 'Intro', artist: 'B' }, UTC).plays).toBe(1)
  })

  it('biggest day is the most plays in a day; rank is by plays', () => {
    const s = itemStats({ kind: 'track', track: 'Intro', artist: 'A' }, UTC)
    expect(s.biggestDay).toEqual({ day: dayOf('2024-01-01'), plays: 3, ms: 180_000 })
    // Big also has 4 plays but more time, so it ranks above.
    expect(s.rank).toEqual({ n: 2, of: 3 })
  })
})

describe('itemStats — rank ties', () => {
  it('a tie on plays goes to the song with more time', () => {
    insertPlays([
      row('2024-01-01T10:00:00Z', 'X', 'A', 60_000),
      row('2024-01-02T10:00:00Z', 'X', 'A', 60_000),
      row('2024-01-01T11:00:00Z', 'Y', 'B', 600_000),
      row('2024-01-02T11:00:00Z', 'Y', 'B', 600_000),
    ], 'import')
    expect(itemStats({ kind: 'track', track: 'Y', artist: 'B' }, UTC).rank).toEqual({ n: 1, of: 2 })
    expect(itemStats({ kind: 'track', track: 'X', artist: 'A' }, UTC).rank).toEqual({ n: 2, of: 2 })
  })
})

describe('seriesFromDays', () => {
  it('switches to years past three years of months', () => {
    const s = seriesFromDays([
      { d: dayOf('2019-06-01'), ms: 10 },
      { d: dayOf('2021-01-01'), ms: 30 },
      { d: dayOf('2023-12-31'), ms: 20 },
    ])!
    expect(s.unit).toBe('year')
    expect(s.labels).toEqual(['2019', '2020', '2021', '2022', '2023'])
    expect(s.ms).toEqual([10, 0, 30, 0, 20])
    expect(s.peak).toBe(2)
  })
  it('a single month is one bar', () => {
    expect(seriesFromDays([{ d: dayOf('2024-02-29'), ms: 5 }])).toEqual({ unit: 'month', ms: [5], labels: ['Feb 2024'], peak: 0 })
  })
})

describe('longestRunOf', () => {
  it('finds the longest run; ties go to the later one', () => {
    expect(longestRunOf([5, 1, 2, 9, 10])).toEqual({ length: 2, startDay: 9, endDay: 10 })
    expect(longestRunOf([3, 4, 5, 7])).toEqual({ length: 3, startDay: 3, endDay: 5 })
    expect(longestRunOf([])).toBeNull()
  })
})

describe('itemStatsAsync', () => {
  it('answers off the UI thread and caches until a play changes', async () => {
    insertPlays([row('2024-01-01T10:00:00Z', 'X', 'A')], 'import')
    const a = itemStatsAsync({ kind: 'artist', artist: 'A' }, UTC)
    expect(itemStatsAsync({ kind: 'artist', artist: 'A' }, UTC)).toBe(a)
    expect((await a).plays).toBe(1)
    expect(peekItemStats({ kind: 'artist', artist: 'A' }, UTC)?.plays).toBe(1)
    insertPlays([row('2024-01-02T10:00:00Z', 'X', 'A')], 'tracked')
    const b = itemStatsAsync({ kind: 'artist', artist: 'A' }, UTC)
    expect(b).not.toBe(a)
    expect(peekItemStats({ kind: 'artist', artist: 'A' }, UTC)).toBeNull()   // stale until the new answer lands
    expect((await b).plays).toBe(2)
  })
})

describe('roundLinkList', () => {
  it('keeps order, drops repeats and songs without an artist, caps the list', () => {
    const list = roundLinkList([
      { kind: 'track', name: 'X', artist: 'A' },
      { kind: 'artist', name: 'A' },
      { kind: 'track', name: 'X', artist: 'A' },
      { kind: 'track', name: 'X', artist: 'B' },
      { kind: 'track', name: 'Y' },
      { kind: 'artist', name: 'C' },
    ], 3)
    expect(list).toEqual([
      { kind: 'track', name: 'X', artist: 'A' },
      { kind: 'artist', name: 'A' },
      { kind: 'track', name: 'X', artist: 'B' },
    ])
  })
})
