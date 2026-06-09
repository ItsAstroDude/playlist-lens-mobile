import { createAccumulator, addRows, buildTrackIndex, type StreamRow } from '@/utils/wrapped'

const row = (track: string, artist: string, ms: number, uri?: string): StreamRow => ({
  ts: '2023-01-01T12:00:00Z',
  ms_played: ms,
  master_metadata_track_name: track,
  master_metadata_album_artist_name: artist,
  spotify_track_uri: uri ?? null,
})

describe('buildTrackIndex', () => {
  it('keeps EVERY unique track (not just the top 25) with full play counts', () => {
    const rows: StreamRow[] = []
    for (let i = 0; i < 40; i++) rows.push(row(`Song ${i}`, 'Artist', 40000, `spotify:track:${i}`))
    // play Song 0 three times total
    rows.push(row('Song 0', 'Artist', 40000, 'spotify:track:0'))
    rows.push(row('Song 0', 'Artist', 40000, 'spotify:track:0'))

    const acc = createAccumulator()
    addRows(acc, rows)
    const index = buildTrackIndex(acc)

    expect(index).toHaveLength(40)               // far past top-25
    expect(index[0].name).toBe('Song 0')         // sorted by plays
    expect(index[0].plays).toBe(3)
    expect(index[0].uri).toBe('spotify:track:0') // uri captured for matching
  })

  it('backfills uri from a later row if the first lacked one', () => {
    const acc = createAccumulator()
    addRows(acc, [
      row('Track', 'A', 40000, undefined),
      row('Track', 'A', 40000, 'spotify:track:xyz'),
    ])
    const index = buildTrackIndex(acc)
    expect(index[0].plays).toBe(2)
    expect(index[0].uri).toBe('spotify:track:xyz')
  })
})
