/**
 * Tests for utils/wrapped.ts — lifetime listening-history aggregation.
 * Pure functions, no native modules. Validates the parser design against the
 * real Extended Streaming History shape.
 */
import {
  aggregateStreams, createAccumulator, addRows, finalize,
  fmtHours, fmtMinutesShort, type StreamRow,
} from '../utils/wrapped'

const MIN = 60_000

function row(over: Partial<StreamRow>): StreamRow {
  return {
    ts: '2024-01-01T12:00:00Z',
    ms_played: 3 * MIN,
    master_metadata_track_name: 'Song',
    master_metadata_album_artist_name: 'Artist',
    master_metadata_album_album_name: 'Album',
    spotify_track_uri: 'spotify:track:abc',
    ...over,
  }
}

describe('aggregateStreams — extended format', () => {
  it('sums total ms and counts music streams', () => {
    const s = aggregateStreams([
      row({ ms_played: 3 * MIN }),
      row({ ms_played: 2 * MIN }),
    ])
    expect(s.totalMs).toBe(5 * MIN)
    expect(s.totalStreams).toBe(2)
  })

  it('ranks top artists by total ms (time), not play count', () => {
    const s = aggregateStreams([
      // B: 2 plays, short → 4 min total
      row({ master_metadata_album_artist_name: 'B', master_metadata_track_name: 't1', ms_played: 2 * MIN }),
      row({ master_metadata_album_artist_name: 'B', master_metadata_track_name: 't1', ms_played: 2 * MIN }),
      // A: 1 play, long → 10 min total
      row({ master_metadata_album_artist_name: 'A', master_metadata_track_name: 't2', ms_played: 10 * MIN }),
    ])
    expect(s.topArtists[0].name).toBe('A')      // more time
    expect(s.topArtists[0].ms).toBe(10 * MIN)
    expect(s.topArtists[1].name).toBe('B')
    expect(s.topArtists[1].plays).toBe(2)
  })

  it('ranks top tracks by play count', () => {
    const s = aggregateStreams([
      row({ master_metadata_track_name: 'Hit', master_metadata_album_artist_name: 'X' }),
      row({ master_metadata_track_name: 'Hit', master_metadata_album_artist_name: 'X' }),
      row({ master_metadata_track_name: 'Hit', master_metadata_album_artist_name: 'X' }),
      row({ master_metadata_track_name: 'Deep cut', master_metadata_album_artist_name: 'X' }),
    ])
    expect(s.topTracks[0].name).toBe('Hit')
    expect(s.topTracks[0].plays).toBe(3)
    expect(s.uniqueTracks).toBe(2)
  })

  it('keeps album names with spaces intact', () => {
    const s = aggregateStreams([
      row({ master_metadata_album_album_name: '(how to live) AS GHOSTS', master_metadata_album_artist_name: '10 Years' }),
    ])
    expect(s.topAlbums[0].name).toBe('(how to live) AS GHOSTS')
  })

  it('counts real listens (>=30s) separately from streams and skips', () => {
    const s = aggregateStreams([
      row({ ms_played: 5_000,  skipped: true }),  // skip, < 30s
      row({ ms_played: 45_000 }),                 // real listen
      row({ ms_played: 60_000 }),                 // real listen
    ])
    expect(s.totalStreams).toBe(3)
    expect(s.realListens).toBe(2)
    expect(s.skipCount).toBe(1)
  })

  it('separates podcasts from music', () => {
    const s = aggregateStreams([
      row({}),
      { ts: '2024-02-02T08:00:00Z', ms_played: 10 * MIN, spotify_episode_uri: 'spotify:episode:xyz', spotify_track_uri: null, master_metadata_track_name: null },
    ])
    expect(s.totalStreams).toBe(1)       // only the music row
    expect(s.podcastStreams).toBe(1)
    expect(s.totalMs).toBe(13 * MIN)     // total time includes both
  })

  it('buckets by hour, weekday and year', () => {
    const s = aggregateStreams([
      row({ ts: '2023-06-01T09:00:00Z', ms_played: 4 * MIN }), // 09:00 UTC, 2023
      row({ ts: '2024-06-01T09:00:00Z', ms_played: 6 * MIN }), // 09:00 UTC, 2024
    ])
    expect(s.clock[9]).toBe(10 * MIN)
    expect(s.byYear.map(y => y.year)).toEqual([2023, 2024])
    expect(s.byYear[1].ms).toBe(6 * MIN)
  })

  it('tracks first/last timestamps', () => {
    const s = aggregateStreams([
      row({ ts: '2025-05-05T00:00:00Z' }),
      row({ ts: '2023-01-01T00:00:00Z' }),
      row({ ts: '2024-09-09T00:00:00Z' }),
    ])
    expect(s.firstTs).toBe('2023-01-01T00:00:00Z')
    expect(s.lastTs).toBe('2025-05-05T00:00:00Z')
  })
})

describe('aggregateStreams — legacy account-data format', () => {
  it('reads endTime / msPlayed / artistName / trackName', () => {
    const s = aggregateStreams([
      { endTime: '2022-03-03 10:00', msPlayed: 3 * MIN, artistName: 'Legacy', trackName: 'Old' } as StreamRow,
    ])
    expect(s.totalStreams).toBe(1)
    expect(s.totalMs).toBe(3 * MIN)
    expect(s.topArtists[0].name).toBe('Legacy')
  })
})

describe('incremental accumulation', () => {
  it('matches one-shot aggregation when fed in chunks', () => {
    const rows = [
      row({ master_metadata_album_artist_name: 'A', ms_played: 5 * MIN }),
      row({ master_metadata_album_artist_name: 'B', ms_played: 3 * MIN }),
      row({ master_metadata_album_artist_name: 'A', ms_played: 2 * MIN }),
    ]
    const oneShot = aggregateStreams(rows)
    const acc = createAccumulator()
    addRows(acc, rows.slice(0, 1))
    addRows(acc, rows.slice(1))
    const chunked = finalize(acc)
    expect(chunked.totalMs).toBe(oneShot.totalMs)
    expect(chunked.topArtists[0]).toEqual(oneShot.topArtists[0])
  })
})

describe('formatting', () => {
  it('fmtHours rounds to whole hours, minutes under 1h', () => {
    expect(fmtHours(3 * 3_600_000)).toBe('3h')
    expect(fmtHours(30 * 60_000)).toBe('30m')
  })
  it('fmtMinutesShort splits h/m', () => {
    expect(fmtMinutesShort(90 * 60_000)).toBe('1h 30m')
    expect(fmtMinutesShort(20 * 60_000)).toBe('20m')
  })
})
