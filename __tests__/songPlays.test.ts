import { storage } from '@/utils/cache'
import { insertPlays, songPlays, onPlaysChanged, toT, fromT, _resetForTests } from '@/utils/playDb'
import type { StreamRow } from '@/utils/wrapped'

const row = (ts: string, uri: string, ms = 180_000, track = 'Love Taste', artist = 'Moe Shop'): StreamRow => ({
  ts, ms_played: ms, spotify_track_uri: uri,
  master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: 'Al',
})

beforeEach(() => { storage.clearAll(); _resetForTests() })

describe('songPlays', () => {
  it('counts one song across sources, with time, first/last and this week', () => {
    insertPlays([row('2024-03-01T10:00:00Z', 'spotify:track:a', 100_000), row('2026-11-20T10:00:00Z', 'spotify:track:a', 200_000)], 'recent')
    insertPlays([row('2026-11-22T10:00:00Z', 'spotify:track:a', 150_000), row('2026-11-22T11:00:00Z', 'spotify:track:b')], 'tracked')
    const s = songPlays('spotify:track:a', 'Love Taste', 'Moe Shop', toT('2026-11-21T00:00:00Z'))
    expect(s).toEqual({ plays: 3, ms: 450_000, firstT: toT('2024-03-01T10:00:00Z'), lastT: toT('2026-11-22T10:00:00Z'), thisWeek: 1 })
  })
  it('knows a song it has never seen', () => {
    expect(songPlays('spotify:track:zzz', 'X', 'Y', 0)).toEqual({ plays: 0, ms: 0, firstT: null, lastT: null, thisWeek: 0 })
  })
  it('tells listeners when plays change (screens re-count after a sync)', () => {
    const cb = jest.fn()
    const off = onPlaysChanged(cb)
    insertPlays([row('2026-11-22T10:00:00Z', 'spotify:track:a')], 'tracked')
    expect(cb).toHaveBeenCalled()
    off()
  })
})

import { playedOf } from '@/utils/playDb'
describe('playedOf', () => {
  it('counts distinct songs played since a time', () => {
    _resetForTests()
    const r2 = (uri: string, t: number): StreamRow => ({ ts: fromT(t), master_metadata_track_name: uri, master_metadata_album_artist_name: "A", master_metadata_album_album_name: null, spotify_track_uri: uri, ms_played: 1000 } as any)
    insertPlays([r2("spotify:track:a", 1000), r2("spotify:track:a", 5000), r2("spotify:track:b", 6000), r2("spotify:track:c", 100)], 'import')
    expect(playedOf(['spotify:track:a', 'spotify:track:b', 'spotify:track:c', 'spotify:track:z', ''], 2000)).toBe(2)
    expect(playedOf([], 0)).toBe(0)
  })
})
