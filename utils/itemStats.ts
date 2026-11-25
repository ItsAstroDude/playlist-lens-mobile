/**
 * Artist and song pages (2.0.43) — everything about one artist or one song, in SQL on
 * the play database. Same conventions as utils/stats: UTC seconds in the database,
 * local time via `offsetSec`, music only.
 *
 * An artist is matched by name (the export's album-artist field); a song by its title
 * and artist together, so two songs called "Intro" stay apart.
 */
import { all, first, runSync, runAsync, playsSignature, type Job } from '@/utils/sqlJob'
import { localOffsetSec, type Ranked } from '@/utils/stats'

const DAY = 86_400
const MUSIC = 'track IS NOT NULL'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Up to this many months, "over time" is drawn month by month; beyond, by year. */
const MAX_MONTH_BARS = 36

export type ItemRef =
  | { kind: 'artist'; artist: string }
  | { kind: 'track'; track: string; artist: string }

export interface ItemRun { length: number; startDay: number; endDay: number }

export interface ItemSeries {
  unit:   'month' | 'year'
  /** One bar per month (or year), from the first play to the last, gaps included. */
  ms:     number[]
  /** "Mar 2024" / "2024" per bar. */
  labels: string[]
  /** Index of the biggest bar. */
  peak:   number
}

export interface ItemStats {
  ref:     ItemRef
  plays:   number
  ms:      number
  /** Local days with at least one play. */
  days:    number
  /** The first-ever play (UTC seconds) and what it was. */
  first:   { t: number; track: string; album: string | null } | null
  last:    number | null
  /**
   * Lifetime rank: artists by time listened, songs by plays (as in Wrapped).
   * `of` is how many artists (or songs) there are in all.
   */
  rank:    { n: number; of: number } | null
  /** This item's share of all listening time, 0–1. */
  share:   number
  series:  ItemSeries | null
  /** ms by local hour 0..23, and by weekday Mon..Sun. */
  clock:   number[]
  weekdays: number[]
  /** The longest stretch of days in a row with this artist (or song). */
  longestRun: ItemRun | null
  /** The day with the most time (artist) or the most plays (song). */
  biggestDay: { day: number; plays: number; ms: number } | null
  /** Artist pages: their songs by plays, and their albums by time. */
  topTracks: Ranked[]
  topAlbums: Ranked[]
  /** How many different songs of theirs you've played (artist pages). */
  trackCount: number
  /** Song pages: the Spotify URI and album it's most often played from. */
  uri:     string | null
  album:   string | null
}

function filterOf(ref: ItemRef): { sql: string; args: string[] } {
  return ref.kind === 'artist'
    ? { sql: `${MUSIC} AND artist = ?`, args: [ref.artist] }
    : { sql: `${MUSIC} AND track = ? AND artist = ?`, args: [ref.track, ref.artist] }
}

