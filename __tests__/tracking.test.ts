/**
 * Tests for utils/tracking.ts — listen-time estimate, row conversion, and the
 * incremental sync (api mocked; storage is the in-memory MMKV from jest-setup).
 */
jest.mock('expo-secure-store')
jest.mock('../utils/authEvents', () => ({ emitSessionExpired: jest.fn(), emitSignedIn: jest.fn() }))
jest.mock('@/utils/api', () => ({ api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }))

import { api } from '@/utils/api'
import { storage } from '@/utils/cache'
import { loadBuffer, appendToBuffer } from '@/utils/recents'
import { estimateListenMs, toStreamRows, syncTrackedPlays, type TrackedPlay } from '@/utils/tracking'

const get = api.get as jest.Mock
const p = (at: string, name: string, dur = 200_000): TrackedPlay => ({
  played_at: at, uri: `spotify:track:${name}`, name, artists: ['Artist'], album: 'Al', image: null, duration_ms: dur,
})

beforeEach(() => { storage.clearAll(); get.mockReset() })

describe('estimateListenMs', () => {
  it('uses the gap to the next play, capped at the track length', () => {
    const ms = estimateListenMs([
      p('2026-11-17T10:00:00.000Z', 'skipped'),        // next play 45s later → skipped
      p('2026-11-17T10:00:45.000Z', 'full'),           // next play 5min later → full 200s
      p('2026-11-17T10:05:45.000Z', 'last'),
    ])
    expect(ms).toEqual([45_000, 200_000, 200_000])
  })
  it('floors at 30s and treats a long pause or a missing duration sanely', () => {
    expect(estimateListenMs([p('2026-11-17T10:00:00Z', 'a'), p('2026-11-17T10:00:10Z', 'b')])[0]).toBe(30_000)
    expect(estimateListenMs([p('2026-11-17T10:00:00Z', 'a'), p('2026-11-17T12:00:00Z', 'b')])[0]).toBe(200_000)
    expect(estimateListenMs([p('2026-11-17T10:00:00Z', 'a', 0)])[0]).toBe(0)
  })
})

describe('toStreamRows', () => {
  it('maps to the export row shape with the estimate', () => {
    const [r] = toStreamRows([p('2026-11-17T10:00:00.000Z', 'x')])
    expect(r).toEqual({
      ts: '2026-11-17T10:00:00.000Z', ms_played: 200_000,
      master_metadata_track_name: 'x', master_metadata_album_artist_name: 'Artist',
      master_metadata_album_album_name: 'Al', spotify_track_uri: 'spotify:track:x',
    })
  })
})

describe('appendToBuffer replace mode', () => {
  it('overwrites a same-key row only when asked', () => {
    const [a] = toStreamRows([p('2026-11-17T10:00:00.000Z', 'x')])
    const b = { ...a, ms_played: 45_000 }
    expect(appendToBuffer([a], [b])[0].ms_played).toBe(200_000)
    expect(appendToBuffer([a], [b], { replace: true })[0].ms_played).toBe(45_000)
  })
})

describe('syncTrackedPlays', () => {
  it('pages from a cursor and re-estimates the previous newest play', async () => {
    get.mockResolvedValueOnce({ items: [p('2026-11-17T10:00:00.000Z', 'a'), p('2026-11-17T10:05:00.000Z', 'b')], more: false })
    expect(await syncTrackedPlays()).toBe(2)
    expect(loadBuffer().map(r => r.ms_played)).toEqual([200_000, 200_000])   // b is the tail: full for now

    // Next sync: b turns out to have been skipped after 40s.
    get.mockResolvedValueOnce({ items: [p('2026-11-17T10:05:40.000Z', 'c')], more: false })
    expect(await syncTrackedPlays()).toBe(1)
    expect(get).toHaveBeenLastCalledWith('/api/tracking/plays?after=2026-11-17T10%3A05%3A00.000Z')
    expect(loadBuffer().map(r => [r.master_metadata_track_name, r.ms_played])).toEqual([
      ['a', 200_000], ['b', 40_000], ['c', 200_000],
    ])
  })
  it('keeps going while the server says there is more', async () => {
    get
      .mockResolvedValueOnce({ items: [p('2026-11-17T10:00:00.000Z', 'a')], more: true })
      .mockResolvedValueOnce({ items: [p('2026-11-17T10:04:00.000Z', 'b')], more: false })
    expect(await syncTrackedPlays()).toBe(2)
    expect(get).toHaveBeenCalledTimes(2)
  })
})
