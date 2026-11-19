/**
 * Highlights (2.0 Phase 3) — streaks, milestones, "new to you" and "on this day",
 * in SQL on the play database. Same conventions as utils/stats: UTC seconds in the
 * database, local time via `offsetSec`, music only.
 */
import { all, first, exec, runSync, cachedAsync, type Job } from '@/utils/sqlJob'
import { localOffsetSec, localDay, type Ranked } from '@/utils/stats'

const DAY = 86_400
const MUSIC = 'track IS NOT NULL'
const HOUR_MS = 3_600_000

// ─── new to you ───────────────────────────────────────────────────────────────
export interface NewToYou {
  artists: number
  tracks:  number
  /** New artists, most listened first (time within the period). */
  topArtists: Ranked[]
  /**
   * Whether "new" means anything: the history has to start well before the period,
   * or every artist in someone's first tracked week would be "new".
   */
  trusted: boolean
}

/**
 * Artists and songs whose first-ever play falls in [start, end) (UTC seconds).
 * "First play" comes from the (artist, t) and (uri, t) indexes alone — no table scan.
 * Songs are counted by Spotify URI.
 */
export function* newToYouJob(start: number, end: number, limit = 5): Job<NewToYou> {
  const span: { a: number | null } | null = yield first(`SELECT MIN(t) AS a FROM plays`)
  const trusted = span?.a != null && span.a < start - 60 * DAY
  const fresh: { name: string }[] = yield all(
    `SELECT artist AS name FROM plays WHERE artist IS NOT NULL
     GROUP BY artist HAVING MIN(t) >= ? AND MIN(t) < ?`, [start, end])
  let topArtists: Ranked[] = []
  if (fresh.length) {
    const marks = fresh.map(() => '?').join(',')
    topArtists = yield all(
      `SELECT artist AS name, SUM(ms) AS ms, COUNT(*) AS plays FROM plays
       WHERE ${MUSIC} AND t >= ? AND t < ? AND artist IN (${marks})
       GROUP BY artist ORDER BY ms DESC, name LIMIT ?`,
      [start, end, ...fresh.map(f => f.name), limit])
  }
  const tracks: { n: number } | null = yield first(
    `SELECT COUNT(*) AS n FROM (
       SELECT uri FROM plays WHERE uri != '' GROUP BY uri HAVING MIN(t) >= ? AND MIN(t) < ?
     )`, [start, end])
  return { artists: fresh.length, tracks: tracks?.n ?? 0, topArtists, trusted }
}
export function newToYou(start: number, end: number, limit = 5): NewToYou { return runSync(newToYouJob(start, end, limit)) }
/** Off the UI thread, cached until a play changes. */
export function newToYouAsync(kind: string, start: number, end: number): Promise<NewToYou> {
  return cachedAsync(`new.${kind}`, `${start}:${end}`, () => newToYouJob(start, end))
}

// ─── streaks ──────────────────────────────────────────────────────────────────
export interface Run { length: number; startDay: number; endDay: number }
export interface ArtistRun extends Run { artist: string }

export interface Streaks {
  /** Days in a row with music, ending today (or yesterday, if today has none yet). */
  current: number
  longest: Run | null
  /** The longest stretch of days in a row with one artist. */
  artistBest: ArtistRun | null
  /** The longest artist run still going (ends today or yesterday), if 3+ days. */
  artistNow: ArtistRun | null
}

let tempSeq = 0

