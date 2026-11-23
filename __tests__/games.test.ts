import {
  seeded, dayKey, blindPool, blindRounds, blindPoints, clipStart, canPlayBlind,
  rankFive, rankScore, rankAnswer, moveItem, dragSlot, peakMonth, whenPoints, whenRoundsJob,
} from '@/utils/games'
import { runSync } from '@/utils/sqlJob'
import { insertPlays, _resetForTests, fromT } from '@/utils/playDb'

const tr = (i: number, artist = `A${i % 4}`, plays = 20 - i) => ({ name: `Song ${i}`, sub: artist, ms: 1, plays, uri: `spotify:track:s${i}` })

describe('seeded + dayKey', () => {
  it('repeats for the same seed', () => {
    const a = seeded(20261123), b = seeded(20261123)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(dayKey(new Date(2026, 10, 23))).toBe(20261123)
  })
})

describe('Blind five', () => {
  it('pools playable, de-duplicated songs', () => {
    const p = blindPool([tr(1), { ...tr(1) }, { name: 'Local', sub: 'x', ms: 1, plays: 3, uri: 'spotify:local:x' }, tr(2)])
    expect(p.map(s => s.name)).toEqual(['Song 1', 'Song 2'])
    expect(canPlayBlind(p)).toBe(false)
  })
  it('makes rounds of four with the answer in, other artists first', () => {
    const pool = blindPool(Array.from({ length: 16 }, (_, i) => tr(i)))
    const rounds = blindRounds(pool, 10, seeded(1))
    expect(rounds).toHaveLength(10)
    expect(new Set(rounds.map(r => r.answer.uri)).size).toBe(10)
    for (const r of rounds) {
      expect(r.options).toHaveLength(4)
      expect(r.options.map(o => o.uri)).toContain(r.answer.uri)
      expect(new Set(r.options.map(o => o.uri)).size).toBe(4)
      expect(r.options.filter(o => o.artist === r.answer.artist)).toHaveLength(1)
    }
  })
  it('scores speed and starts clips past the intro', () => {
    expect(blindPoints(false, 100)).toBe(0)
    expect(blindPoints(true, 0)).toBe(200)
    expect(blindPoints(true, 5000)).toBe(150)
    expect(blindPoints(true, 30000)).toBe(100)
    for (let i = 0; i < 20; i++) { const c = clipStart(); expect(c).toBeGreaterThanOrEqual(20000); expect(c).toBeLessThan(70000) }
  })
})

describe('Rank it', () => {
  const artists = [50, 40, 40, 30, 20, 10, 5].map((p, i) => ({ name: `Artist ${i}`, ms: 1, plays: p }))
  it('picks five different counts, not already in order, the same for a day', () => {
    const a = rankFive(artists, seeded(7))!, b = rankFive(artists, seeded(7))!
    expect(a).toEqual(b)
    expect(new Set(a.map(x => x.plays)).size).toBe(5)
    expect(rankScore(a)).toBeLessThan(5)
    expect(rankScore(rankAnswer(a))).toBe(5)
    expect(rankFive(artists.slice(0, 4), seeded(1))).toBeNull()
  })
  it('moves items and makes room while dragging', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect([0, 1, 2, 3].map(i => dragSlot(i, 0, 2))).toEqual([0, 0, 1, 3])
    expect([0, 1, 2, 3].map(i => dragSlot(i, 3, 1))).toEqual([0, 2, 3, 3])
    expect(dragSlot(2, null, null)).toBe(2)
  })
})

describe('When?', () => {
  it('needs a clear peak month', () => {
    expect(peakMonth([{ y: 2024, m: 2, n: 9 }, { y: 2024, m: 3, n: 4 }])).toEqual({ y: 2024, m: 2 })
    expect(peakMonth([{ y: 2024, m: 2, n: 5 }, { y: 2025, m: 3, n: 5 }])).toBeNull()
    expect(peakMonth([{ y: 2024, m: 2, n: 2 }])).toBeNull()
  })
  it('scores by months off, across years', () => {
    expect(whenPoints({ y: 2024, m: 2 }, { y: 2024, m: 2 })).toBe(200)
    expect(whenPoints({ y: 2024, m: 11 }, { y: 2025, m: 0 })).toBe(160)
    expect(whenPoints({ y: 2020, m: 0 }, { y: 2025, m: 0 })).toBe(0)
  })
  it('builds rounds from the plays table', () => {
    _resetForTests()
    const rows: any[] = []
    const at = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m, d, 12) / 1000)
    for (let i = 0; i < 8; i++) rows.push({ ts: fromT(at(2024, 2, 1 + i)), master_metadata_track_name: 'Peak', master_metadata_album_artist_name: 'P', spotify_track_uri: 'spotify:track:p', ms_played: 1000 })
    for (let i = 0; i < 2; i++) rows.push({ ts: fromT(at(2025, 5, 1 + i)), master_metadata_track_name: 'Peak', master_metadata_album_artist_name: 'P', spotify_track_uri: 'spotify:track:p', ms_played: 1000 })
    for (let i = 0; i < 6; i++) rows.push({ ts: fromT(at(2024, i, 3)), master_metadata_track_name: 'Flat', master_metadata_album_artist_name: 'F', spotify_track_uri: 'spotify:track:f', ms_played: 1000 })
    insertPlays(rows, 'import')
    const top = [{ name: 'Peak', sub: 'P', ms: 1, plays: 10 }, { name: 'Flat', sub: 'F', ms: 1, plays: 6 }, { name: 'Few', sub: 'X', ms: 1, plays: 2 }]
    const rounds = runSync(whenRoundsJob(top, 0, 5, seeded(3)))
    expect(rounds).toHaveLength(1)
    expect(rounds[0]).toMatchObject({ name: 'Peak', peak: { y: 2024, m: 2 } })
  })
})
