import { fadingFavorites, secondChances, timeMachine, pickPastPeriod, buildShelves } from '@/utils/rediscovery'
import type { TrackStat, RecapBundle, RecapPeriod } from '@/utils/wrapped'

const NOW = Date.parse('2026-06-16T00:00:00Z')   // a Summer (June) date
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

const t = (over: Partial<TrackStat> & { name: string }): TrackStat => ({
  artist: 'Artist', plays: 1, ms: 200_000, uri: `spotify:track:${over.name}`, ...over,
})

describe('fadingFavorites', () => {
  const index = [
    t({ name: 'loved-cold', plays: 50, lastTs: ago(400) }),   // high plays, long gone → in
    t({ name: 'loved-hot',  plays: 50, lastTs: ago(5) }),     // high plays but recent → out
    t({ name: 'meh-cold',   plays: 3,  lastTs: ago(400) }),   // too few plays → out
    t({ name: 'no-uri',     plays: 99, lastTs: ago(400), uri: undefined }), // unplayable → out
  ]
  it('keeps high-play, long-dormant tracks and drops the rest', () => {
    const out = fadingFavorites(index, { now: NOW })
    expect(out.map(s => s.name)).toEqual(['loved-cold'])
    expect(out[0].reason).toContain('50×')
  })
  it('respects the limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => t({ name: `x${i}`, plays: 10 + i, lastTs: ago(200) }))
    expect(fadingFavorites(many, { now: NOW, limit: 10 })).toHaveLength(10)
  })
})

describe('secondChances', () => {
  const index = [
    t({ name: 'almost',   plays: 3,  lastTs: ago(300) }),   // 2–4 plays, dormant → in
    t({ name: 'too-many', plays: 20, lastTs: ago(300) }),   // too many plays → out (that's fading)
    t({ name: 'recent',   plays: 3,  lastTs: ago(10) }),    // not dormant → out
    t({ name: 'older',    plays: 2,  lastTs: ago(500) }),   // more dormant → should lead
  ]
  it('keeps low-play dormant tracks, most-dormant first', () => {
    const out = secondChances(index, { now: NOW })
    expect(out.map(s => s.name)).toEqual(['older', 'almost'])
  })
})

describe('timeMachine', () => {
  const period = (key: string, label: string, tracks: { name: string; artist: string; plays: number }[]): RecapPeriod => ({
    kind: 'season', key, label, ms: 0, streams: 0, topArtists: [], topAlbums: [],
    topTracks: tracks.map(x => ({ ...x, ms: 0 })),   // NOTE: no uri — must resolve via index
  })
  const recaps: RecapBundle = {
    version: 1, generatedAt: ago(0), weeks: [], months: [],
    years: [],
    seasons: [period('2025-Summer', 'Summer 2025', [{ name: 'S1', artist: 'X', plays: 9 }])],
  }
  const index = [t({ name: 'S1', artist: 'X', plays: 30, lastTs: ago(365), uri: 'spotify:track:s1' })]

  it('picks the same season a year earlier and resolves uris from the index', () => {
    const tm = timeMachine(recaps, index, { now: new Date(NOW) })
    expect(tm?.label).toBe('Summer 2025')
    expect(tm?.tracks[0]).toMatchObject({ uri: 'spotify:track:s1', name: 'S1' })
  })

  it('drops tracks it cannot resolve to a uri', () => {
    expect(timeMachine(recaps, [], { now: new Date(NOW) })).toBeNull()
  })

  it('pickPastPeriod falls back to the most recent past year when no matching season', () => {
    const r: RecapBundle = {
      version: 1, generatedAt: ago(0), weeks: [], months: [], seasons: [],
      years: [period('2024', '2024', [{ name: 'Y', artist: 'Z', plays: 5 }])],
    }
    expect(pickPastPeriod(r, { week: '', month: '', season: '2026-Summer', year: '2026' })?.key).toBe('2024')
  })
})

describe('buildShelves', () => {
  it('returns nothing without an index', () => {
    expect(buildShelves(null, null, NOW)).toEqual([])
  })
  it('assembles the available shelves', () => {
    const index = [
      t({ name: 'a', plays: 40, lastTs: ago(300) }),  // fading
      t({ name: 'b', plays: 3,  lastTs: ago(300) }),  // second chance
    ]
    const ids = buildShelves(index, null, NOW).map(s => s.id)
    expect(ids).toEqual(['fading', 'second'])
  })
})
