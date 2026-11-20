/**
 * Story mode (2.0) — turns a period's listening into a short sequence of slides.
 * Pure: the screen (app/story.tsx) animates whatever this returns.
 */
import { periodTitle, type PeriodComparison, type SummaryKind } from '@/utils/listening'
import type { ArtKind } from '@/hooks/useArtwork'

export type Palette = [string, string, string, string]
export interface StorySlide {
  id:      string
  kicker:  string          // small line above
  big:     string          // the headline
  sub?:    string          // supporting line
  roll?:   boolean         // `big` is a number: roll its digits
  palette: Palette
  /** A cover / photo above the words (top artist, top song). */
  art?:    { kind: ArtKind; name: string; artist?: string }
  /** A short ranked list instead of a sub line (top 5). */
  list?:   { name: string; sub?: string; value: string }[]
  /** 24 hourly values: a little listening clock. */
  clock?:  number[]
  /** The last slide: offers the share card. */
  share?:  boolean
}

export interface StoryOpts {
  /** All time (buckets are years, named by `bucketLabels`). */
  all?:        boolean
  /** A finished period rather than "so far". */
  past?:       boolean
  /** Artists first heard in the period, when known. */
  newArtists?: number | null
}

const PALETTES: Palette[] = [
  ['#6a2bd9', '#ff70a5', '#ffb347', '#b39dff'],
  ['#1e4fa3', '#4fc3f7', '#2ec4a6', '#3a6fd8'],
  ['#a3341f', '#ff7a5c', '#ffb347', '#ff70a5'],
  ['#1d8a5a', '#53e076', '#c6f36b', '#2ec4a6'],
  ['#4e03d0', '#ccbdff', '#ff70a5', '#6a2bd9'],
  ['#3a6fd8', '#ff70a5', '#4fc3f7', '#b39dff'],
]
const WORD: Record<SummaryKind, string> = { week: 'week', month: 'month', year: 'year' }
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "18h 24m", "45m", "312h" (no minutes past 100 hours). */
export function fmtListen(ms: number): string {
  const min = Math.floor(ms / 60_000), h = Math.floor(min / 60), m = min % 60
  if (h >= 100) return `${h}h`
  return h > 0 ? `${h}h ${m < 10 ? '0' : ''}${m}m` : `${m}m`
}

/** The label for a bucket of the period: a weekday, a date, or a month. */
export function bucketName(kind: SummaryKind, start: number, i: number): string {
  if (kind === 'week') return DAYS[i] ?? ''
  if (kind === 'year') return MONTHS[i] ?? ''
  // `start` is the period's local midnight; noon of day i is safely that local date,
  // whatever the timezone or a DST change on the way.
  const d = new Date(start + i * 86_400_000 + 12 * 3_600_000)
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

/** "night owl" etc. for the hour you listen most. */
export function clockPersona(hour: number): string {
  if (hour >= 22 || hour < 4) return 'A night owl'
  if (hour < 9)  return 'An early bird'
  if (hour < 13) return 'A morning listener'
  if (hour < 18) return 'An afternoon listener'
  return 'An evening listener'
}

const two = (h: number) => `${String(h).padStart(2, '0')}:00`

export function buildStory(c: PeriodComparison, opts: StoryOpts = {}): StorySlide[] {
  const s = c.current, kind = s.kind
  const w = opts.all ? 'all time' : WORD[kind]
  const pal = (i: number) => PALETTES[i % PALETTES.length]
  if (!s.plays) {
    return [{ id: 'empty', kicker: opts.all ? 'All time' : `Your ${w}`, big: 'Nothing yet', sub: `Play something and your ${w} fills up here.`, palette: pal(0) }]
  }
  const slides: StorySlide[] = []
  const since = new Date(s.start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  slides.push(opts.all
    ? { id: 'intro', kicker: 'Everything you’ve played', big: 'All time', sub: `Since ${since} · tap to skip ahead · hold to pause`, palette: pal(0) }
    : { id: 'intro', kicker: `Your ${w} in music`, big: periodTitle(s), sub: 'Tap to skip ahead · hold to pause', palette: pal(0) })
  const vs = opts.past ? `the ${w} before` : `last ${w}`
  slides.push({
    id: 'time', kicker: 'You listened for', big: fmtListen(s.ms), roll: true, palette: pal(1),
    sub: c.deltaMs === null ? `${s.plays.toLocaleString()} plays` : `${c.deltaMs >= 0 ? 'Up' : 'Down'} ${Math.abs(c.deltaMs)}% on ${vs} · ${s.plays.toLocaleString()} plays`,
  })
  const a = s.topArtists[0]
  if (a) slides.push({ id: 'artist', kicker: 'The artist you couldn’t stop playing', big: a.name, sub: `${fmtListen(a.ms)} · ${a.plays.toLocaleString()} plays`, palette: pal(2), art: { kind: 'artist', name: a.name } })
  if (s.topArtists.length >= 3) {
    slides.push({ id: 'artists', kicker: 'Your top artists', big: '', palette: pal(2),
      list: s.topArtists.slice(0, 5).map(x => ({ name: x.name, value: fmtListen(x.ms) })) })
  }
  const t = s.topTracks[0]
  if (t) slides.push({ id: 'track', kicker: 'On repeat', big: t.name, sub: `${t.sub ? t.sub + ' · ' : ''}${t.plays.toLocaleString()} plays`, palette: pal(3), art: { kind: 'track', name: t.name, artist: t.sub } })
  if (s.topTracks.length >= 3) {
    slides.push({ id: 'tracks', kicker: 'Your top songs', big: '', palette: pal(3),
      list: s.topTracks.slice(0, 5).map(x => ({ name: x.name, sub: x.sub, value: `${x.plays}×` })) })
  }
  const peak = s.buckets.reduce((best, v, i) => (v > s.buckets[best] ? i : best), 0)
  if (s.buckets[peak] > 0) {
    const name = opts.all ? (s.bucketLabels?.[peak] ?? '') : bucketName(kind, s.start, peak)
    slides.push({ id: 'peak', kicker: `Your biggest ${opts.all ? 'year' : kind === 'year' ? 'month' : 'day'}`, big: name, sub: fmtListen(s.buckets[peak]), palette: pal(4) })
  }
  if (s.clock && s.clock.some(v => v > 0)) {
    const h = s.clock.indexOf(Math.max(...s.clock))
    slides.push({ id: 'clock', kicker: 'You’re', big: clockPersona(h), sub: `Most of your listening: ${two(h)}–${two((h + 1) % 24)}`, palette: pal(5), clock: s.clock })
  }
  const fresh = opts.newArtists && opts.newArtists > 0 ? ` · ${opts.newArtists.toLocaleString()} of them new to you` : ''
  slides.push({ id: 'range', kicker: 'You heard', big: `${s.artists.toLocaleString()} artists`, roll: true, sub: `and ${s.tracks.toLocaleString()} different songs${fresh}`, palette: pal(5) })
  slides.push(opts.all
    ? { id: 'outro', kicker: 'That’s all of it, so far', big: 'Keep listening', sub: 'Share your card, or tap to close.', palette: pal(0), share: true }
    : { id: 'outro', kicker: opts.past ? `That was your ${w}` : `That’s your ${w}`, big: opts.past ? 'Nice one' : 'See you next one', sub: 'Share your card, or tap to close.', palette: pal(0), share: true })
  return slides
}
