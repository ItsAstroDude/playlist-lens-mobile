import { storage } from '@/utils/cache'
import {
  insertPlays, playsSince, windowPlays, windowStartT, playCounts, newestTs, importMaxT,
  beginImport, addImportChunk, finishImport, clearImport, clearAllPlays, toT, fromT, _resetForTests, db,
} from '@/utils/playDb'
import type { StreamRow } from '@/utils/wrapped'

const row = (ts: string, uri: string, ms = 180_000, artist = 'A', track = 'T'): StreamRow => ({
  ts, ms_played: ms, spotify_track_uri: uri,
  master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: 'Al',
})

beforeEach(() => { storage.clearAll(); _resetForTests() })

describe('time', () => {
  it('parses extended and legacy export timestamps as UTC seconds', () => {
    expect(toT('2024-03-01T12:00:00Z')).toBe(Date.UTC(2024, 2, 1, 12) / 1000)
    expect(toT('2024-03-01 12:00')).toBe(Date.UTC(2024, 2, 1, 12) / 1000)
    expect(toT('2024-03-01T12:00:00.987Z')).toBe(Date.UTC(2024, 2, 1, 12) / 1000)
    expect(toT('nope')).toBeNaN()
    expect(fromT(Date.UTC(2024, 2, 1, 12) / 1000)).toBe('2024-03-01T12:00:00Z')
  })
})

describe('insert + read', () => {
  it('round-trips rows in the export shape, oldest first', () => {
    insertPlays([row('2024-03-02T10:00:00Z', 'u:2'), row('2024-03-01T10:00:00Z', 'u:1')], 'recent')
    const out = playsSince(0)
    expect(out.map(r => r.spotify_track_uri)).toEqual(['u:1', 'u:2'])
    expect(out[0]).toMatchObject({ ts: '2024-03-01T10:00:00Z', ms_played: 180_000, master_metadata_album_artist_name: 'A' })
  })

  it('dedupes the same play from two sources (same second, same track)', () => {
    insertPlays([row('2024-03-01T10:00:00Z', 'u:1')], 'recent')
    insertPlays([row('2024-03-01T10:00:00.412Z', 'u:1')], 'tracked')
    expect(playCounts().total).toBe(1)
  })

  it('replace updates a tracked play’s listen time', () => {
    insertPlays([row('2024-03-01T10:00:00Z', 'u:1', 200_000)], 'tracked')
    insertPlays([row('2024-03-01T10:00:00Z', 'u:1', 90_000)], 'tracked', { replace: true })
    expect(playsSince(0)[0].ms_played).toBe(90_000)
  })

  it('skips podcasts and unparseable rows', () => {
    const ep: StreamRow = { ts: '2024-03-01T10:00:00Z', ms_played: 1, spotify_episode_uri: 'e:1' }
    expect(insertPlays([ep, { ts: 'bad' }, row('2024-03-01T11:00:00Z', 'u:1')], 'recent')).toBe(1)
  })

  it('reports the newest play as the recently-played watermark', () => {
    expect(newestTs()).toBeNull()
    insertPlays([row('2024-03-01T10:00:00Z', 'u:1'), row('2024-05-01T10:00:00Z', 'u:2')], 'recent')
    expect(newestTs()).toBe('2024-05-01T10:00:00Z')
  })
})

