import {
  appendToBuffer, bufferWatermark, normalizeRow, mergeRecaps,
} from '@/utils/recents'
import { createAccumulator, addRows, buildRecaps, type StreamRow } from '@/utils/wrapped'

const row = (ts: string, track: string, uri = `spotify:track:${track}`): StreamRow => ({
  ts, ms_played: 200_000,
  master_metadata_track_name: track,
  master_metadata_album_artist_name: 'A',
  master_metadata_album_album_name: 'Al',
  spotify_track_uri: uri,
})

describe('recents buffer', () => {
  it('appends, dedupes by ts+uri, and stays time-sorted', () => {
    const b1 = appendToBuffer([], [row('2026-06-01T00:00:00Z', 't1'), row('2026-06-03T00:00:00Z', 't3')])
    const b2 = appendToBuffer(b1, [row('2026-06-03T00:00:00Z', 't3'), row('2026-06-02T00:00:00Z', 't2')]) // t3 dup
    expect(b2.length).toBe(3)
    expect(b2.map(r => r.ts)).toEqual([
      '2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z', '2026-06-03T00:00:00Z',
    ])
  })

  it('watermark is the newest ts', () => {
    expect(bufferWatermark([row('2026-06-01T00:00:00Z', 'a'), row('2026-06-09T00:00:00Z', 'b')]))
      .toBe('2026-06-09T00:00:00Z')
    expect(bufferWatermark([])).toBeNull()
  })

  it('normalizes the legacy export shape onto `ts`', () => {
    const n = normalizeRow({ endTime: '2026-06-01 10:00', msPlayed: 1000, artistName: 'X', trackName: 'Y' })
    expect(n.ts).toBe('2026-06-01 10:00')
    expect(n.master_metadata_track_name).toBe('Y')
  })
})

describe('mergeRecaps', () => {
  const buildStored = (rows: StreamRow[]) => { const a = createAccumulator(); addRows(a, rows); return buildRecaps(a) }

  it('refreshes the current year from the live buffer, keeps past years from stored', () => {
    const curYear = String(new Date().getUTCFullYear())
    const stored = buildStored([
      row(`${curYear}-01-01T00:00:00Z`, 'old'),         // stale current-year (1 play)
      row('2020-01-01T00:00:00Z', 'past'),              // a past year
    ])
    const buffer = [
      row(`${curYear}-06-01T00:00:00Z`, 'a'),
      row(`${curYear}-06-02T00:00:00Z`, 'b'),
      row(`${curYear}-06-03T00:00:00Z`, 'c'),           // current year now 3 plays
    ]
    const merged = mergeRecaps(stored, buffer)!
    const cur = merged.years.find(y => y.key === curYear)!
    expect(cur.streams).toBe(3)                          // from the live buffer, not the stale 1
    expect(merged.years.find(y => y.key === '2020')!.streams).toBe(1) // past untouched
  })

  it('falls back to stored when the buffer is empty, and to live when there is no import', () => {
    const stored = buildStored([row('2024-01-01T00:00:00Z', 'x')])
    expect(mergeRecaps(stored, [])).toBe(stored)
    expect(mergeRecaps(null, [])).toBeNull()
    expect(mergeRecaps(null, [row('2024-01-01T00:00:00Z', 'x')])).not.toBeNull()
  })
})
