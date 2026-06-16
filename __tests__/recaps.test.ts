import { createAccumulator, addRows, buildRecaps, finalize, type StreamRow } from '@/utils/wrapped'

// A play row helper (extended streaming-history shape).
const play = (ts: string, artist: string, track: string, album: string, ms = 200_000): StreamRow => ({
  ts,
  ms_played: ms,
  master_metadata_album_artist_name: artist,
  master_metadata_track_name: track,
  master_metadata_album_album_name: album,
  spotify_track_uri: `spotify:track:${track}`,
})

function build(rows: StreamRow[]) {
  const acc = createAccumulator()
  addRows(acc, rows)
  return { acc, recaps: buildRecaps(acc), stats: finalize(acc) }
}

describe('recaps', () => {
  it('buckets plays into year / season / month / week with top artists & tracks', () => {
    const { recaps } = build([
      play('2026-06-15T10:00:00Z', 'DECO*27', 'Ghost', 'A'),
      play('2026-06-16T10:00:00Z', 'DECO*27', 'Ghost', 'A'),     // Ghost ×2
      play('2026-06-16T11:00:00Z', 'HOYO-MiX', 'Aurora', 'B'),
      play('2026-01-09T10:00:00Z', 'Smiley', 'Iarta', 'C'),       // different month + season
    ])

    // Year 2026 holds everything.
    const y2026 = recaps.years.find(y => y.key === '2026')!
    expect(y2026.streams).toBe(4)
    expect(y2026.topTracks[0].name).toBe('Ghost')                 // most plays
    expect(y2026.topTracks[0].plays).toBe(2)

    // Two distinct months: 2026-06 and 2026-01.
    expect(recaps.months.map(m => m.key).sort()).toEqual(['2026-01', '2026-06'])
    const june = recaps.months.find(m => m.key === '2026-06')!
    expect(june.streams).toBe(3)
    expect(june.topArtists[0].name).toBe('DECO*27')               // 2 plays' worth of ms

    // Seasons: Summer 2026 (Jun) and Winter 2025 (Jan 2026 joins the Dec-2025 winter).
    expect(recaps.seasons.map(s => s.key).sort()).toEqual(['2025-Winter', '2026-Summer'])
    expect(recaps.seasons.find(s => s.key === '2026-Summer')!.label).toBe('Summer 2026')
  })

  it('caps rolling weeks/months to the most recent, newest first', () => {
    // 20 plays across 20 different months → months list capped to 14, newest first.
    const rows: StreamRow[] = []
    for (let m = 0; m < 20; m++) {
      const date = new Date(Date.UTC(2024, m, 10)).toISOString() // spans 2024→2025
      rows.push(play(date, 'X', `t${m}`, 'al'))
    }
    const { recaps } = build(rows)
    expect(recaps.months.length).toBe(14)
    // Newest first: first entry's key should be the latest month.
    const keys = recaps.months.map(m => m.key)
    expect(keys[0] > keys[keys.length - 1]).toBe(true)
  })
})
