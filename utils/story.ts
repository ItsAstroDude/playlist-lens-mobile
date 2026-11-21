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
  /** A short ranked list instead of a sub line (top 5); `listKind` picks each row's cover. */
  list?:   { name: string; sub?: string; value: string }[]
  listKind?: ArtKind
  /** 24 hourly values: a little listening clock. */
  clock?:  number[]
  /** The last slide: offers the share card (and shows a preview of it). */
  share?:  boolean
  /** A bar chart of the period with one bar picked out (the biggest day / month / year). */
  bars?:   { values: number[]; labels: string[]; peak: number; peakText?: string }
  /** This period against the one before, as two bars. */
  compare?: { now: number; before: number; nowLabel: string; beforeLabel: string }
  /** A grid of covers / photos (top songs on the intro). */
  mosaic?: { kind: ArtKind; name: string; artist?: string }[]
  /** #1 big (cover, name, numbers), with `list` as the runners-up under it. */
  hero?:   { kind: ArtKind; name: string; artist?: string; meta: string }
  /** Small numbers in a row (plays, days, per day). */
  chips?:  { value: string; label: string }[]
  /** Artists in rows of 1, 2, 3, 4 — biggest first — with their names. */
  pyramid?: { name: string; value: string }[]
  /** A few songs with a title over them ("Tuesday's soundtrack", "At 22:00 you play"). */
  songs?:  { title: string; items: { name: string; artist: string; plays: number }[] }
}

