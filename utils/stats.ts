/**
 * The stats engine (2.0 Phase 3) — every number the explorer shows, computed in SQL
 * straight from the play database (utils/playDb). Nothing is loaded into JS but the
 * answers, so "All time" over a 100k-play import costs the same as "this week".
 *
 * Local time: periods, days, the listening clock and weekdays follow the phone's
 * clock. Pass `offsetSec` (seconds east of UTC — `localOffsetSec()`); `t` in the
 * database is UTC seconds and every query works on `t + offsetSec`.
 *
 * Music only: plays without a track name (podcasts, unknown rows) are left out,
 * like everywhere else in the app.
 */
import { db } from '@/utils/playDb'

export type StatsKind = 'week' | 'month' | 'year' | 'all'

export interface Ranked { name: string; sub?: string; ms: number; plays: number; uri?: string }

export interface PeriodStats {
  kind:       StatsKind
  /** UTC seconds, [start, end). For 'all': first play → just after the last. */
  start:      number
  end:        number
  ms:         number
  plays:      number
  artists:    number
  tracks:     number
  albums:     number
  /** Days in the period with at least one play. */
  activeDays: number
  /** ms per bucket: week → Mon..Sun, month → each day, year → Jan..Dec, all → each year. */
  buckets:    number[]
  bucketLabels: string[]
  /** ms by local hour, 0..23. */
  clock:      number[]
  /** ms by weekday, Mon..Sun. */
  weekdays:   number[]
  topArtists: Ranked[]
  topTracks:  Ranked[]
  topAlbums:  Ranked[]
}

const DAY = 86_400
const MUSIC = 'track IS NOT NULL'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** The phone's current offset from UTC, in seconds (east positive). */
export function localOffsetSec(now: Date = new Date()): number {
  return -now.getTimezoneOffset() * 60
}

// ─── periods ──────────────────────────────────────────────────────────────────
/**
 * [start, end) in UTC seconds of the `kind` period containing `now`, shifted back by
 * `back` periods. Weeks start on Monday. Boundaries are local midnights.
 */
export function periodRange(kind: Exclude<StatsKind, 'all'>, now: Date, offsetSec: number, back = 0): { start: number; end: number } {
  // Work in "local seconds" (UTC fields of a shifted date = local wall clock).
  const local = new Date(now.getTime() + offsetSec * 1000)
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate()
  let s: number, e: number
  if (kind === 'week') {
    const dow = (local.getUTCDay() + 6) % 7               // Mon = 0
    s = Date.UTC(y, m, d - dow - 7 * back) / 1000
    e = s + 7 * DAY
  } else if (kind === 'month') {
    s = Date.UTC(y, m - back, 1) / 1000
    e = Date.UTC(y, m - back + 1, 1) / 1000
  } else {
    s = Date.UTC(y - back, 0, 1) / 1000
    e = Date.UTC(y - back + 1, 0, 1) / 1000
  }
  return { start: s - offsetSec, end: e - offsetSec }
}

/** First and last play we hold (UTC seconds), or null when the database is empty. */
export function playSpan(): { first: number; last: number } | null {
  const r = db().getFirstSync<{ a: number | null; b: number | null }>(`SELECT MIN(t) AS a, MAX(t) AS b FROM plays WHERE ${MUSIC}`, [])
  return r?.a == null || r.b == null ? null : { first: r.a, last: r.b }
}

// ─── the summary ──────────────────────────────────────────────────────────────
/**
 * Everything about one period. `cutoff` (UTC seconds) stops counting early — pass
 * the same elapsed point to compare "this week so far" with last week.
 */