/** Local day number → "Mar 2024"-style label parts. */
function ymOfDay(day: number): { y: number; m: number } {
  const d = new Date(day * DAY * 1000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
}

/** Month (or year) bars from per-day totals, first play to last, empty ones included. */
export function seriesFromDays(byDay: { d: number; ms: number }[]): ItemSeries | null {
  if (!byDay.length) return null
  let lo = Infinity, hi = -Infinity
  for (const r of byDay) { if (r.d < lo) lo = r.d; if (r.d > hi) hi = r.d }
  const a = ymOfDay(lo), b = ymOfDay(hi)
  const monthsSpan = (b.y - a.y) * 12 + (b.m - a.m) + 1
  let ms: number[], labels: string[], unit: ItemSeries['unit']
  if (monthsSpan <= MAX_MONTH_BARS) {
    unit = 'month'
    ms = new Array(monthsSpan).fill(0)
    for (const r of byDay) { const k = ymOfDay(r.d); ms[(k.y - a.y) * 12 + (k.m - a.m)] += r.ms }
    labels = ms.map((_, i) => { const m = (a.m + i) % 12, y = a.y + Math.floor((a.m + i) / 12); return `${MONTHS[m]} ${y}` })
  } else {
    unit = 'year'
    ms = new Array(b.y - a.y + 1).fill(0)
    for (const r of byDay) ms[ymOfDay(r.d).y - a.y] += r.ms
    labels = ms.map((_, i) => String(a.y + i))
  }
  let peak = 0
  for (let i = 1; i < ms.length; i++) if (ms[i] > ms[peak]) peak = i
  return { unit, ms, labels, peak }
}

/** The longest run of consecutive day numbers (input: distinct days, any order). */
export function longestRunOf(days: number[]): ItemRun | null {
  if (!days.length) return null
  const s = [...days].sort((x, y) => x - y)
  let best: ItemRun = { length: 1, startDay: s[0], endDay: s[0] }
  let start = s[0]
  for (let i = 1; i < s.length; i++) {
    if (s[i] !== s[i - 1] + 1) start = s[i]
    const len = s[i] - start + 1
    // Ties go to the more recent run.
    if (len >= best.length) best = { length: len, startDay: start, endDay: s[i] }
  }
  return best
}

export function* itemStatsJob(ref: ItemRef, offsetSec = localOffsetSec()): Job<ItemStats> {
  const f = filterOf(ref)
  const off = Math.round(offsetSec)
  const DAYX = `CAST((t + ${off}) / ${DAY} AS INTEGER)`

  const tot: { n: number; ms: number | null; a: number | null; b: number | null } | null = yield first(
    `SELECT COUNT(*) AS n, SUM(ms) AS ms, MIN(t) AS a, MAX(t) AS b FROM plays WHERE ${f.sql}`, f.args)
  const plays = tot?.n ?? 0
  const ms = tot?.ms ?? 0

  const empty: ItemStats = {
    ref, plays: 0, ms: 0, days: 0, first: null, last: null, rank: null, share: 0, series: null,
    clock: new Array(24).fill(0), weekdays: new Array(7).fill(0), longestRun: null, biggestDay: null,
    topTracks: [], topAlbums: [], trackCount: 0, uri: null, album: null,
  }
  if (!plays) return empty

  const firstRow: { t: number; track: string; album: string | null } | null = yield first(
    `SELECT t, track, album FROM plays WHERE ${f.sql} ORDER BY t, uri LIMIT 1`, f.args)

  const byDay: { d: number; ms: number; n: number }[] = yield all(
    `SELECT ${DAYX} AS d, SUM(ms) AS ms, COUNT(*) AS n FROM plays WHERE ${f.sql} GROUP BY d`, f.args)

  const weekdays = new Array(7).fill(0)
  for (const r of byDay) weekdays[(((r.d + 3) % 7) + 7) % 7] += r.ms    // day 0 was a Thursday → Mon = 0

  const clock = new Array(24).fill(0)
  const byHour: { h: number; ms: number }[] = yield all(
    `SELECT CAST(((t + ${off}) % ${DAY}) / 3600 AS INTEGER) AS h, SUM(ms) AS ms FROM plays WHERE ${f.sql} GROUP BY h`, f.args)
  for (const r of byHour) if (r.h >= 0 && r.h < 24) clock[r.h] = r.ms

  // Biggest day: most time for an artist, most plays for a song ("on repeat").
  let big = byDay[0]
  for (const r of byDay) {
    const better = ref.kind === 'track'
      ? r.n > big.n || (r.n === big.n && (r.ms > big.ms || (r.ms === big.ms && r.d > big.d)))
      : r.ms > big.ms || (r.ms === big.ms && r.d > big.d)
    if (better) big = r
  }

  // Lifetime rank and share of all listening.
  const all_: { ms: number | null } | null = yield first(`SELECT SUM(ms) AS ms FROM plays WHERE ${MUSIC}`)
  let rank: ItemStats['rank']
  if (ref.kind === 'artist') {
    const r: { above: number; of: number } | null = yield first(
      `SELECT SUM(s > ?) AS above, COUNT(*) AS of FROM (
         SELECT SUM(ms) AS s FROM plays WHERE ${MUSIC} AND artist IS NOT NULL GROUP BY artist
       )`, [ms])
    rank = r ? { n: (r.above ?? 0) + 1, of: r.of } : null
  } else {
    const r: { above: number; of: number } | null = yield first(
      `SELECT SUM(n > ? OR (n = ? AND s > ?)) AS above, COUNT(*) AS of FROM (
         SELECT COUNT(*) AS n, SUM(ms) AS s FROM plays WHERE ${MUSIC} GROUP BY track, artist
       )`, [plays, plays, ms])
    rank = r ? { n: (r.above ?? 0) + 1, of: r.of } : null
  }

  let topTracks: Ranked[] = [], topAlbums: Ranked[] = [], trackCount = 0
  let uri: string | null = null, album: string | null = null
  if (ref.kind === 'artist') {
    const tr: { name: string; album: string | null; ms: number; plays: number; uri: string | null }[] = yield all(
      `SELECT track AS name, MAX(album) AS album, SUM(ms) AS ms, COUNT(*) AS plays, MAX(NULLIF(uri, '')) AS uri
       FROM plays WHERE ${f.sql} GROUP BY track ORDER BY plays DESC, ms DESC, name LIMIT 20`, f.args)
    topTracks = tr.map(r => ({ name: r.name, sub: r.album ?? undefined, ms: r.ms, plays: r.plays, uri: r.uri ?? undefined }))
    const al: { name: string; ms: number; plays: number }[] = yield all(
      `SELECT album AS name, SUM(ms) AS ms, COUNT(*) AS plays FROM plays
       WHERE ${f.sql} AND album IS NOT NULL GROUP BY album ORDER BY ms DESC, plays DESC, name LIMIT 6`, f.args)
    topAlbums = al
    const c: { n: number } | null = yield first(`SELECT COUNT(DISTINCT track) AS n FROM plays WHERE ${f.sql}`, f.args)
    trackCount = c?.n ?? 0
  } else {
    const u: { uri: string } | null = yield first(
      `SELECT uri FROM plays WHERE ${f.sql} AND uri != '' GROUP BY uri ORDER BY COUNT(*) DESC, uri LIMIT 1`, f.args)
    uri = u?.uri ?? null
    const a: { album: string } | null = yield first(
      `SELECT album FROM plays WHERE ${f.sql} AND album IS NOT NULL GROUP BY album ORDER BY COUNT(*) DESC, album LIMIT 1`, f.args)
    album = a?.album ?? null
  }

  return {
    ref, plays, ms,
    days: byDay.length,
    first: firstRow,
    last: tot?.b ?? null,
    rank,
    share: all_?.ms ? ms / all_.ms : 0,
    series: seriesFromDays(byDay),
    clock, weekdays,
    longestRun: longestRunOf(byDay.map(r => r.d)),
    biggestDay: { day: big.d, plays: big.n, ms: big.ms },
    topTracks, topAlbums, trackCount, uri, album,
  }
}

export function itemStats(ref: ItemRef, offsetSec = localOffsetSec()): ItemStats {
  return runSync(itemStatsJob(ref, offsetSec))
}

/** Whether we hold any plays of this artist or song (cheap: one index lookup). */
export function hasPlays(ref: ItemRef): boolean {
  const f = filterOf(ref)
  return !!runSync((function* (): Job<boolean> {
    const r: { x: number } | null = yield first(`SELECT 1 AS x FROM plays WHERE ${f.sql} LIMIT 1`, f.args)
    return !!r
  })())
}

// ─── cache ────────────────────────────────────────────────────────────────────
// Pages are many and small: kept in memory only (not saved on the phone like the big
// stats), the last few, until a play changes.
const MAX_CACHED = 24
const memo = new Map<string, { sig: string; value: Promise<ItemStats>; done?: ItemStats }>()

export function itemKey(ref: ItemRef): string {
  return ref.kind === 'artist' ? `a\u0000${ref.artist}` : `t\u0000${ref.track}\u0000${ref.artist}`
}

/** The page's numbers, off the UI thread. */
export function itemStatsAsync(ref: ItemRef, offsetSec = localOffsetSec()): Promise<ItemStats> {
  const key = itemKey(ref)
  const sig = `${playsSignature()}|${Math.round(offsetSec)}`
  const hit = memo.get(key)
  if (hit && hit.sig === sig) {
    memo.delete(key); memo.set(key, hit)               // most recent last
    return hit.value
  }
  const value = runAsync(itemStatsJob(ref, offsetSec))
  const entry: { sig: string; value: Promise<ItemStats>; done?: ItemStats } = { sig, value }
  memo.set(key, entry)
  value.then(v => { entry.done = v }, () => { if (memo.get(key) === entry) memo.delete(key) })
  while (memo.size > MAX_CACHED) memo.delete(memo.keys().next().value as string)
  return value
}

/** A page opened before (and no play since): its numbers, instantly. */
export function peekItemStats(ref: ItemRef, offsetSec = localOffsetSec()): ItemStats | null {
  const hit = memo.get(itemKey(ref))
  return hit && hit.sig === `${playsSignature()}|${Math.round(offsetSec)}` ? hit.done ?? null : null
}

/** Test hook. */
export function _clearItemCache(): void { memo.clear() }

// ─── links ────────────────────────────────────────────────────────────────────
/** Route to an artist's page. */
export function artistHref(artist: string) {
  return { pathname: '/artist' as const, params: { name: artist } }
}
/** Route to a song's page. */
export function songHref(track: string, artist: string) {
  return { pathname: '/song' as const, params: { name: track, artist } }
}