export interface StoryOpts {
  /** All time (buckets are years, named by `bucketLabels`). */
  all?:        boolean
  /** A finished period rather than "so far". */
  past?:       boolean
  /** Artists first heard in the period, when known. */
  newArtists?: number | null
  /** Most played in the peak hour / on the biggest day (storyData). */
  hourTracks?: { name: string; artist: string; uri: string | null; plays: number }[]
  dayTracks?:  { name: string; artist: string; uri: string | null; plays: number }[]
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

/** Short labels under a period's bars (sparse where there are many). */
export function barLabels(kind: SummaryKind, n: number, all: boolean, yearLabels?: string[]): string[] {
  if (all) return (yearLabels ?? []).map((y, i, a) => (a.length <= 8 || i % 2 === 0 || i === a.length - 1 ? `'${y.slice(-2)}` : ''))
  if (kind === 'week') return ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  if (kind === 'year') return ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  return Array.from({ length: n }, (_, i) => (i % 7 === 0 ? String(i + 1) : ''))
}

export function buildStory(c: PeriodComparison, opts: StoryOpts = {}): StorySlide[] {
  const s = c.current, kind = s.kind
  const w = opts.all ? 'all time' : WORD[kind]
  const pal = (i: number) => PALETTES[i % PALETTES.length]
  if (!s.plays) {
    return [{ id: 'empty', kicker: opts.all ? 'All time' : `Your ${w}`, big: 'Nothing yet', sub: `Play something and your ${w} fills up here.`, palette: pal(0) }]
  }
  const slides: StorySlide[] = []
  const since = new Date(s.start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  // ── Intro: the period, over a wall of what you played ──
  slides.push(opts.all
    ? { id: 'intro', kicker: 'Everything you’ve played', big: 'All time', sub: `Since ${since} · tap to skip ahead · hold to pause`, palette: pal(0) }
    : { id: 'intro', kicker: `Your ${w} in music`, big: periodTitle(s), sub: 'Tap to skip ahead · hold to pause', palette: pal(0) })
  // Up to 12: the screen shows as many rows as fit.
  if (s.topTracks.length >= 3) slides[0].mosaic = s.topTracks.slice(0, 12).map(x => ({ kind: 'track' as const, name: x.name, artist: x.sub }))

  // ── Time: how long, across the period (biggest day picked out), vs before, in numbers ──
  const vs = opts.past ? `the ${w} before` : `last ${w}`
  const peak = s.buckets.reduce((best, v, i) => (v > s.buckets[best] ? i : best), 0)
  const peakName = opts.all ? (s.bucketLabels?.[peak] ?? '') : bucketName(kind, s.start, peak)
  const peakWord = opts.all ? 'year' : kind === 'year' ? 'month' : 'day'
  const days = s.activeDays ?? 0
  const chips: { value: string; label: string }[] = [{ value: s.plays.toLocaleString(), label: s.plays === 1 ? 'play' : 'plays' }]
  if (days > 0) {
    chips.push({ value: days.toLocaleString(), label: days === 1 ? 'day with music' : 'days with music' })
    chips.push({ value: fmtListen(Math.round(s.ms / days)), label: 'per listening day' })
  }
  slides.push({
    id: 'time', kicker: 'You listened for', big: fmtListen(s.ms), roll: true, palette: pal(1),
    sub: c.deltaMs === null ? undefined : `${c.deltaMs >= 0 ? 'Up' : 'Down'} ${Math.abs(c.deltaMs)}% on ${vs}`,
    ...(s.buckets[peak] > 0 ? {
      bars: { values: s.buckets, labels: barLabels(kind, s.buckets.length, !!opts.all, s.bucketLabels), peak, peakText: `Biggest ${peakWord}: ${peakName} · ${fmtListen(s.buckets[peak])}` },
    } : {}),
    ...(c.deltaMs !== null && c.previous.ms > 0 ? {
      compare: {
        now: s.ms, before: c.previous.ms,
        nowLabel: opts.past ? `That ${w}` : `This ${w} so far`,
        beforeLabel: opts.past ? `The ${w} before` : `Last ${w}, same point`,
      },
    } : {}),
    chips,
    ...(opts.dayTracks?.length ? { songs: { title: `${peakName}’s soundtrack`, items: opts.dayTracks } } : {}),
  })

  // ── Top artists: #1 big, the rest under it ──
  const a = s.topArtists[0]
  if (a) {
    slides.push({
      id: 'artists', kicker: 'The artist you couldn’t stop playing', big: '', palette: pal(2),
      hero: { kind: 'artist', name: a.name, meta: `${fmtListen(a.ms)} · ${a.plays.toLocaleString()} plays` },
      listKind: 'artist',
      list: s.topArtists.slice(1, 12).map(x => ({ name: x.name, value: fmtListen(x.ms) })),
    })
  }

  // ── Top songs: #1 big, the rest under it ──
  const t = s.topTracks[0]
  if (t) {
    slides.push({
      id: 'tracks', kicker: 'On repeat', big: '', palette: pal(3),
      hero: { kind: 'track', name: t.name, artist: t.sub, meta: `${t.sub ? t.sub + ' · ' : ''}${t.plays.toLocaleString()} plays` },
      listKind: 'track',
      list: s.topTracks.slice(1, 12).map(x => ({ name: x.name, sub: x.sub, value: `${x.plays}×` })),
    })
  }

  // ── When in the day ──
  if (s.clock && s.clock.some(v => v > 0)) {
    const h = s.clock.indexOf(Math.max(...s.clock))
    slides.push({
      id: 'clock', kicker: 'You’re', big: clockPersona(h), sub: `Most of your listening: ${two(h)}–${two((h + 1) % 24)}`, palette: pal(5), clock: s.clock,
      ...(opts.hourTracks?.length ? { songs: { title: `At ${two(h)} you play`, items: opts.hourTracks } } : {}),
    })
  }

  // ── Range: how many, and the biggest ones, biggest first ──
  const fresh = opts.newArtists && opts.newArtists > 0 ? ` · ${opts.newArtists.toLocaleString()} of them new to you` : ''
  // Just the number rolls (a rolling number can't wrap: "12,345 artists" in the display
  // face is wider than a phone), the unit goes in the line under it.
  slides.push({
    id: 'range', kicker: 'You heard', big: s.artists.toLocaleString(), roll: true, sub: `${s.artists === 1 ? 'artist' : 'artists'} and ${s.tracks.toLocaleString()} different songs${fresh}`, palette: pal(5),
    ...(s.topArtists.length >= 3 ? { pyramid: s.topArtists.slice(0, 10).map(x => ({ name: x.name, value: fmtListen(x.ms) })) } : {}),
  })

  slides.push(opts.all
    ? { id: 'outro', kicker: 'That’s all of it, so far', big: 'Keep listening', sub: 'Share your card, or tap to close.', palette: pal(0), share: true }
    : { id: 'outro', kicker: opts.past ? `That was your ${w}` : `That’s your ${w}`, big: opts.past ? 'Nice one' : 'See you next one', sub: 'Share your card, or tap to close.', palette: pal(0), share: true })
  return slides
}

// ─── music ────────────────────────────────────────────────────────────────────
export interface SlideSong { name: string; artist?: string; uri?: string | null }

/**
 * The song under each slide: the top-songs slide plays your #1, the top-artists slide
 * that artist's most-played song, every other slide a different one of your top songs,
 * shuffled (the same order every time for the same period). Null when there are no songs.
 */
export function slideSongs(slides: StorySlide[], tracks: { name: string; sub?: string; uri?: string }[], seed = 0): (SlideSong | null)[] {
  if (!tracks.length) return slides.map(() => null)
  const song = (t: { name: string; sub?: string; uri?: string }): SlideSong => ({ name: t.name, artist: t.sub, uri: t.uri })
  const top = tracks[0]
  const artistSlide = slides.find(s => s.id === 'artists')?.hero?.name
  const byArtist = artistSlide ? tracks.find(t => t.sub === artistSlide) ?? top : top
  // A seeded shuffle of the rest, so the same story always sounds the same.
  const pool = tracks.slice(1).filter(t => t !== byArtist)
  let x = (seed >>> 0) || 1
  for (let i = pool.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) >>> 0
    const j = x % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  let k = 0
  return slides.map(s => {
    if (s.id === 'tracks') return song(top)
    if (s.id === 'artists') return song(byArtist)
    if (!pool.length) return song(top)
    return song(pool[k++ % pool.length])
  })
}

// ─── share card line ──────────────────────────────────────────────────────────
/** One line about you for the share card: "Night owl · Biggest day: Tuesday · 12 new artists". */
export function cardLine(c: PeriodComparison, opts: { all?: boolean; newArtists?: number | null } = {}): string {
  const s = c.current
  const parts: string[] = []
  if (s.clock && s.clock.some(v => v > 0)) {
    const persona = clockPersona(s.clock.indexOf(Math.max(...s.clock))).replace(/^An? /, '')
    parts.push(persona.charAt(0).toUpperCase() + persona.slice(1))
  }
  const peak = s.buckets.reduce((best, v, i) => (v > s.buckets[best] ? i : best), 0)
  if (s.buckets[peak] > 0) {
    const name = opts.all ? (s.bucketLabels?.[peak] ?? '') : bucketName(s.kind, s.start, peak)
    parts.push(`Biggest ${opts.all ? 'year' : s.kind === 'year' ? 'month' : 'day'}: ${name}`)
  }
  if (opts.newArtists && opts.newArtists > 0) parts.push(`${opts.newArtists.toLocaleString()} new ${opts.newArtists === 1 ? 'artist' : 'artists'}`)
  return parts.join(' · ')
}