export function* streaksJob(now: Date = new Date(), offsetSec = localOffsetSec(now)): Job<Streaks> {
  const today = localDay(Math.floor(now.getTime() / 1000), offsetSec)
  const DAYEXPR = `CAST((t + ${Math.round(offsetSec)}) / ${DAY} AS INTEGER)`

  // Day runs: gaps-and-islands over the distinct days with music.
  const runs: Run[] = yield all(
    `SELECT COUNT(*) AS length, MIN(day) AS startDay, MAX(day) AS endDay FROM (
       SELECT day, day - ROW_NUMBER() OVER (ORDER BY day) AS grp
       FROM (SELECT DISTINCT ${DAYEXPR} AS day FROM plays WHERE ${MUSIC})
     ) GROUP BY grp ORDER BY length DESC, endDay DESC`)
  const live = runs.find(r => r.endDay >= today - 1 && r.endDay <= today)
  const longest = runs[0] ?? null

  // Artist runs: the same per artist, worked out once into a temp table.
  const T = `temp.artist_runs_${++tempSeq}`
  yield exec(`CREATE TABLE ${T} AS
    SELECT artist, COUNT(*) AS length, MIN(day) AS startDay, MAX(day) AS endDay FROM (
      SELECT artist, day, day - ROW_NUMBER() OVER (PARTITION BY artist ORDER BY day) AS grp
      FROM (SELECT DISTINCT artist, ${DAYEXPR} AS day FROM plays WHERE ${MUSIC} AND artist IS NOT NULL)
    ) GROUP BY artist, grp`)
  let artistBest: ArtistRun | null, artistNow: ArtistRun | null
  try {
    artistBest = yield first(`SELECT * FROM ${T} ORDER BY length DESC, endDay DESC LIMIT 1`)
    artistNow = yield first(
      `SELECT * FROM ${T} WHERE endDay >= ? AND endDay <= ? AND length >= 3 ORDER BY length DESC LIMIT 1`,
      [today - 1, today])
  } finally {
    yield exec(`DROP TABLE IF EXISTS ${T}`)
  }
  return { current: live?.length ?? 0, longest, artistBest: artistBest ?? null, artistNow: artistNow ?? null }
}
export function streaks(now: Date = new Date(), offsetSec = localOffsetSec(now)): Streaks { return runSync(streaksJob(now, offsetSec)) }
export function streaksAsync(now: Date = new Date()): Promise<Streaks> {
  const off = localOffsetSec(now)
  return cachedAsync('streaks', `${off}:${localDay(Math.floor(now.getTime() / 1000), off)}`, () => streaksJob(now, off))
}

// ─── milestones ───────────────────────────────────────────────────────────────
export type MilestoneKind = 'plays' | 'artists' | 'hours'

export const MILESTONES: Record<MilestoneKind, number[]> = {
  plays:   [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
  artists: [10, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000],
  hours:   [10, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000],
}

export interface Milestone {
  kind:    MilestoneKind
  n:       number
  /** When it was reached (UTC seconds) and what was playing. */
  t:       number
  track:   string | null
  artist:  string | null
}

export interface NextMilestone { kind: MilestoneKind; n: number; have: number; progress: number }

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n.toLocaleString() + (s[(v - 20) % 10] || s[v] || s[0])
}

/** "10,000th play", "100th artist", "1,000 hours". */
export function milestoneTitle(m: Pick<Milestone, 'kind' | 'n'>): string {
  if (m.kind === 'plays') return `${ordinal(m.n)} play`
  if (m.kind === 'artists') return `${ordinal(m.n)} artist`
  return `${m.n.toLocaleString()} hours`
}

const values = (xs: number[]) => xs.map(x => `(${x})`).join(',')

/**
 * Every milestone reached (newest first) and the next one of each kind.
 */
