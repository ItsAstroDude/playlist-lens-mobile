/**
 * Story mode data (2.0 Phase 4): any period's story — this or a past week / month /
 * year, or all time — from the stats engine, off the UI thread.
 */
import { cachedAsync, all, type Job } from '@/utils/sqlJob'
import {
  periodStatsJob, comparePeriodJob, toSummary, toComparison, pct, periodRange, localOffsetSec,
  type PeriodStats,
} from '@/utils/stats'
import { newToYouJob } from '@/utils/highlights'
import { isoWeek } from '@/utils/periods'
import type { PeriodComparison, SummaryKind } from '@/utils/listening'

export type StoryKind = SummaryKind | 'all'

export interface StoryData {
  comparison: PeriodComparison
  all:        boolean
  /** A finished period (not "so far"). */
  past:       boolean
  /** Artists first heard in this period, when that means something (see newToYou). */
  newArtists: number | null
  /** What you played most in your peak hour, and on your biggest day / month / year. */
  hourTracks: MiniTrack[]
  dayTracks:  MiniTrack[]
}

export interface MiniTrack { name: string; artist: string; uri: string | null; plays: number }

/** The most-played songs in [from, to), optionally only in one local hour of the day. */
function* topTracksJob(from: number, to: number, offsetSec: number, hour: number | null, limit = 3): Job<MiniTrack[]> {
  const H = hour === null ? '' : ` AND CAST(((t + ${Math.round(offsetSec)}) % ${DAY}) / 3600 AS INTEGER) = ${hour}`
  const rows: { name: string; artist: string | null; uri: string | null; plays: number }[] = yield all(
    `SELECT track AS name, artist, MAX(NULLIF(uri, '')) AS uri, COUNT(*) AS plays FROM plays
     WHERE track IS NOT NULL AND t >= ? AND t < ?${H}
     GROUP BY track, artist ORDER BY plays DESC, SUM(ms) DESC LIMIT ?`, [from, to, limit])
  return rows.map(r => ({ name: r.name, artist: r.artist ?? '', uri: r.uri, plays: r.plays }))
}

/** [from, to) of bucket `i` of a period (a day of a week / month, a month of a year, a year of all time). */
function bucketRange(kind: StoryKind, start: number, i: number, offsetSec: number): { from: number; to: number } {
  if (kind === 'week' || kind === 'month') return { from: start + i * DAY, to: start + (i + 1) * DAY }
  const local = new Date((start + offsetSec) * 1000)
  if (kind === 'year') {
    const y = local.getUTCFullYear()
    return { from: Date.UTC(y, i, 1) / 1000 - offsetSec, to: Date.UTC(y, i + 1, 1) / 1000 - offsetSec }
  }
  const y = local.getUTCFullYear() + i
  return { from: Date.UTC(y, 0, 1) / 1000 - offsetSec, to: Date.UTC(y + 1, 0, 1) / 1000 - offsetSec }
}

/** Fill in the "what you played then" lists for a story. */
function* extrasJob(kind: StoryKind, c: PeriodComparison, offsetSec: number): Job<{ hourTracks: MiniTrack[]; dayTracks: MiniTrack[] }> {
  const s = c.current
  const from = Math.floor(s.start / 1000), to = Math.ceil(s.end / 1000)
  let hourTracks: MiniTrack[] = [], dayTracks: MiniTrack[] = []
  if (s.clock && s.clock.some(v => v > 0)) {
    const h = s.clock.indexOf(Math.max(...s.clock))
    hourTracks = yield* topTracksJob(from, to, offsetSec, h)
  }
  const peak = s.buckets.reduce((best, v, i) => (v > s.buckets[best] ? i : best), 0)
  if (s.buckets[peak] > 0) {
    const r = bucketRange(kind, from, peak, offsetSec)
    dayTracks = yield* topTracksJob(r.from, r.to, offsetSec, null)
  }
  return { hourTracks, dayTracks }
}

const DAY = 86_400

export function* storyJob(kind: StoryKind, back: number, now: Date, offsetSec: number): Job<StoryData> {
  if (kind === 'all') {
    const s: PeriodStats = yield* periodStatsJob('all', { now, offsetSec, topN: 12 })
    // Shaped as a "year" summary whose buckets are years (bucketLabels name them).
    const current = { ...toSummary({ ...s, kind: 'year' }), kind: 'year' as const }
    const comparison = { current, previous: { ...current, ms: 0, plays: 0 }, deltaMs: null, deltaPlays: null }
    const extras = yield* extrasJob('all', comparison, offsetSec)
    return { comparison, all: true, past: false, newArtists: null, ...extras }
  }
  let comparison: PeriodComparison
  if (back <= 0) {
    comparison = toComparison(yield* comparePeriodJob(kind, { now, offsetSec, topN: 12 }))
  } else {
    // A finished period against the whole one before it.
    const cur: PeriodStats  = yield* periodStatsJob(kind, { now, offsetSec, back, topN: 12 })
    const prev: PeriodStats = yield* periodStatsJob(kind, { now, offsetSec, back: back + 1, topN: 12 })
    comparison = { current: toSummary(cur), previous: toSummary(prev), deltaMs: pct(cur.ms, prev.ms), deltaPlays: pct(cur.plays, prev.plays) }
  }
  const { start, end } = periodRange(kind, now, offsetSec, Math.max(0, back))
  const fresh = yield* newToYouJob(start, end, 1)
  const extras = yield* extrasJob(kind, comparison, offsetSec)
  return { comparison, all: false, past: back > 0, newArtists: fresh.trusted ? fresh.artists : null, ...extras }
}

/** Off the UI thread, cached per plays version, timezone and hour. */
export function storyAsync(kind: StoryKind, back = 0, now: Date = new Date()): Promise<StoryData> {
  const off = localOffsetSec(now)
  const hour = Math.floor(now.getTime() / 3_600_000)
  // v4: + peak hour / day songs (2.0.15)
  return cachedAsync(`story4.${kind}.${back}`, `${off}:${hour}`, () => storyJob(kind, back, now, off))
}

/**
 * How many periods back a Recaps period is (its key: "2025", "2026-06", "2026-W24"),
 * or null for kinds stories don't cover (seasons) and periods in the future.
 */
export function backFromKey(kind: string, key: string, now: Date = new Date(), offsetSec = localOffsetSec(now)): number | null {
  const local = new Date(now.getTime() + offsetSec * 1000)
  const y = local.getUTCFullYear(), m = local.getUTCMonth()
  let back: number | null = null
  if (kind === 'year') back = y - Number(key)
  else if (kind === 'month') {
    const [ky, km] = key.split('-').map(Number)
    back = (y * 12 + m) - (ky * 12 + (km - 1))
  } else if (kind === 'week') {
    const thisMonday = periodRange('week', now, offsetSec).start
    // The Monday of ISO week `kw` of `ky`: the week containing 4 January, plus kw − 1 weeks.
    const [ky, kw] = key.split('-W').map(Number)
    const jan4 = new Date(Date.UTC(ky, 0, 4))
    const monday = Date.UTC(ky, 0, 4 - ((jan4.getUTCDay() + 6) % 7) + (kw - 1) * 7) / 1000 - offsetSec
    back = Math.round((thisMonday - monday) / (7 * DAY))
    if (weekKeyOf(monday + offsetSec) !== key) return null       // malformed key
  }
  return back !== null && Number.isFinite(back) && back >= 0 ? back : null
}

function weekKeyOf(localSec: number): string {
  const { year, week } = isoWeek(new Date(localSec * 1000))
  return `${year}-W${String(week).padStart(2, '0')}`
}
