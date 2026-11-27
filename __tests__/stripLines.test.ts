import { weekStripLines, lifetimeStripLines, buildStrip, stripHref, MIN_PERSONAL } from '@/utils/stripLines'
import type { WrappedStats } from '@/utils/wrapped'

const week = { ms: 18 * 3_600_000 + 24 * 60_000, deltaMs: 12, topArtist: 'Jamie Paige', topTrack: { name: 'Machine Love', artist: 'Jamie Paige', plays: 9 }, newArtists: 4, streak: 23 }
const life = {
  totalStreams: 150_000, totalMs: 3855 * 3_600_000, uniqueArtists: 2623,
  topArtists: [{ name: 'DECO*27', ms: 1, plays: 1 }], topTracks: [{ name: 'Rabbit Hole', artist: 'DECO*27', plays: 400, ms: 1 }],
  byYear: [{ year: 2024, ms: 5, streams: 1, topArtist: '' }, { year: 2025, ms: 9, streams: 1, topArtist: '' }],
} as unknown as WrappedStats

describe('strip lines', () => {
  it('your week, each line with somewhere to go', () => {
    const l = weekStripLines(week)
    expect(l.map(x => x.id)).toEqual(['w.artist', 'w.repeat', 'w.time', 'w.streak', 'w.new'])
    expect(l[0]).toMatchObject({ text: 'Jamie Paige is your artist of the week', art: { kind: 'artist', name: 'Jamie Paige' }, action: { kind: 'artist', name: 'Jamie Paige' } })
    expect(l[1].action).toEqual({ kind: 'song', name: 'Machine Love', artist: 'Jamie Paige' })
    expect(l[2].text).toBe('18h 24m of music this week · up 12% on last week')
    expect(l[2].action).toEqual({ kind: 'story', period: 'week' })
  })
  it('says only what is worth saying', () => {
    expect(weekStripLines({ ms: 0, deltaMs: 3, topArtist: null, topTrack: { name: 'x', plays: 1 }, newArtists: 1, streak: 2 })).toEqual([])
    expect(weekStripLines(null)).toEqual([])
  })
  it('lifetime: hours, #1 artist and song, the loudest year as a story', () => {
    const l = lifetimeStripLines(life, 2026)
    expect(l.map(x => x.text)).toEqual([
      '3,855h of music, all time', 'DECO*27, your #1 artist of all time', 'Rabbit Hole, your most played song',
      '2025 was your loudest year', '2,623 artists explored so far',
    ])
    expect(l[3].action).toEqual({ kind: 'story', period: 'year', back: 1 })
  })
  it('your banner first, week and lifetime alternate, no quotes when there is plenty about you', () => {
    const s = buildStrip({ custom: 'hi', week: weekStripLines(week), life: lifetimeStripLines(life, 2026), backedUp: true })
    expect(s[0].id).toBe('custom')
    expect(s.slice(1, 5).map(x => x.id)).toEqual(['w.artist', 'l.time', 'w.repeat', 'l.artist'])
    expect(s.every(x => x.personal)).toBe(true)
  })
  it('an unbacked-up history gets one reminder early on', () => {
    const s = buildStrip({ week: weekStripLines(week), life: [], backedUp: false })
    expect(s.filter(x => x.id === 't.backup')).toHaveLength(1)
    expect(s.findIndex(x => x.id === 't.backup')).toBe(3)
  })
  it('little about you: tips and quotes fill in', () => {
    const s = buildStrip({ week: [], life: [], backedUp: true })
    expect(s.length).toBeGreaterThan(MIN_PERSONAL)
    expect(s.some(x => x.id.startsWith('q.'))).toBe(true)
    expect(s.find(x => x.id === 't.play')?.action).toEqual({ kind: 'route', path: '/play' })
  })
  it('turns actions into routes', () => {
    expect(stripHref({ kind: 'song', name: 'A', artist: 'B' })).toEqual({ pathname: '/song', params: { name: 'A', artist: 'B' } })
    expect(stripHref({ kind: 'story', period: 'all' })).toEqual({ pathname: '/story', params: { kind: 'all' } })
    expect(stripHref({ kind: 'route', path: '/backup' })).toBe('/backup')
    expect(stripHref(undefined)).toBeNull()
  })
})
