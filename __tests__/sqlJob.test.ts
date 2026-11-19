import { storage } from '@/utils/cache'
import { insertPlays, _resetForTests, db } from '@/utils/playDb'
import { all, first, exec, runSync, runAsync, cachedAsync, peekCached, clearStatCache, _clearJobCache, type Job } from '@/utils/sqlJob'
import { periodStatsJob, allTimeAsync, allTimeStats } from '@/utils/stats'
import type { StreamRow } from '@/utils/wrapped'

const row = (ts: string, track: string, artist: string, ms = 180_000): StreamRow => ({
  ts, ms_played: ms, spotify_track_uri: `spotify:track:${track}`,
  master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: 'Al',
})
const NOW = new Date(Date.UTC(2026, 10, 18, 12))

beforeEach(() => { storage.clearAll(); _resetForTests(); _clearJobCache() })

describe('jobs', () => {
  it('the async runner gives the same answer as the sync one', async () => {
    insertPlays([row('2026-11-16T10:00:00Z', 'a', 'A'), row('2025-01-01T10:00:00Z', 'b', 'B')], 'recent')
    const sync = runSync(periodStatsJob('all', { now: NOW, offsetSec: 0 }))
    const async_ = await runAsync(periodStatsJob('all', { now: NOW, offsetSec: 0 }))
    expect(async_).toEqual(sync)
  })

  it('a failing query reaches the job, so its finally can clean up', () => {
    function* job(): Job<string> {
      yield exec('CREATE TABLE temp.scratch (x)')
      try {
        yield all('SELECT nope FROM nowhere')
        return 'unreachable'
      } finally {
        yield exec('DROP TABLE IF EXISTS temp.scratch')
      }
    }
    expect(() => runSync(job())).toThrow()
    expect(runSync((function* (): Job<unknown> { return yield first(`SELECT name FROM temp.sqlite_master WHERE name = 'scratch'`) })())).toBeNull()
  })
})

describe('cachedAsync', () => {
  it('reuses the answer until a play changes, and keeps the last one for next time', async () => {
    insertPlays([row('2026-11-16T10:00:00Z', 'a', 'A')], 'recent')
    let runs = 0
    const make = function* (): Job<number> { runs++; const r: { n: number } = yield first('SELECT COUNT(*) AS n FROM plays'); return r.n }
    expect(await cachedAsync('count', '', make)).toBe(1)
    expect(await cachedAsync('count', '', make)).toBe(1)
    expect(runs).toBe(1)
    insertPlays([row('2026-11-17T10:00:00Z', 'b', 'B')], 'recent')
    expect(await cachedAsync('count', '', make)).toBe(2)
    expect(runs).toBe(2)
    // a fresh session still sees the saved answer instantly
    _clearJobCache()
    expect(peekCached('count')).toBe(2)
    clearStatCache()
    expect(peekCached('count')).toBeUndefined()
  })

  it('all time async matches all time sync', async () => {
    insertPlays([row('2026-11-16T10:00:00Z', 'a', 'A'), row('2024-02-01T10:00:00Z', 'b', 'B', 10_000)], 'recent')
    const a = await allTimeAsync(null, NOW)
    const s = allTimeStats(null, NOW)
    expect({ ...a, generatedAt: '' }).toEqual({ ...s, generatedAt: '' })
    expect(db()).toBeTruthy()
  })
})
