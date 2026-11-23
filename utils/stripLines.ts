import { Colors } from '@/constants/theme'
import { loadCachedWrapped } from '@/hooks/useWrapped'
import { wrappedTeasers } from '@/utils/wrapped'
import { getCustomQuote } from '@/utils/settings'
import { weekFacts, weekLines } from '@/utils/liveLines'

/**
 * The lines the top island peeks on Lenses and shows when tapped (formerly the Lenses
 * top strip): music quotes and tips interleaved with your own numbers, your custom
 * line first. Each line is "<glyph>  <text>".
 */
export const QUOTES = [
  // 2.0
  '♪  Shuffle is just trust with extra steps.',
  '☾  Headphones on, world off.',
  '⤳  One more song. Famous last words.',
  '♥  Some songs are a place you go back to.',
  '☾  3 a.m. playlists hit different.',
  '✦  Your week as a story: Wrapped › Play your week.',
  '◎  Pull your lenses down. Watch the aperture.',
  '◐  The colours follow your music. Play something.',
  '◍  Hold a lens to pin, share or compare it.',
  '★  Your queue, your rules.',
  // 1.x
  '✦  Every playlist tells a story.',
  '♪  Where words fail, music speaks.',
  '◎  Tap your taste profile for the big picture.',
  '◐  Import your lifetime history in Wrapped.',
  '♥  Pretending the aux is yours again.',
  '✦  Without music, life would be a mistake.',
  '☾  Your late-night playlist knows things.',
  '◍  Compare two playlists — see who really wins.',
  '⤳  Skips are just unspoken opinions.',
  '♪  Good taste is a playlist away.',
]


/** Split "<glyph>  <rest>" → ['<glyph>', '<rest>']; falls back gracefully. */
export function splitGlyph(line: string): [string, string] {
  const m = line.match(/^(\S+)\s{2,}(.*)$/)
  return m ? [m[1], m[2]] : ['✦', line]
}

/** Interleave personal lines + quotes so something about YOU shows up early: this
 *  week's live facts first, then lifetime teasers from the import. */
export function buildPool(): string[] {
  const teasers = [...weekLines(weekFacts() ?? { ms: 0, deltaMs: null, topArtist: null, topTrack: null, newArtists: 0, streak: 0 }), ...wrappedTeasers(loadCachedWrapped())]
  const out: string[] = []
  // The user's custom banner (Settings → Appearance) leads the rotation.
  const custom = getCustomQuote()
  if (custom) out.push(custom)
  if (!teasers.length) return out.concat(QUOTES)
  const max = Math.max(teasers.length, QUOTES.length)
  for (let i = 0; i < max; i++) {
    if (i < teasers.length) out.push(teasers[i])
    if (i < QUOTES.length)  out.push(QUOTES[i])
  }
  return out
}


/** Accent for the line at index i (the glyph's colour cycles). */
export const LINE_ACCENTS = [Colors.greenPrimary, Colors.lavender, Colors.pink]
