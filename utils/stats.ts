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
import { db, importMaxT } from '@/utils/playDb'
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

/** `comparePeriod` in the PeriodComparison shape (top 5, albums top 3, like before). */
export function periodComparison(kind: SummaryKind, now: Date = new Date(), offsetSec = localOffsetSec(now)): PeriodComparison {
  const c = comparePeriod(kind, { now, offsetSec, topN: 5 })
  return { current: toSummary(c.current), previous: toSummary(c.previous), deltaMs: c.deltaMs, deltaPlays: c.deltaPlays }
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

/** SQL for the period key of each play (`w` = Monday-aligned week number, mapped to an ISO key in JS). */
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

function recapList(kind: PeriodKind, sinceT: number, off: number, cap?: number): RecapPeriod[] {
  const d = db()
  // Local calendar fields once per play; everything below groups on k.
  const p = `p AS (
    SELECT ${KEY_SQL[kind]} AS k, ms, artist, track, album, uri FROM (
      SELECT ms, artist, track, album, uri,
        CAST(strftime('%Y', t + ${off}, 'unixepoch') AS INTEGER) AS y,
        CAST(strftime('%m', t + ${off}, 'unixepoch') AS INTEGER) AS m,
        CAST((CAST((t + ${off}) / ${DAY} AS INTEGER) + 3) / 7 AS INTEGER) AS w
      FROM plays WHERE ${MUSIC} AND t >= ?
    )
  )`
  const totals = d.getAllSync<{ k: string; ms: number; n: number }>(`WITH ${p} SELECT k, SUM(ms) AS ms, COUNT(*) AS n FROM p GROUP BY k`, [sinceT])
  if (!totals.length) return []
  const artists = d.getAllSync<{ k: string; name: string; ms: number; plays: number }>(
    `WITH ${p} SELECT k, name, ms, plays FROM (
       SELECT k, artist AS name, SUM(ms) AS ms, COUNT(*) AS plays,
              ROW_NUMBER() OVER (PARTITION BY k ORDER BY SUM(ms) DESC, artist) AS rn
       FROM p WHERE artist IS NOT NULL GROUP BY k, artist
     ) WHERE rn <= 10 ORDER BY k, rn`, [sinceT])
  const tracks = d.getAllSync<{ k: string; name: string; artist: string | null; plays: number; ms: number; uri: string | null }>(
    `WITH ${p} SELECT k, name, artist, plays, ms, uri FROM (
       SELECT k, track AS name, artist, COUNT(*) AS plays, SUM(ms) AS ms, MAX(NULLIF(uri, '')) AS uri,
              ROW_NUMBER() OVER (PARTITION BY k ORDER BY COUNT(*) DESC, SUM(ms) DESC, track) AS rn
       FROM p GROUP BY k, track, artist
     ) WHERE rn <= 10 ORDER BY k, rn`, [sinceT])
  const albums = d.getAllSync<{ k: string; name: string; ms: number }>(
    `WITH ${p} SELECT k, name, ms FROM (
       SELECT k, album AS name, SUM(ms) AS ms,
              ROW_NUMBER() OVER (PARTITION BY k ORDER BY SUM(ms) DESC, album) AS rn
       FROM p WHERE album IS NOT NULL AND artist IS NOT NULL GROUP BY k, album, artist
     ) WHERE rn <= 6 ORDER BY k, rn`, [sinceT])

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

/**
 * The Recaps bundle from the play database. `stored` is the bundle a pre-2.0 import
 * saved: without an import in the database it's still the only full history, so its
 * older periods are kept (the current year/season, and the rolling weeks and months,
 * come from the database — the same rule as 1.x's mergeRecaps).
 */
export function recapsFromDb(stored: RecapBundle | null, now: Date = new Date(), offsetSec = localOffsetSec(now)): RecapBundle | null {
  const weekSince  = periodRange('week',  now, offsetSec, RECENT_RECAPS - 1).start
  const monthSince = periodRange('month', now, offsetSec, RECENT_RECAPS - 1).start
  const live: RecapBundle = {
    version: 2,
    generatedAt: now.toISOString(),
    years:   recapList('year',   0, offsetSec),
    seasons: recapList('season', 0, offsetSec),
    months:  recapList('month',  monthSince, offsetSec, RECENT_RECAPS),
    weeks:   recapList('week',   weekSince,  offsetSec, RECENT_RECAPS),
  }
  const empty = !live.years.length
  if (importMaxT() !== null || !stored) return empty ? null : live
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

// ─── all time ─────────────────────────────────────────────────────────────────
const REAL_LISTEN_MS = 30_000   // a "full play", as in Wrapped

/** Each year's listening and its top artist, oldest first. */
export function yearsWithTopArtist(offsetSec = localOffsetSec()): { year: number; ms: number; streams: number; topArtist: string }[] {
  const d = db()
  const Y = `CAST(strftime('%Y', t + ${offsetSec}, 'unixepoch') AS INTEGER)`
  const years = d.getAllSync<{ year: number; ms: number; streams: number }>(
    `SELECT ${Y} AS year, SUM(ms) AS ms, COUNT(*) AS streams FROM plays WHERE ${MUSIC} GROUP BY year ORDER BY year`, [])
  const tops = new Map(d.getAllSync<{ year: number; name: string }>(
    `SELECT year, name FROM (
       SELECT ${Y} AS year, artist AS name, ROW_NUMBER() OVER (PARTITION BY ${Y} ORDER BY SUM(ms) DESC, artist) AS rn
       FROM plays WHERE ${MUSIC} AND artist IS NOT NULL GROUP BY year, artist
     ) WHERE rn = 1`, []).map(r => [r.year, r.name]))
  return years.map(y => ({ ...y, topArtist: tops.get(y.year) ?? '' }))
}

/**
 * Lifetime stats for Wrapped's "All time", in the WrappedStats shape the screen draws.
 * From the database whenever it holds the whole history (an import, or no import at
 * all — tracking only). A pre-2.0 import that only exists as the stored summary stays
 * the source until it's re-imported. Skips and podcasts aren't in the database, so
 * they still come from the stored import when there is one.
 */
export function allTimeStats(stored: WrappedStats | null, now: Date = new Date(), offsetSec = localOffsetSec(now)): WrappedStats | null {
  if (stored && importMaxT() === null) return stored
  const s = periodStats('all', { now, offsetSec, topN: 10 })
  if (!s.plays) return stored
  const d = db()
  const real = d.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM plays WHERE ${MUSIC} AND ms >= ?`, [REAL_LISTEN_MS])?.n ?? 0
  // Keep the import's skip RATE (skips aren't stored per play) across the larger total.
  const skipRate = stored && stored.totalStreams ? stored.skipCount / stored.totalStreams : 0
  const iso = (t: number) => new Date(t * 1000).toISOString()
  return {
    version: 2,
    generatedAt: now.toISOString(),
    totalMs: s.ms,
    totalStreams: s.plays,
    realListens: real,
    podcastStreams: stored?.podcastStreams ?? 0,
    skipCount: Math.round(skipRate * s.plays),
    uniqueArtists: s.artists,
    uniqueTracks: s.tracks,
    firstTs: iso(s.start),
    lastTs: iso(s.end - 1),
    topArtists: s.topArtists.map(a => ({ name: a.name, ms: a.ms, plays: a.plays })),
    topTracks: s.topTracks.map(t => ({ name: t.name, artist: t.sub ?? '', plays: t.plays, ms: t.ms, uri: t.uri })),
    topAlbums: s.topAlbums.map(a => ({ name: a.name, ms: a.ms, plays: a.plays })),
    byYear: yearsWithTopArtist(offsetSec),
    clock: s.clock,                                         // local hours
    weekday: [s.weekdays[6], ...s.weekdays.slice(0, 6)],    // WrappedStats is Sunday-first
  }
}