describe('import overlap rule', () => {
  it('the import wins its range: replaces older tracked plays, blocks new ones there', () => {
    insertPlays([row('2024-01-01T10:00:00Z', 'u:t1'), row('2024-06-01T10:00:00Z', 'u:t2')], 'tracked')
    beginImport()
    addImportChunk([row('2023-12-31T10:00:00Z', 'u:i1'), row('2024-03-01T10:00:00Z', 'u:i2')])
    finishImport()
    expect(importMaxT()).toBe(toT('2024-03-01T10:00:00Z'))
    // t1 (inside the import's range) is gone; t2 (after it) stays
    expect(playsSince(0).map(r => r.spotify_track_uri)).toEqual(['u:i1', 'u:i2', 'u:t2'])
    // a late tracked play inside the range is ignored
    expect(insertPlays([row('2024-02-01T10:00:00Z', 'u:late')], 'tracked')).toBe(0)
    const c = playCounts()
    expect(c).toMatchObject({ total: 3, import: 2, tracked: 1 })
  })

  it('a re-import replaces the previous import', () => {
    beginImport(); addImportChunk([row('2023-01-01T10:00:00Z', 'u:old')]); finishImport()
    beginImport(); addImportChunk([row('2023-02-01T10:00:00Z', 'u:new')]); finishImport()
    expect(playsSince(0).map(r => r.spotify_track_uri)).toEqual(['u:new'])
  })

  it('clearing the import keeps tracked plays and lifts the cutoff', () => {
    beginImport(); addImportChunk([row('2024-03-01T10:00:00Z', 'u:i')]); finishImport()
    insertPlays([row('2024-04-01T10:00:00Z', 'u:t')], 'tracked')
    clearImport()
    expect(importMaxT()).toBeNull()
    expect(insertPlays([row('2024-02-01T10:00:00Z', 'u:early')], 'tracked')).toBe(1)
    expect(playCounts()).toMatchObject({ import: 0, tracked: 2 })
    clearAllPlays()
    expect(playCounts().total).toBe(0)
  })
})

describe('window', () => {
  it('covers this year and last, and at least 400 days', () => {
    const now = new Date(Date.UTC(2026, 10, 18))
    expect(windowStartT(now)).toBe(Date.UTC(2025, 0, 1) / 1000)
    const jan = new Date(Date.UTC(2026, 0, 5))
    expect(windowStartT(jan)).toBe(Math.floor(jan.getTime() / 1000) - 400 * 86_400)
    insertPlays([row('2024-12-31T10:00:00Z', 'u:old'), row('2025-01-02T10:00:00Z', 'u:in')], 'recent')
    expect(windowPlays(now).map(r => r.spotify_track_uri)).toEqual(['u:in'])
  })
})

describe('migration from the MMKV buffer', () => {
  it('copies the old buffer in once, as legacy rows', () => {
    storage.set('wrapped_recent', JSON.stringify([row('2024-03-01T10:00:00Z', 'u:1'), row('2024-03-02T10:00:00Z', 'u:2')]))
    db()
    expect(playCounts()).toMatchObject({ total: 2, legacy: 2 })
    // re-opening the same database doesn't copy again
    _resetForTests()
  })
})

describe('import staging', () => {
  it('keeps the previous import until the new one finishes; abort discards it', () => {
    const { abortImport } = require('@/utils/playDb')
    beginImport(); addImportChunk([row('2023-01-01T10:00:00Z', 'u:old')]); finishImport()
    beginImport(); addImportChunk([row('2023-02-01T10:00:00Z', 'u:new')])
    expect(playsSince(0).map(r => r.spotify_track_uri)).toEqual(['u:old'])   // not swapped yet
    abortImport()
    expect(playsSince(0).map(r => r.spotify_track_uri)).toEqual(['u:old'])
  })

  it('an empty import keeps the previous one', () => {
    beginImport(); addImportChunk([row('2023-01-01T10:00:00Z', 'u:old')]); finishImport()
    beginImport()
    expect(finishImport()).toBe(0)
    expect(playCounts().import).toBe(1)
  })
})

describe('weekly facts queries', () => {
  it('counts artists new since a time, and the days with plays', () => {
    const { newArtistsSince, activeDays } = require('@/utils/playDb')
    insertPlays([
      row('2026-11-01T10:00:00Z', 'u:1', 1000, 'Old Friend'),
      row('2026-11-17T10:00:00Z', 'u:2', 1000, 'Old Friend'),
      row('2026-11-17T11:00:00Z', 'u:3', 1000, 'Newcomer'),
      row('2026-11-18T09:00:00Z', 'u:4', 1000, 'Another New'),
    ], 'tracked')
    const weekStart = toT('2026-11-16T00:00:00Z')
    expect(newArtistsSince(weekStart)).toBe(2)
    expect(activeDays(weekStart, 0)).toEqual([Math.floor(toT('2026-11-18T00:00:00Z') / 86400), Math.floor(toT('2026-11-17T00:00:00Z') / 86400)])
  })
})
