/**
 * The Lenses strip (2.0.49): lines about you, each one a way in. Your week and your
 * lifetime first, every line with somewhere to go (an artist's page, a song's, your week
 * as a story); quotes and tips only fill in when there's little to say about you yet.
 * Pure — the strip (components/ui/RotatingStrip) draws and runs them.
 */
import type { WeekFacts } from '@/utils/liveLines'
import type { WrappedStats } from '@/utils/wrapped'
import { fmtListen } from '@/utils/story'
import type { ArtKind } from '@/hooks/useArtwork'

export type StripAction =
  | { kind: 'artist'; name: string }
  | { kind: 'song'; name: string; artist: string }
  | { kind: 'story'; period: 'week' | 'year' | 'all'; back?: number }
  | { kind: 'route'; path: '/history' | '/backup' | '/play' | '/taste' }

export interface StripLine {
  /** Stable id (rotation keeps its place when lines are rebuilt). */
  id: string
  glyph: string
  text: string
  /** A cover or photo shown instead of the glyph. */
  art?: { kind: ArtKind; name: string; artist?: string }
  action?: StripAction
  /** About you (week / lifetime / your banner), not a quote or tip. */
  personal: boolean
}

/** Fewer personal lines than this and the quotes and tips fill in. */
export const MIN_PERSONAL = 3

const n = (v: number) => v.toLocaleString()

export function weekStripLines(f: WeekFacts | null): StripLine[] {
  if (!f) return []
  const out: StripLine[] = []
  if (f.topArtist) out.push({ id: 'w.artist', glyph: '♥', personal: true,
    text: `${f.topArtist} is your artist of the week`,
    art: { kind: 'artist', name: f.topArtist }, action: { kind: 'artist', name: f.topArtist } })
  if (f.topTrack && f.topTrack.plays >= 3) out.push({ id: 'w.repeat', glyph: '↻', personal: true,
    text: `${f.topTrack.name} on repeat · ${f.topTrack.plays} plays this week`,
    art: { kind: 'track', name: f.topTrack.name, artist: f.topTrack.artist },
    action: f.topTrack.artist ? { kind: 'song', name: f.topTrack.name, artist: f.topTrack.artist } : undefined })
  if (f.ms >= 60_000) {
    const d = f.deltaMs
    const trend = d !== null && d >= 10 ? ` · up ${d}% on last week` : d !== null && d <= -25 ? ` · a quieter week, down ${Math.abs(d)}%` : ''
    out.push({ id: 'w.time', glyph: '◷', personal: true, text: `${fmtListen(f.ms)} of music this week${trend}`,
      action: { kind: 'story', period: 'week' } })
  }
  if (f.streak >= 3) out.push({ id: 'w.streak', glyph: '✺', personal: true,
    text: `${f.streak} days in a row with music`, action: { kind: 'route', path: '/history' } })
  if (f.newArtists >= 2) out.push({ id: 'w.new', glyph: '✚', personal: true,
    text: `${n(f.newArtists)} artists new to you this week`, action: { kind: 'route', path: '/history' } })
  return out
}

export function lifetimeStripLines(s: WrappedStats | null, nowYear = new Date().getFullYear()): StripLine[] {
  if (!s || !s.totalStreams) return []
  const out: StripLine[] = []
  const a = s.topArtists?.[0], t = s.topTracks?.[0]
  if (s.totalMs > 0) out.push({ id: 'l.time', glyph: '◷', personal: true,
    text: `${n(Math.round(s.totalMs / 3_600_000))}h of music, all time`, action: { kind: 'story', period: 'all' } })
  if (a) out.push({ id: 'l.artist', glyph: '★', personal: true, text: `${a.name}, your #1 artist of all time`,
    art: { kind: 'artist', name: a.name }, action: { kind: 'artist', name: a.name } })
  if (t) out.push({ id: 'l.track', glyph: '♪', personal: true, text: `${t.name}, your most played song`,
    art: { kind: 'track', name: t.name, artist: t.artist || undefined },
    action: t.artist ? { kind: 'song', name: t.name, artist: t.artist } : undefined })
  if (s.byYear?.length > 1) {
    const top = [...s.byYear].sort((x, y) => y.ms - x.ms)[0]
    if (top?.ms > 0 && top.year <= nowYear) out.push({ id: 'l.year', glyph: '✦', personal: true, text: `${top.year} was your loudest year`,
      action: { kind: 'story', period: 'year', back: nowYear - top.year } })
  }
  if (s.uniqueArtists > 0) out.push({ id: 'l.artists', glyph: '✦', personal: true, text: `${n(s.uniqueArtists)} artists explored so far` })
  return out
}

