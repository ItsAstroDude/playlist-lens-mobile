/**
 * Spark's voice (docs/spark/SPARK_BRIEF.md §5): lowercase, short (≤ 14 words), warm,
 * a little dry. No emoji. He never invents a number — every figure in a line comes
 * straight from the play database (see `factLines`).
 */
import type { WeekFacts } from '@/utils/liveLines'
import { fmtListen } from '@/utils/story'

export type Bank =
  | 'greeting_first' | 'greeting_morning' | 'greeting_afternoon' | 'greeting_evening' | 'greeting_night'
  | 'greeting_return' | 'tap' | 'rock'

export const LINES: Record<Bank, string[]> = {
  greeting_first: [
    'hi. i’m spark. a little smarter than a rock. but hey.',
    'oh, hi. i’m spark. i live in the dot up there.',
  ],
  greeting_morning: [
    'morning. ears on.',
    'good morning. let’s see what you’ve been playing.',
    'morning. the headphones are already warm.',
    'morning. coffee for you, a playlist for me.',
  ],
  greeting_afternoon: [
    'afternoon. what are we listening to?',
    'hey. good to see you again.',
    'afternoon. good time for something new.',
  ],
  greeting_evening: [
    'evening. good time for an album, start to finish.',
    'hey again. evening mode.',
    'evening. turn it up a little.',
  ],
  greeting_night: [
    'up late? me too. stars do that.',
    'late one. keep it quiet.',
    'night owl hours. i get it.',
  ],
  greeting_return: [
    'you’re back. i kept your spot warm.',
    'there you are. the music missed you.',
  ],
  tap: [
    'i’m not saying i’m smart. i’m saying i’m not a rock.',
    'yes? i’m listening.',
    'boop.',
    'that tickles. a bit.',
    'i’m a star. technically.',
    'made by astro. assembled with care.',
    'headphones on. world off.',
    'i’d hum along, but no lungs.',
    'i only know what you play here.',
    'still here. still not a rock.',
  ],
  rock: [
    'okay. okay. i’m a rock now.',
    'rock mode. no thoughts. just rock.',
    'fine. i’m a rock. a shiny one.',
  ],
}

const clip = (s: string, n = 28) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

/** Lines built from this week's real numbers — only the ones worth saying. */
export function factLines(f: WeekFacts | null): string[] {
  if (!f) return []
  const out: string[] = []
  if (f.topArtist) out.push(`${clip(f.topArtist)} again. your artist of the week.`)
  if (f.topTrack && f.topTrack.plays >= 3) out.push(`${clip(f.topTrack.name)}, ${f.topTrack.plays} plays this week. on repeat, huh.`)
  if (f.streak >= 3) out.push(`${f.streak} days in a row with music. nice.`)
  if (f.newArtists >= 2) out.push(`${f.newArtists} new artists this week. look at you.`)
  if (f.ms >= 60_000) out.push(`${fmtListen(f.ms)} of music this week so far.`)
  if (f.deltaMs !== null && f.deltaMs >= 10) out.push(`up ${f.deltaMs}% on last week. someone’s busy.`)
  return out
}

/** Which greeting bank fits the hour (local time). */
export function greetingBank(hour: number): Bank {
  return hour < 5 ? 'greeting_night' : hour < 12 ? 'greeting_morning' : hour < 18 ? 'greeting_afternoon' : hour < 22 ? 'greeting_evening' : 'greeting_night'
}
