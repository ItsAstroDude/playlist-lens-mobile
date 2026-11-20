/**
 * The stats engine (2.0 Phase 3) — every number the explorer shows, computed in SQL
 * straight from the play database (utils/playDb). Nothing is loaded into JS but the
 * answers, so "All time" over a 100k-play import costs the same as "this week".
 *
 * Local time: periods, days, the listening clock and weekdays follow the phone's
 * clock. Pass `offsetSec` (seconds east of UTC — `localOffsetSec()`); `t` in the
 * database is UTC seconds and every query works on `t + offsetSec`. One offset per
 * query: plays from the other side of a DST change land an hour off, which only
 * matters for plays within an hour of midnight.
 *
 * Music only: plays without a track name (podcasts, unknown rows) are left out,
 * like everywhere else in the app.
 */
import { db } from '@/utils/playDb'
import { all, first, exec, runSync, runAsync, cachedAsync, type Job } from '@/utils/sqlJob'
import { periodKeys, weekKey, seasonLabel, monthLabel, weekLabel, type PeriodKind } from '@/utils/periods'
import type { RecapBundle, RecapPeriod, WrappedStats } from '@/utils/wrapped'
import type { PeriodComparison, PeriodSummary, SummaryKind } from '@/utils/listening'

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
function* playSpanJob(): Job<{ first: number; last: number } | null> {
  const r: { a: number | null; b: number | null } | null = yield first(`SELECT MIN(t) AS a, MAX(t) AS b FROM plays WHERE ${MUSIC}`)
  return r?.a == null || r.b == null ? null : { first: r.a, last: r.b }
}
export function playSpan(): { first: number; last: number } | null { return runSync(playSpanJob()) }