/** Quotes: no destination, a breath between your lines. */
export const QUOTES = [
  '♪  Shuffle is just trust with extra steps.',
  '☾  Headphones on, world off.',
  '⤳  One more song. Famous last words.',
  '♥  Some songs are a place you go back to.',
  '☾  3 a.m. playlists hit different.',
  '✦  Every playlist tells a story.',
  '♪  Where words fail, music speaks.',
  '☾  Your late-night playlist knows things.',
  '⤳  Skips are just unspoken opinions.',
]

export function tipLines(o: { backedUp: boolean }): StripLine[] {
  const tips: StripLine[] = [
    { id: 't.pin', glyph: '◍', personal: false, text: 'Hold a lens to pin, share or compare it' },
    { id: 't.play', glyph: '★', personal: false, text: 'Four games about your own listening', action: { kind: 'route', path: '/play' } },
    { id: 't.taste', glyph: '◎', personal: false, text: 'Your taste across every lens', action: { kind: 'route', path: '/taste' } },
  ]
  if (!o.backedUp) tips.unshift({ id: 't.backup', glyph: '⤓', personal: false, text: 'Your history lives only on this phone. Back it up', action: { kind: 'route', path: '/backup' } })
  return tips
}

function quoteLines(): StripLine[] {
  return QUOTES.map((q, i) => {
    const m = q.match(/^(\S+)\s{2,}(.*)$/)
    return { id: `q.${i}`, glyph: m ? m[1] : '✦', text: m ? m[2] : q, personal: false }
  })
}

/**
 * The rotation. Your banner first, then your week and your lifetime, alternating so both
 * show early. With fewer than MIN_PERSONAL lines about you, tips and quotes fill in;
 * an unbacked-up history always gets its reminder.
 */
export function buildStrip(o: { custom?: string | null; week: StripLine[]; life: StripLine[]; backedUp: boolean }): StripLine[] {
  const out: StripLine[] = []
  if (o.custom?.trim()) out.push({ id: 'custom', glyph: '✦', text: o.custom.trim(), personal: true })
  const max = Math.max(o.week.length, o.life.length)
  for (let i = 0; i < max; i++) {
    if (i < o.week.length) out.push(o.week[i])
    if (i < o.life.length) out.push(o.life[i])
  }
  const personal = out.length
  const tips = tipLines({ backedUp: o.backedUp })
  if (personal >= MIN_PERSONAL) {
    // Plenty about you: just the backup reminder (when it's due), once, after a few lines.
    const backup = tips.find(t => t.id === 't.backup')
    if (backup) out.splice(Math.min(3, out.length), 0, backup)
    return out
  }
  const fill = [...tips, ...quoteLines()]
  for (let i = 0; i < fill.length; i++) out.push(fill[i])
  return out
}

/** The route for a line's action (null: the line has nowhere to go; a tap skips it). */
export function stripHref(a: StripAction | undefined): string | { pathname: string; params: Record<string, string> } | null {
  if (!a) return null
  switch (a.kind) {
    case 'artist': return { pathname: '/artist', params: { name: a.name } }
    case 'song':   return { pathname: '/song', params: { name: a.name, artist: a.artist } }
    case 'story':  return { pathname: '/story', params: { kind: a.period, ...(a.back ? { back: String(a.back) } : {}) } }
    case 'route':  return a.path
  }
}
