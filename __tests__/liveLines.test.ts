import { weekLines, streakFrom } from '@/utils/liveLines'

describe('live strip lines', () => {
  it('says only what is worth saying', () => {
    const lines = weekLines({ ms: 18 * 3_600_000 + 24 * 60_000, deltaMs: 12, topArtist: 'Radiohead', topTrack: { name: 'Reckoner', plays: 9 }, newArtists: 31, streak: 23 })
    expect(lines).toEqual([
      '◷  18h 24m of music so far this week.',
      '▲  Up 12% on last week. Someone’s busy.',
      '♥  Radiohead is your artist of the week.',
      '↻  Reckoner on repeat: 9 plays this week.',
      '✚  31 artists new to you this week.',
      '✺  23 days in a row with music. Keep it going.',
    ])
    expect(weekLines({ ms: 0, deltaMs: 3, topArtist: null, topTrack: { name: 'x', plays: 1 }, newArtists: 1, streak: 2 })).toEqual([])
    expect(weekLines({ ms: 0, deltaMs: -40, topArtist: null, topTrack: null, newArtists: 0, streak: 0 })).toEqual(['☾  A quieter week: down 40% on last.'])
  })
  it('counts a streak ending today, or yesterday when today is still empty', () => {
    expect(streakFrom([100, 99, 98, 96], 100)).toBe(3)
    expect(streakFrom([99, 98], 100)).toBe(2)
    expect(streakFrom([97], 100)).toBe(0)
  })
})
