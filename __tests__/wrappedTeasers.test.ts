import { wrappedTeasers, aggregateStreams, type StreamRow } from '@/utils/wrapped'

describe('wrappedTeasers', () => {
  it('returns [] when there is no history', () => {
    expect(wrappedTeasers(null)).toEqual([])
  })

  it('builds personalised lines from real stats', () => {
    const rows: StreamRow[] = [
      { ts: '2023-01-01T20:00:00Z', ms_played: 200000, master_metadata_track_name: 'DNA.',     master_metadata_album_artist_name: 'Kendrick Lamar', master_metadata_album_album_name: 'DAMN.', spotify_track_uri: 'spotify:track:1' },
      { ts: '2023-01-01T20:05:00Z', ms_played: 180000, master_metadata_track_name: 'DNA.',     master_metadata_album_artist_name: 'Kendrick Lamar', master_metadata_album_album_name: 'DAMN.', spotify_track_uri: 'spotify:track:1' },
      { ts: '2024-06-01T09:00:00Z', ms_played: 30000,  master_metadata_track_name: 'EARFQUAKE', master_metadata_album_artist_name: 'Tyler, The Creator', master_metadata_album_album_name: 'IGOR', spotify_track_uri: 'spotify:track:2', skipped: true },
    ]
    const lines = wrappedTeasers(aggregateStreams(rows))
    expect(lines.length).toBeGreaterThan(3)
    // Top artist by time should be Kendrick (380s vs 30s)
    expect(lines.some(l => l.includes('Kendrick Lamar'))).toBe(true)
    // Each line carries a leading glyph + double space
    expect(lines.every(l => /^\S+\s{2,}\S/.test(l))).toBe(true)
  })
})