export function periodStats(
  kind: StatsKind,
  opts: { now?: Date; offsetSec?: number; back?: number; cutoff?: number; topN?: number } = {},
): PeriodStats {
  const now = opts.now ?? new Date()
  const off = opts.offsetSec ?? localOffsetSec(now)
  const topN = opts.topN ?? 10
  const d = db()

  let start: number, end: number
  if (kind === 'all') {
    const span = playSpan()
    start = span?.first ?? Math.floor(now.getTime() / 1000)
    end = (span?.last ?? start) + 1
  } else {
    ({ start, end } = periodRange(kind, now, off, opts.back ?? 0))
  }
  const until = Math.min(end, opts.cutoff ?? end)
  const W = `${MUSIC} AND t >= ? AND t < ?`
  const P = [start, until]

  const tot = d.getFirstSync<{ ms: number | null; n: number; a: number; tr: number; al: number; days: number }>(
    `SELECT SUM(ms) AS ms, COUNT(*) AS n,
            COUNT(DISTINCT artist) AS a,
            COUNT(DISTINCT track || char(0) || IFNULL(artist, '')) AS tr,
            COUNT(DISTINCT CASE WHEN album IS NOT NULL THEN album || char(0) || IFNULL(artist, '') END) AS al,
            COUNT(DISTINCT CAST((t + ?) / ${DAY} AS INTEGER)) AS days
     FROM plays WHERE ${W}`,
    [off, ...P],
  )

  // Buckets
  let buckets: number[], bucketLabels: string[]
  if (kind === 'week' || kind === 'month') {
    const n = Math.round((end - start) / DAY)
    buckets = new Array(n).fill(0)
    for (const r of d.getAllSync<{ b: number; ms: number }>(
      `SELECT CAST((t - ?) / ${DAY} AS INTEGER) AS b, SUM(ms) AS ms FROM plays WHERE ${W} GROUP BY b`, [start, ...P],
    )) if (r.b >= 0 && r.b < n) buckets[r.b] = r.ms
    bucketLabels = kind === 'week' ? WEEKDAYS : buckets.map((_, i) => String(i + 1))
  } else if (kind === 'year') {
    buckets = new Array(12).fill(0)
    for (const r of d.getAllSync<{ b: number; ms: number }>(
      `SELECT CAST(strftime('%m', t + ?, 'unixepoch') AS INTEGER) - 1 AS b, SUM(ms) AS ms FROM plays WHERE ${W} GROUP BY b`, [off, ...P],
    )) buckets[r.b] = r.ms
    bucketLabels = MONTHS
  } else {
    const y0 = new Date((start + off) * 1000).getUTCFullYear()
    const y1 = new Date((end - 1 + off) * 1000).getUTCFullYear()
    buckets = new Array(y1 - y0 + 1).fill(0)
    for (const r of d.getAllSync<{ y: number; ms: number }>(
      `SELECT CAST(strftime('%Y', t + ?, 'unixepoch') AS INTEGER) AS y, SUM(ms) AS ms FROM plays WHERE ${W} GROUP BY y`, [off, ...P],
    )) if (r.y >= y0 && r.y <= y1) buckets[r.y - y0] = r.ms
    bucketLabels = buckets.map((_, i) => String(y0 + i))
  }

  const clock = new Array(24).fill(0)
  for (const r of d.getAllSync<{ h: number; ms: number }>(
    `SELECT CAST(strftime('%H', t + ?, 'unixepoch') AS INTEGER) AS h, SUM(ms) AS ms FROM plays WHERE ${W} GROUP BY h`, [off, ...P],
  )) clock[r.h] = r.ms

  const weekdays = new Array(7).fill(0)
  for (const r of d.getAllSync<{ w: number; ms: number }>(
    `SELECT CAST(strftime('%w', t + ?, 'unixepoch') AS INTEGER) AS w, SUM(ms) AS ms FROM plays WHERE ${W} GROUP BY w`, [off, ...P],
  )) weekdays[(r.w + 6) % 7] = r.ms                       // Sun = 0 → Mon-first

  const topArtists = d.getAllSync<Ranked>(
    `SELECT artist AS name, SUM(ms) AS ms, COUNT(*) AS plays FROM plays
     WHERE ${W} AND artist IS NOT NULL GROUP BY artist
     ORDER BY ms DESC, plays DESC, name LIMIT ?`, [...P, topN],
  )
  const topTracks = d.getAllSync<{ name: string; sub: string | null; ms: number; plays: number; uri: string | null }>(
    `SELECT track AS name, artist AS sub, SUM(ms) AS ms, COUNT(*) AS plays, MAX(NULLIF(uri, '')) AS uri FROM plays
     WHERE ${W} GROUP BY track, artist
     ORDER BY plays DESC, ms DESC, name LIMIT ?`, [...P, topN],
  ).map(r => ({ name: r.name, sub: r.sub ?? undefined, ms: r.ms, plays: r.plays, uri: r.uri ?? undefined }))
  const topAlbums = d.getAllSync<{ name: string; sub: string | null; ms: number; plays: number }>(
    `SELECT album AS name, artist AS sub, SUM(ms) AS ms, COUNT(*) AS plays FROM plays
     WHERE ${W} AND album IS NOT NULL GROUP BY album, artist
     ORDER BY ms DESC, plays DESC, name LIMIT ?`, [...P, topN],
  ).map(r => ({ name: r.name, sub: r.sub ?? undefined, ms: r.ms, plays: r.plays }))

  return {
    kind, start, end,
    ms: tot?.ms ?? 0, plays: tot?.n ?? 0,
    artists: tot?.a ?? 0, tracks: tot?.tr ?? 0, albums: tot?.al ?? 0, activeDays: tot?.days ?? 0,
    buckets, bucketLabels, clock, weekdays, topArtists, topTracks, topAlbums,
  }
}