/** Local day number → its calendar year and month (0-based), as on the phone's clock. */
function ymOfDay(day: number): { y: number; m: number } {
  const d = new Date(day * DAY * 1000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
}

// ─── the summary ──────────────────────────────────────────────────────────────
type StatsOpts = { now?: Date; offsetSec?: number; back?: number; cutoff?: number; topN?: number }

/**
 * Everything about one period. `cutoff` (UTC seconds) stops counting early — pass
 * the same elapsed point to compare "this week so far" with last week.
 * No per-play date formatting: hours, weekdays and days are integer arithmetic on
 * local seconds; months and years come from the per-day totals.
 */
export function* periodStatsJob(kind: StatsKind, opts: StatsOpts = {}): Job<PeriodStats> {
  const now = opts.now ?? new Date()
  const off = opts.offsetSec ?? localOffsetSec(now)
  const topN = opts.topN ?? 10

  let start: number, end: number
  if (kind === 'all') {
    const span: { first: number; last: number } | null = yield* playSpanJob()
    start = span?.first ?? Math.floor(now.getTime() / 1000)
    end = (span?.last ?? start) + 1
  } else {
    ({ start, end } = periodRange(kind, now, off, opts.back ?? 0))
  }
  const until = Math.min(end, opts.cutoff ?? end)
  const W = `${MUSIC} AND t >= ? AND t < ?`
  const P = [start, until]
  const LT = `(t + ${off})`

  const tot: { ms: number | null; n: number; a: number; tr: number; al: number } | null = yield first(
    `SELECT SUM(ms) AS ms, COUNT(*) AS n,
            COUNT(DISTINCT artist) AS a,
            COUNT(DISTINCT track || char(0) || IFNULL(artist, '')) AS tr,
            COUNT(DISTINCT CASE WHEN album IS NOT NULL THEN album || char(0) || IFNULL(artist, '') END) AS al
     FROM plays WHERE ${W}`, P)

  // Per local day: active days, every bucket kind and the weekday split.
  const byDay: { d: number; ms: number }[] = yield all(
    `SELECT CAST(${LT} / ${DAY} AS INTEGER) AS d, SUM(ms) AS ms FROM plays WHERE ${W} GROUP BY d`, P)

  const weekdays = new Array(7).fill(0)
  for (const r of byDay) weekdays[(((r.d + 3) % 7) + 7) % 7] += r.ms    // day 0 (1970-01-01) was a Thursday → Mon = 0

  let buckets: number[], bucketLabels: string[]
  if (kind === 'week' || kind === 'month') {
    const n = Math.round((end - start) / DAY)
    const d0 = Math.floor((start + off) / DAY)
    buckets = new Array(n).fill(0)
    for (const r of byDay) { const i = r.d - d0; if (i >= 0 && i < n) buckets[i] += r.ms }
    bucketLabels = kind === 'week' ? WEEKDAYS : buckets.map((_, i) => String(i + 1))
  } else if (kind === 'year') {
    buckets = new Array(12).fill(0)
    for (const r of byDay) buckets[ymOfDay(r.d).m] += r.ms
    bucketLabels = MONTHS
  } else {
    const y0 = new Date((start + off) * 1000).getUTCFullYear()
    const y1 = new Date((end - 1 + off) * 1000).getUTCFullYear()
    buckets = new Array(y1 - y0 + 1).fill(0)
    for (const r of byDay) { const y = ymOfDay(r.d).y; if (y >= y0 && y <= y1) buckets[y - y0] += r.ms }
    bucketLabels = buckets.map((_, i) => String(y0 + i))
  }

  const clock = new Array(24).fill(0)
  const byHour: { h: number; ms: number }[] = yield all(
    `SELECT CAST((${LT} % ${DAY}) / 3600 AS INTEGER) AS h, SUM(ms) AS ms FROM plays WHERE ${W} GROUP BY h`, P)
  for (const r of byHour) if (r.h >= 0 && r.h < 24) clock[r.h] = r.ms

  const topArtists: Ranked[] = yield all(
    `SELECT artist AS name, SUM(ms) AS ms, COUNT(*) AS plays FROM plays
     WHERE ${W} AND artist IS NOT NULL GROUP BY artist
     ORDER BY ms DESC, plays DESC, name LIMIT ?`, [...P, topN])
  const tracks: { name: string; sub: string | null; ms: number; plays: number; uri: string | null }[] = yield all(
    `SELECT track AS name, artist AS sub, SUM(ms) AS ms, COUNT(*) AS plays, MAX(NULLIF(uri, '')) AS uri FROM plays
     WHERE ${W} GROUP BY track, artist
     ORDER BY plays DESC, ms DESC, name LIMIT ?`, [...P, topN])
  const albums: { name: string; sub: string | null; ms: number; plays: number }[] = yield all(
    `SELECT album AS name, artist AS sub, SUM(ms) AS ms, COUNT(*) AS plays FROM plays
     WHERE ${W} AND album IS NOT NULL GROUP BY album, artist
     ORDER BY ms DESC, plays DESC, name LIMIT ?`, [...P, topN])

  return {
    kind, start, end,
    ms: tot?.ms ?? 0, plays: tot?.n ?? 0,
    artists: tot?.a ?? 0, tracks: tot?.tr ?? 0, albums: tot?.al ?? 0, activeDays: byDay.length,
    buckets, bucketLabels, clock, weekdays,
    topArtists,
    topTracks: tracks.map(r => ({ name: r.name, sub: r.sub ?? undefined, ms: r.ms, plays: r.plays, uri: r.uri ?? undefined })),
    topAlbums: albums.map(r => ({ name: r.name, sub: r.sub ?? undefined, ms: r.ms, plays: r.plays })),
  }
}

/** periodStats, synchronously — fine for a week / month / year (an index range). */
export function periodStats(kind: StatsKind, opts: StatsOpts = {}): PeriodStats {
  return runSync(periodStatsJob(kind, opts))
}

/** % change, or null when there's nothing to compare against. */
function pct(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
}

type Comparison = { current: PeriodStats; previous: PeriodStats; deltaMs: number | null; deltaPlays: number | null }

/** This period so far vs the previous one cut at the same elapsed point. */
function* comparePeriodJob(kind: Exclude<StatsKind, 'all'>, opts: { now?: Date; offsetSec?: number; topN?: number } = {}): Job<Comparison> {
  const now = opts.now ?? new Date()
  const off = opts.offsetSec ?? localOffsetSec(now)
  const cur = periodRange(kind, now, off)
  const prev = periodRange(kind, now, off, 1)
  const elapsed = Math.min(Math.floor(now.getTime() / 1000), cur.end) - cur.start
  const current: PeriodStats  = yield* periodStatsJob(kind, { now, offsetSec: off, topN: opts.topN, cutoff: Math.floor(now.getTime() / 1000) + 1 })
  const previous: PeriodStats = yield* periodStatsJob(kind, { now, offsetSec: off, topN: opts.topN, back: 1, cutoff: prev.start + elapsed })
  return { current, previous, deltaMs: pct(current.ms, previous.ms), deltaPlays: pct(current.plays, previous.plays) }
}
export function comparePeriod(kind: Exclude<StatsKind, 'all'>, opts: { now?: Date; offsetSec?: number; topN?: number } = {}): Comparison {
  return runSync(comparePeriodJob(kind, opts))
}

// ─── history ──────────────────────────────────────────────────────────────────
export interface HistoryFilter {
  /** Free text: every word must appear in the track, artist or album. */
  query?:  string
  artist?: string
  track?:  string     // with `artist`, one song
  album?:  string
  /** Time range, UTC seconds [from, to) — e.g. one local day from the heatmap. */
  from?:   number
  to?:     number
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
  if (f.from !== undefined) { parts.push('t >= ?'); args.push(f.from) }
  if (f.to !== undefined)   { parts.push('t < ?');  args.push(f.to) }
  for (const w of (f.query ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 8)) {
    parts.push(`(track LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\')`)
    const l = likeTerm(w)
    args.push(l, l, l)
  }
  return { sql: parts.join(' AND '), args }
}

/** One page of plays, newest first. Pass the last play of a page as `after` for the next. */
function* historyPageJob(f: HistoryFilter, after: HistoryCursor | null, limit = 60): Job<HistoryPlay[]> {
  const w = where(f)
  const page = after ? ' AND (t < ? OR (t = ? AND uri < ?))' : ''
  const args = after ? [...w.args, after.t, after.t, after.uri] : w.args
  return yield all(
    `SELECT t, uri, ms, track, artist, album FROM plays WHERE ${w.sql}${page} ORDER BY t DESC, uri DESC LIMIT ?`,
    [...args, limit])
}
export function historyPage(f: HistoryFilter, after: HistoryCursor | null, limit = 60): HistoryPlay[] {
  return runSync(historyPageJob(f, after, limit))
}

export interface HistoryTotals { plays: number; ms: number; first: number | null; last: number | null }

/** How many plays (and how much time) match the filter. */
function* historyTotalsJob(f: HistoryFilter): Job<HistoryTotals> {
  const w = where(f)
  const r: { n: number; ms: number | null; a: number | null; b: number | null } | null = yield first(
    `SELECT COUNT(*) AS n, SUM(ms) AS ms, MIN(t) AS a, MAX(t) AS b FROM plays WHERE ${w.sql}`, w.args)
  return { plays: r?.n ?? 0, ms: r?.ms ?? 0, first: r?.a ?? null, last: r?.b ?? null }
}
export function historyTotals(f: HistoryFilter): HistoryTotals { return runSync(historyTotalsJob(f)) }

/** Local day number (days since 1970-01-01, local) of a UTC-seconds time. */
export function localDay(t: number, offsetSec: number): number {
  return Math.floor((t + offsetSec) / DAY)
}

export type DayTotals = Map<number, { plays: number; ms: number }>

/** Per-day totals for local days [fromDay, toDay] under the filter. */
function* dayTotalsJob(f: HistoryFilter, fromDay: number, toDay: number, offsetSec: number): Job<DayTotals> {
  const w = where(f)
  const out: DayTotals = new Map()
  const rows: { d: number; n: number; ms: number }[] = yield all(
    `SELECT CAST((t + ?) / ${DAY} AS INTEGER) AS d, COUNT(*) AS n, SUM(ms) AS ms FROM plays
     WHERE ${w.sql} AND t >= ? AND t < ? GROUP BY d`,
    [offsetSec, ...w.args, fromDay * DAY - offsetSec, (toDay + 1) * DAY - offsetSec])
  for (const r of rows) out.set(r.d, { plays: r.n, ms: r.ms })
  return out
}
export function dayTotals(f: HistoryFilter, fromDay: number, toDay: number, offsetSec: number): DayTotals {
  return runSync(dayTotalsJob(f, fromDay, toDay, offsetSec))
}

/** A page of plays plus the day totals for the days it covers. */
function* pageWithDaysJob(f: HistoryFilter, after: HistoryCursor | null, offsetSec: number, limit: number): Job<{ page: HistoryPlay[]; days: DayTotals }> {
  const page = yield* historyPageJob(f, after, limit)
  const days: DayTotals = page.length
    ? yield* dayTotalsJob(f, localDay(page[page.length - 1].t, offsetSec), localDay(page[0].t, offsetSec), offsetSec)
    : new Map()
  return { page, days }
}

/**
 * History screen, off the UI thread (a search is a scan of every play): the first page,
 * its day totals and the filter's totals; then `historyMoreAsync` for each next page.
 */
export function historyStartAsync(f: HistoryFilter, offsetSec: number, limit: number) {
  return runAsync((function* () {
    const first_ = yield* pageWithDaysJob(f, null, offsetSec, limit)
    const totals = yield* historyTotalsJob(f)
    return { ...first_, totals }
  })())
}
export function historyMoreAsync(f: HistoryFilter, after: HistoryCursor, offsetSec: number, limit: number) {
  return runAsync(pageWithDaysJob(f, after, offsetSec, limit))
}

// ─── adapters for the 1.x screens ─────────────────────────────────────────────
// Wrapped's period views, Story mode and the home strip were built on
// utils/listening's PeriodComparison (ms epochs, UTC). These give them the same shape
// from the engine, in local time.

function toSummary(s: PeriodStats): PeriodSummary {
  return {
    kind: s.kind as SummaryKind,
    start: s.start * 1000, end: s.end * 1000,
    ms: s.ms, plays: s.plays, artists: s.artists, tracks: s.tracks,
    buckets: s.buckets,
    topArtists: s.topArtists, topTracks: s.topTracks, topAlbums: s.topAlbums.slice(0, 3),
  }
}

function toComparison(c: Comparison): PeriodComparison {
  return { current: toSummary(c.current), previous: toSummary(c.previous), deltaMs: c.deltaMs, deltaPlays: c.deltaPlays }
}

/** `comparePeriod` in the PeriodComparison shape (top 5, albums top 3, like before). */
export function periodComparison(kind: SummaryKind, now: Date = new Date(), offsetSec = localOffsetSec(now)): PeriodComparison {
  return toComparison(comparePeriod(kind, { now, offsetSec, topN: 5 }))
}

/**
 * The same, off the UI thread and cached — for a year, which is a few hundred
 * milliseconds of SQL on a phone (a week is ~1 ms and stays synchronous).
 * Recomputed when a play arrives or the hour changes ("so far" moves with time).
 */
export function periodComparisonAsync(kind: SummaryKind, now: Date = new Date()): Promise<PeriodComparison> {
  const off = localOffsetSec(now)
  const hour = Math.floor(now.getTime() / 3_600_000)
  return cachedAsync(`cmp.${kind}`, `${off}:${hour}`, () => (function* () {
    return toComparison(yield* comparePeriodJob(kind, { now, offsetSec: off, topN: 5 }))
  })())
}

/** Index of the bucket `now` falls in (today's bar / this month's bar). */
export function currentBucket(kind: SummaryKind, now: Date = new Date(), offsetSec = localOffsetSec(now)): number {
  if (kind === 'year') return new Date(now.getTime() + offsetSec * 1000).getUTCMonth()
  const { start } = periodRange(kind, now, offsetSec)
  return Math.floor((Math.floor(now.getTime() / 1000) - start) / DAY)
}

// ─── recaps ───────────────────────────────────────────────────────────────────
// Recaps (week / month / season / year) straight from the play database, local time,
// same keys and shape as the 1.x bundle so saved seasons and hidden years still match.

/** Weeks and months are rolling: only the most recent this many (as before). */
export const RECENT_RECAPS = 14

const SEASON_SQL = `(CASE WHEN m <= 2 THEN y - 1 ELSE y END) || '-' ||
  (CASE WHEN m = 12 OR m <= 2 THEN 'Winter' WHEN m <= 5 THEN 'Spring' WHEN m <= 8 THEN 'Summer' ELSE 'Autumn' END)`

/** SQL for the period key of each row of the recap table (y, m, w precomputed). */
const KEY_SQL: Record<PeriodKind, string> = {
  year:   `CAST(y AS TEXT)`,
  month:  `printf('%04d-%02d', y, m)`,
  season: SEASON_SQL,
  week:   `CAST(w AS TEXT)`,
}

function sortVal(kind: PeriodKind, key: string): number {
  if (kind === 'year') return Number(key)
  if (kind === 'season') {
    const [y, n] = key.split('-')
    return Number(y) * 10 + ({ Spring: 0, Summer: 1, Autumn: 2, Winter: 3 } as Record<string, number>)[n]
  }
  if (kind === 'month') { const [y, m] = key.split('-'); return Number(y) * 100 + Number(m) }
  const [y, w] = key.split('-W'); return Number(y) * 100 + Number(w)
}

function labelOf(kind: PeriodKind, key: string): string {
  return kind === 'year' ? key : kind === 'season' ? seasonLabel(key) : kind === 'month' ? monthLabel(key) : weekLabel(key)
}

function* recapListJob(T: string, kind: PeriodKind, sinceT: number, cap?: number): Job<RecapPeriod[]> {
  const p = `p AS (SELECT ${KEY_SQL[kind]} AS k, ms, artist, track, album, uri FROM ${T} WHERE t >= ${Math.floor(sinceT)})`
  const totals: { k: string; ms: number; n: number }[] = yield all(`WITH ${p} SELECT k, SUM(ms) AS ms, COUNT(*) AS n FROM p GROUP BY k`)
  if (!totals.length) return []
  const artists: { k: string; name: string; ms: number; plays: number }[] = yield all(
    `WITH ${p} SELECT k, name, ms, plays FROM (
       SELECT k, artist AS name, SUM(ms) AS ms, COUNT(*) AS plays,
              ROW_NUMBER() OVER (PARTITION BY k ORDER BY SUM(ms) DESC, artist) AS rn
       FROM p WHERE artist IS NOT NULL GROUP BY k, artist
     ) WHERE rn <= 10 ORDER BY k, rn`)
  const tracks: { k: string; name: string; artist: string | null; plays: number; ms: number; uri: string | null }[] = yield all(
    `WITH ${p} SELECT k, name, artist, plays, ms, uri FROM (
       SELECT k, track AS name, artist, COUNT(*) AS plays, SUM(ms) AS ms, MAX(NULLIF(uri, '')) AS uri,
              ROW_NUMBER() OVER (PARTITION BY k ORDER BY COUNT(*) DESC, SUM(ms) DESC, track) AS rn
       FROM p GROUP BY k, track, artist
     ) WHERE rn <= 10 ORDER BY k, rn`)
  const albums: { k: string; name: string; ms: number }[] = yield all(
    `WITH ${p} SELECT k, name, ms FROM (
       SELECT k, album AS name, SUM(ms) AS ms,
              ROW_NUMBER() OVER (PARTITION BY k ORDER BY SUM(ms) DESC, album) AS rn
       FROM p WHERE album IS NOT NULL AND artist IS NOT NULL GROUP BY k, album, artist
     ) WHERE rn <= 6 ORDER BY k, rn`)

  // Week numbers → ISO keys ("2026-W47"): the Monday of week w is local day 7w − 3.
  const keyOf = (k: string) => (kind === 'week' ? weekKey(new Date((Number(k) * 7 - 3) * DAY * 1000)) : k)
  const by = new Map<string, RecapPeriod>()
  for (const r of totals) {
    const key = keyOf(r.k)
    by.set(r.k, { kind, key, label: labelOf(kind, key), ms: r.ms, streams: r.n, topArtists: [], topTracks: [], topAlbums: [] })
  }
  for (const r of artists) by.get(r.k)?.topArtists.push({ name: r.name, ms: r.ms, plays: r.plays })
  for (const r of tracks) by.get(r.k)?.topTracks.push({ name: r.name, artist: r.artist ?? '', plays: r.plays, ms: r.ms, uri: r.uri ?? undefined })
  for (const r of albums) by.get(r.k)?.topAlbums.push({ name: r.name, ms: r.ms, plays: 0 })

  const list = [...by.values()].sort((a, b) => sortVal(kind, b.key) - sortVal(kind, a.key))   // newest first
  return cap ? list.slice(0, cap) : list
}

let tempSeq = 0

/**
 * The Recaps bundle from the play database. `stored` is the bundle a pre-2.0 import
 * saved: without an import in the database it's still the only full history, so its
 * older periods are kept (the current year/season, and the rolling weeks and months,
 * come from the database — the same rule as 1.x's mergeRecaps).
 *
 * Each play's local year / month / week is worked out once, into a temp table that
 * every recap query then reads.
 */
export function* recapsJob(stored: RecapBundle | null, now: Date = new Date(), offsetSec = localOffsetSec(now)): Job<RecapBundle | null> {
  const T = `temp.recap_plays_${++tempSeq}`
  const LT = `t + ${Math.round(offsetSec)}`
  yield exec(`CREATE TABLE ${T} AS
    SELECT ym / 100 AS y, ym % 100 AS m, w, t, ms, artist, track, album, uri FROM (
      SELECT CAST(strftime('%Y%m', ${LT}, 'unixepoch') AS INTEGER) AS ym,
             CAST((CAST((${LT}) / ${DAY} AS INTEGER) + 3) / 7 AS INTEGER) AS w,
             t, ms, artist, track, album, uri
      FROM plays WHERE ${MUSIC}
    )`)
  let live: RecapBundle
  try {
    live = {
      version: 2,
      generatedAt: now.toISOString(),
      years:   yield* recapListJob(T, 'year', 0),
      seasons: yield* recapListJob(T, 'season', 0),
      months:  yield* recapListJob(T, 'month', periodRange('month', now, offsetSec, RECENT_RECAPS - 1).start, RECENT_RECAPS),
      weeks:   yield* recapListJob(T, 'week',  periodRange('week',  now, offsetSec, RECENT_RECAPS - 1).start, RECENT_RECAPS),
    }
  } finally {
    yield exec(`DROP TABLE IF EXISTS ${T}`)
  }
  const empty = !live.years.length
  const hasImport: { v: string } | null = yield first(`SELECT v FROM meta WHERE k = 'import_max_t'`)
  if (hasImport || !stored) return empty ? null : live
  if (empty) return stored

  const cur = periodKeys(new Date(now.getTime() + offsetSec * 1000))   // UTC fields = local clock
  const swap = (old: RecapPeriod[], fresh: RecapPeriod[], key: string) => {
    const c = fresh.find(x => x.key === key)
    return c ? [c, ...old.filter(x => x.key !== key)] : old
  }
  return {
    version: 2,
    generatedAt: live.generatedAt,
    years:   swap(stored.years,   live.years,   cur.year),
    seasons: swap(stored.seasons, live.seasons, cur.season),
    months:  live.months.length ? live.months : stored.months,
    weeks:   live.weeks.length  ? live.weeks  : stored.weeks,
  }
}

export function recapsFromDb(stored: RecapBundle | null, now: Date = new Date(), offsetSec = localOffsetSec(now)): RecapBundle | null {
  return runSync(recapsJob(stored, now, offsetSec))
}

/** Recaps off the UI thread, cached until a play changes (or the day / timezone does). */
export function recapsAsync(stored: RecapBundle | null, now: Date = new Date()): Promise<RecapBundle | null> {
  const off = localOffsetSec(now)
  const today = Math.floor(now.getTime() / 1000 / DAY + off / DAY)
  return cachedAsync('recaps', `${off}:${today}:${stored?.generatedAt ?? ''}`, () => recapsJob(stored, now, off))
}

// ─── all time ─────────────────────────────────────────────────────────────────
const REAL_LISTEN_MS = 30_000   // a "full play", as in Wrapped

/** Each year's listening and its top artist, oldest first. */
function* yearsWithTopArtistJob(offsetSec: number): Job<{ year: number; ms: number; streams: number; topArtist: string }[]> {
  // Group by day first (integer arithmetic), name the years in JS.
  const DAYX = `CAST((t + ${Math.round(offsetSec)}) / ${DAY} AS INTEGER)`
  const days: { d: number; ms: number; n: number }[] = yield all(
    `SELECT ${DAYX} AS d, SUM(ms) AS ms, COUNT(*) AS n FROM plays WHERE ${MUSIC} GROUP BY d`)
  const years = new Map<number, { year: number; ms: number; streams: number; topArtist: string }>()
  for (const r of days) {
    const y = ymOfDay(r.d).y
    const e = years.get(y) ?? { year: y, ms: 0, streams: 0, topArtist: '' }
    e.ms += r.ms; e.streams += r.n; years.set(y, e)
  }
  // Top artist per year: one pass per year over its index range.
  for (const e of years.values()) {
    const from = Date.UTC(e.year, 0, 1) / 1000 - offsetSec
    const to = Date.UTC(e.year + 1, 0, 1) / 1000 - offsetSec
    const top: { name: string } | null = yield first(
      `SELECT artist AS name FROM plays WHERE ${MUSIC} AND artist IS NOT NULL AND t >= ? AND t < ?
       GROUP BY artist ORDER BY SUM(ms) DESC, artist LIMIT 1`, [from, to])
    e.topArtist = top?.name ?? ''
  }
  return [...years.values()].sort((a, b) => a.year - b.year)
}
export function yearsWithTopArtist(offsetSec = localOffsetSec()) { return runSync(yearsWithTopArtistJob(offsetSec)) }

/**
 * Lifetime stats for Wrapped's "All time", in the WrappedStats shape the screen draws.
 * From the database whenever it holds the whole history (an import, or no import at
 * all — tracking only). A pre-2.0 import that only exists as the stored summary stays
 * the source until it's re-imported. Skips and podcasts aren't in the database, so
 * they still come from the stored import when there is one.
 */
export function* allTimeJob(stored: WrappedStats | null, now: Date = new Date(), offsetSec = localOffsetSec(now)): Job<WrappedStats | null> {
  const hasImport: { v: string } | null = yield first(`SELECT v FROM meta WHERE k = 'import_max_t'`)
  if (stored && !hasImport) return stored
  const s: PeriodStats = yield* periodStatsJob('all', { now, offsetSec, topN: 10 })
  if (!s.plays) return stored
  const real: { n: number } | null = yield first(`SELECT COUNT(*) AS n FROM plays WHERE ${MUSIC} AND ms >= ?`, [REAL_LISTEN_MS])
  const byYear = yield* yearsWithTopArtistJob(offsetSec)
  // Keep the import's skip RATE (skips aren't stored per play) across the larger total.
  const skipRate = stored && stored.totalStreams ? stored.skipCount / stored.totalStreams : 0
  const iso = (t: number) => new Date(t * 1000).toISOString()
  return {
    version: 2,
    generatedAt: now.toISOString(),
    totalMs: s.ms,
    totalStreams: s.plays,
    realListens: real?.n ?? 0,
    podcastStreams: stored?.podcastStreams ?? 0,
    skipCount: Math.round(skipRate * s.plays),
    uniqueArtists: s.artists,
    uniqueTracks: s.tracks,
    firstTs: iso(s.start),
    lastTs: iso(s.end - 1),
    topArtists: s.topArtists.map(a => ({ name: a.name, ms: a.ms, plays: a.plays })),
    topTracks: s.topTracks.map(t => ({ name: t.name, artist: t.sub ?? '', plays: t.plays, ms: t.ms, uri: t.uri })),
    topAlbums: s.topAlbums.map(a => ({ name: a.name, ms: a.ms, plays: a.plays })),
    byYear,
    clock: s.clock,                                         // local hours
    weekday: [s.weekdays[6], ...s.weekdays.slice(0, 6)],    // WrappedStats is Sunday-first
  }
}

export function allTimeStats(stored: WrappedStats | null, now: Date = new Date(), offsetSec = localOffsetSec(now)): WrappedStats | null {
  return runSync(allTimeJob(stored, now, offsetSec))
}

/** All time off the UI thread, cached until a play changes. */
export function allTimeAsync(stored: WrappedStats | null, now: Date = new Date()): Promise<WrappedStats | null> {
  const off = localOffsetSec(now)
  return cachedAsync('allTime', `${off}:${stored?.generatedAt ?? ''}`, () => allTimeJob(stored, now, off))
}

// ─── calendar ─────────────────────────────────────────────────────────────────
/** Local years from the first play to the last, newest first (two index lookups). */
export function yearsWithPlays(offsetSec = localOffsetSec()): number[] {
  const span = playSpan()
  if (!span) return []
  const y0 = new Date((span.first + offsetSec) * 1000).getUTCFullYear()
  const y1 = new Date((span.last + offsetSec) * 1000).getUTCFullYear()
  return Array.from({ length: y1 - y0 + 1 }, (_, i) => y1 - i)
}

export interface YearCalendar {
  year:      number
  /** Local day number of 1 January. */
  firstDay:  number
  days:      number               // 365 or 366
  /** ms per day of the year (index 0 = 1 January). */
  ms:        number[]
  plays:     number[]
  activeDays: number
  /** Longest run of consecutive days with music in this year. */
  longestStreak: number
  /** Thresholds (ms) between heat levels 1|2|3|4, from this year's own quartiles. */
  levels:    [number, number, number]
}

export function yearCalendar(year: number, offsetSec = localOffsetSec()): YearCalendar {
  const firstDay = Date.UTC(year, 0, 1) / 1000 / DAY
  const days = (Date.UTC(year + 1, 0, 1) / 1000 / DAY) - firstDay
  const totals = dayTotals({}, firstDay, firstDay + days - 1, offsetSec)
  const ms = new Array(days).fill(0), plays = new Array(days).fill(0)
  totals.forEach((v, d) => { const i = d - firstDay; if (i >= 0 && i < days) { ms[i] = v.ms; plays[i] = v.plays } })

  let longest = 0, run = 0, active = 0
  for (const v of ms) { if (v > 0) { active++; run++; if (run > longest) longest = run } else run = 0 }

  const nz = ms.filter(v => v > 0).sort((a, b) => a - b)
  const q = (p: number) => nz.length ? nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] : 0
  return { year, firstDay, days, ms, plays, activeDays: active, longestStreak: longest, levels: [q(0.25), q(0.5), q(0.75)] }
}

/** Heat level 0 (no music) … 4 (one of this year's biggest days). */
export function heatLevel(ms: number, levels: [number, number, number]): 0 | 1 | 2 | 3 | 4 {
  if (ms <= 0) return 0
  if (ms <= levels[0]) return 1
  if (ms <= levels[1]) return 2
  if (ms <= levels[2]) return 3
  return 4
}
