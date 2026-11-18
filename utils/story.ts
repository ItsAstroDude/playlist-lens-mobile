/**
 * Story mode (2.0) — turns a period's listening into a short sequence of slides.
 * Pure: the screen (app/story.tsx) animates whatever this returns.
 */
import { periodTitle, type PeriodComparison, type SummaryKind } from '@/utils/listening'

export type Palette = [string, string, string, string]
export interface StorySlide {
  id:      string
  kicker:  string          // small line above
  big:     string          // the headline
  sub?:    string          // supporting line
  roll?:   boolean         // `big` is a number: roll its digits
  palette: Palette
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
  const d = new Date(start + i * 86_400_000)
  return d.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'long', day: 'numeric' })
}

export function buildStory(c: PeriodComparison): StorySlide[] {
  const s = c.current, kind = s.kind, w = WORD[kind]
  const pal = (i: number) => PALETTES[i % PALETTES.length]
  if (!s.plays) {
    return [{ id: 'empty', kicker: `Your ${w}`, big: 'Nothing yet', sub: `Play something and your ${w} fills up here.`, palette: pal(0) }]
  }
  const slides: StorySlide[] = []
  slides.push({ id: 'intro', kicker: `Your ${w} in music`, big: periodTitle(s), sub: 'Tap to skip ahead · hold to pause', palette: pal(0) })
  slides.push({
    id: 'time', kicker: 'You listened for', big: fmtListen(s.ms), roll: true, palette: pal(1),
    sub: c.deltaMs === null ? `${s.plays.toLocaleString()} plays` : `${c.deltaMs >= 0 ? 'Up' : 'Down'} ${Math.abs(c.deltaMs)}% on last ${w} · ${s.plays.toLocaleString()} plays`,
  })
  const a = s.topArtists[0]
  if (a) slides.push({ id: 'artist', kicker: 'The artist you couldn’t stop playing', big: a.name, sub: `${fmtListen(a.ms)} · ${a.plays.toLocaleString()} plays`, palette: pal(2) })
  const t = s.topTracks[0]
  if (t) slides.push({ id: 'track', kicker: 'On repeat', big: t.name, sub: `${t.sub ? t.sub + ' · ' : ''}${t.plays.toLocaleString()} plays`, palette: pal(3) })
  const peak = s.buckets.reduce((best, v, i) => (v > s.buckets[best] ? i : best), 0)
  if (s.buckets[peak] > 0) slides.push({ id: 'peak', kicker: `Your biggest ${kind === 'year' ? 'month' : 'day'}`, big: bucketName(kind, s.start, peak), sub: fmtListen(s.buckets[peak]), palette: pal(4) })
  slides.push({ id: 'range', kicker: 'You heard', big: `${s.artists.toLocaleString()} artists`, roll: true, sub: `and ${s.tracks.toLocaleString()} different songs`, palette: pal(5) })
  slides.push({ id: 'outro', kicker: `That’s your ${w}`, big: 'See you next one', sub: 'Your stats keep counting in the background.', palette: pal(0) })
  return slides
}
