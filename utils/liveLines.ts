/**
 * Live lines for the Lenses strip (2.0): short, personal facts about this week, read
 * fresh from the play database each time the strip builds its rotation.
 */
import { playsSince, newArtistsSince, activeDays } from '@/utils/playDb'
import { comparePeriods, periodRange } from '@/utils/listening'
import { fmtListen } from '@/utils/story'

export interface WeekFacts {
  ms:          number
  deltaMs:     number | null
  topArtist:   string | null
  topTrack:    { name: string; plays: number } | null
  newArtists:  number
  streak:      number
}

/** Days in a row with music, ending today (or yesterday, if today has none yet). */
export function streakFrom(days: number[], today: number): number {
  const set = new Set(days)
  let d = set.has(today) ? today : today - 1
  let n = 0
  while (set.has(d)) { n++; d-- }
  return n
}

/** The facts as strip lines ("<glyph>  text"). Only what's worth saying. */
export function weekLines(f: WeekFacts): string[] {
  const out: string[] = []
  if (f.ms >= 60_000) out.push(`◷  ${fmtListen(f.ms)} of music so far this week.`)
  if (f.deltaMs !== null && f.deltaMs >= 10) out.push(`▲  Up ${f.deltaMs}% on last week. Someone’s busy.`)
  if (f.deltaMs !== null && f.deltaMs <= -25) out.push(`☾  A quieter week: down ${Math.abs(f.deltaMs)}% on last.`)
  if (f.topArtist) out.push(`♥  ${f.topArtist} is your artist of the week.`)
  if (f.topTrack && f.topTrack.plays >= 3) out.push(`↻  ${f.topTrack.name} on repeat: ${f.topTrack.plays} plays this week.`)
  if (f.newArtists >= 2) out.push(`✚  ${f.newArtists} artists new to you this week.`)
  if (f.streak >= 3) out.push(`✺  ${f.streak} days in a row with music. Keep it going.`)
  return out
}

/** This week's facts from the play database (null if it can't be read). */
export function weekFacts(now: Date = new Date()): WeekFacts | null {
  try {
    const prevStart = Math.floor(periodRange('week', now, 1).start / 1000)
    const weekStart = Math.floor(periodRange('week', now).start / 1000)
    const c = comparePeriods(playsSince(prevStart), 'week', now)
    const offset = -now.getTimezoneOffset() * 60
    const today = Math.floor((now.getTime() / 1000 + offset) / 86400)
    const t = c.current.topTracks[0]
    return {
      ms: c.current.ms,
      deltaMs: c.deltaMs,
      topArtist: c.current.topArtists[0]?.name ?? null,
      topTrack: t ? { name: t.name, plays: t.plays } : null,
      newArtists: newArtistsSince(weekStart),
      streak: streakFrom(activeDays(Math.floor(now.getTime() / 1000) - 120 * 86400, offset), today),
    }
  } catch {
    return null
  }
}