/** % change, or null when there's nothing to compare against. */
function pct(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
}

/** This period so far vs the previous one cut at the same elapsed point. */
export function comparePeriod(kind: Exclude<StatsKind, 'all'>, opts: { now?: Date; offsetSec?: number; topN?: number } = {}) {
  const now = opts.now ?? new Date()
  const off = opts.offsetSec ?? localOffsetSec(now)
  const cur = periodRange(kind, now, off)
  const prev = periodRange(kind, now, off, 1)
  const elapsed = Math.min(Math.floor(now.getTime() / 1000), cur.end) - cur.start
  const current  = periodStats(kind, { now, offsetSec: off, topN: opts.topN, cutoff: Math.floor(now.getTime() / 1000) + 1 })
  const previous = periodStats(kind, { now, offsetSec: off, topN: opts.topN, back: 1, cutoff: prev.start + elapsed })
  return { current, previous, deltaMs: pct(current.ms, previous.ms), deltaPlays: pct(current.plays, previous.plays) }
}

// ─── history ──────────────────────────────────────────────────────────────────
export interface HistoryFilter {
  /** Free text: every word must appear in the track, artist or album. */
  query?:  string
  artist?: string
  track?:  string     // with `artist`, one song
  album?:  string
}

export interface HistoryPlay { t: number; uri: string; ms: number; track: string; artist: string | null; album: string | null }

/** Keyset cursor: the last play of the previous page. */
export interface HistoryCursor { t: number; uri: string }

/** Escape LIKE wildcards so a search for "100%" means the text "100%". */
function likeTerm(w: string): string {
  return `%${w.replace(/[\\%_]/g, c => '\\' + c)}%`
}

function where(f: HistoryFilter): { sql: string; args: (string | number)[] } {
  const parts = [MUSIC]
  const args: (string | number)[] = []
  if (f.artist) { parts.push('artist = ?'); args.push(f.artist) }
  if (f.track)  { parts.push('track = ?');  args.push(f.track) }
  if (f.album)  { parts.push('album = ?');  args.push(f.album) }
  for (const w of (f.query ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 8)) {
    parts.push(`(track LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\')`)
    const l = likeTerm(w)
    args.push(l, l, l)
  }
  return { sql: parts.join(' AND '), args }
}

/** One page of plays, newest first. Pass the last play of a page as `after` for the next. */
export function historyPage(f: HistoryFilter, after: HistoryCursor | null, limit = 60): HistoryPlay[] {
  const w = where(f)
  const page = after ? ' AND (t < ? OR (t = ? AND uri < ?))' : ''
  const args = after ? [...w.args, after.t, after.t, after.uri] : w.args
  return db().getAllSync<HistoryPlay>(
    `SELECT t, uri, ms, track, artist, album FROM plays WHERE ${w.sql}${page} ORDER BY t DESC, uri DESC LIMIT ?`,
    [...args, limit],
  )
}

/** How many plays (and how much time) match the filter. */
export function historyTotals(f: HistoryFilter): { plays: number; ms: number; first: number | null; last: number | null } {
  const w = where(f)
  const r = db().getFirstSync<{ n: number; ms: number | null; a: number | null; b: number | null }>(
    `SELECT COUNT(*) AS n, SUM(ms) AS ms, MIN(t) AS a, MAX(t) AS b FROM plays WHERE ${w.sql}`, w.args,
  )
  return { plays: r?.n ?? 0, ms: r?.ms ?? 0, first: r?.a ?? null, last: r?.b ?? null }
}

/** Local day number (days since 1970-01-01, local) of a UTC-seconds time. */
export function localDay(t: number, offsetSec: number): number {
  return Math.floor((t + offsetSec) / DAY)
}

/** Per-day totals for local days [fromDay, toDay] under the filter. */
export function dayTotals(f: HistoryFilter, fromDay: number, toDay: number, offsetSec: number): Map<number, { plays: number; ms: number }> {
  const w = where(f)
  const out = new Map<number, { plays: number; ms: number }>()
  for (const r of db().getAllSync<{ d: number; n: number; ms: number }>(
    `SELECT CAST((t + ?) / ${DAY} AS INTEGER) AS d, COUNT(*) AS n, SUM(ms) AS ms FROM plays
     WHERE ${w.sql} AND t >= ? AND t < ? GROUP BY d`,
    [offsetSec, ...w.args, fromDay * DAY - offsetSec, (toDay + 1) * DAY - offsetSec],
  )) out.set(r.d, { plays: r.n, ms: r.ms })
  return out
}