export function* milestonesJob(): Job<{ reached: Milestone[]; next: NextMilestone[] }> {
  const tot: { n: number; ms: number | null } | null = yield first(`SELECT COUNT(*) AS n, SUM(ms) AS ms FROM plays WHERE ${MUSIC}`)
  const artistsN: { a: number } | null = yield first(`SELECT COUNT(DISTINCT artist) AS a FROM plays WHERE ${MUSIC}`)
  const have = { plays: tot?.n ?? 0, artists: artistsN?.a ?? 0, hours: (tot?.ms ?? 0) / HOUR_MS }
  if (!have.plays) return { reached: [], next: [] }
  const reachedOf = (k: MilestoneKind) => MILESTONES[k].filter(n => n <= have[k])
  const out: Milestone[] = []

  // The Nth play: ordered by the primary key (t, uri), so OFFSET walks the index.
  for (const n of reachedOf('plays')) {
    const r: { t: number; track: string; artist: string | null } | null = yield first(
      `SELECT t, track, artist FROM plays WHERE ${MUSIC} ORDER BY t, uri LIMIT 1 OFFSET ?`, [n - 1])
    if (r) out.push({ kind: 'plays', n, ...r })
  }

  // The Nth artist: first plays per artist come straight off the artist index.
  const artistN = reachedOf('artists')
  if (artistN.length) {
    const rows: { n: number; artist: string; t: number }[] = yield all(
      `SELECT rn AS n, artist, t FROM (
         SELECT artist, f AS t, ROW_NUMBER() OVER (ORDER BY f, artist) AS rn FROM (
           SELECT artist, MIN(t) AS f FROM plays WHERE artist IS NOT NULL GROUP BY artist
         )
       ) WHERE rn IN (${artistN.join(',')})`)
    for (const r of rows) {
      const tr: { track: string | null } | null = yield first(`SELECT track FROM plays WHERE t = ? AND artist = ? LIMIT 1`, [r.t, r.artist])
      out.push({ kind: 'artists', n: r.n, t: r.t, artist: r.artist, track: tr?.track ?? null })
    }
  }

  // Hours: the play during which the running total crossed each threshold.
  const hourN = reachedOf('hours')
  if (hourN.length) {
    const rows: { n: number; t: number; track: string; artist: string | null }[] = yield all(
      `WITH c AS (
         SELECT t, track, artist, ms, SUM(ms) OVER (ORDER BY t, uri ROWS UNBOUNDED PRECEDING) AS cum
         FROM plays WHERE ${MUSIC}
       ), th(n) AS (VALUES ${values(hourN)})
       SELECT th.n AS n, c.t AS t, c.track AS track, c.artist AS artist
       FROM c JOIN th ON c.cum >= th.n * ${HOUR_MS} AND c.cum - c.ms < th.n * ${HOUR_MS}`)
    out.push(...rows.map(r => ({ kind: 'hours' as const, ...r })))
  }

  const next: NextMilestone[] = (['plays', 'artists', 'hours'] as MilestoneKind[]).flatMap(k => {
    const n = MILESTONES[k].find(x => x > have[k])
    if (!n) return []
    const prev = [...MILESTONES[k]].reverse().find(x => x <= have[k]) ?? 0
    return [{ kind: k, n, have: Math.floor(have[k]), progress: (have[k] - prev) / (n - prev) }]
  })

  out.sort((a, b) => b.t - a.t || b.n - a.n)
  return { reached: out, next }
}
export function milestones() { return runSync(milestonesJob()) }
export function milestonesAsync() { return cachedAsync('milestones', '', () => milestonesJob()) }

// ─── on this day ──────────────────────────────────────────────────────────────
export interface OnThisDayYear {
  year:   number
  plays:  number
  ms:     number
  tracks: { name: string; artist: string; uri: string | null; plays: number }[]
}

/**
 * What you played on today's date in earlier years, newest year first. One index
 * range per earlier year (since the first play), not a scan of every play.
 */
export function* onThisDayJob(now: Date = new Date(), offsetSec = localOffsetSec(now), perYear = 5): Job<OnThisDayYear[]> {
  const local = new Date(now.getTime() + offsetSec * 1000)
  const M = local.getUTCMonth(), D = local.getUTCDate(), thisYear = local.getUTCFullYear()
  const span: { a: number | null } | null = yield first(`SELECT MIN(t) AS a FROM plays WHERE ${MUSIC}`)
  if (span?.a == null) return []
  const firstYear = new Date((span.a + offsetSec) * 1000).getUTCFullYear()
  const out: OnThisDayYear[] = []
  for (let y = thisYear - 1; y >= firstYear; y--) {
    const dayStart = Date.UTC(y, M, D) / 1000
    if (new Date(dayStart * 1000).getUTCMonth() !== M) continue      // 29 Feb in a non-leap year
    const from = dayStart - offsetSec, to = from + DAY
    const rows: { name: string; artist: string | null; uri: string | null; plays: number; ms: number }[] = yield all(
      `SELECT track AS name, artist, MAX(NULLIF(uri, '')) AS uri, COUNT(*) AS plays, SUM(ms) AS ms
       FROM plays WHERE ${MUSIC} AND t >= ? AND t < ?
       GROUP BY track, artist ORDER BY plays DESC, ms DESC`, [from, to])
    if (!rows.length) continue
    out.push({
      year: y,
      plays: rows.reduce((a, r) => a + r.plays, 0),
      ms: rows.reduce((a, r) => a + r.ms, 0),
      tracks: rows.slice(0, perYear).map(r => ({ name: r.name, artist: r.artist ?? '', uri: r.uri, plays: r.plays })),
    })
  }
  return out
}
export function onThisDay(now: Date = new Date(), offsetSec = localOffsetSec(now), perYear = 5) { return runSync(onThisDayJob(now, offsetSec, perYear)) }
export function onThisDayAsync(now: Date = new Date()): Promise<OnThisDayYear[]> {
  const off = localOffsetSec(now)
  return cachedAsync('onThisDay', `${off}:${localDay(Math.floor(now.getTime() / 1000), off)}`, () => onThisDayJob(now, off))
}
