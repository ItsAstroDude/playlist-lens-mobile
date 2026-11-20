/**
 * Story mode data (2.0 Phase 4): any period's story — this or a past week / month /
 * year, or all time — from the stats engine, off the UI thread.
 */
import { cachedAsync, type Job } from '@/utils/sqlJob'
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
}

const DAY = 86_400

export function* storyJob(kind: StoryKind, back: number, now: Date, offsetSec: number): Job<StoryData> {
  if (kind === 'all') {
    const s: PeriodStats = yield* periodStatsJob('all', { now, offsetSec, topN: 5 })
    // Shaped as a "year" summary whose buckets are years (bucketLabels name them).
    const current = { ...toSummary({ ...s, kind: 'year' }), kind: 'year' as const }
    return { comparison: { current, previous: { ...current, ms: 0, plays: 0 }, deltaMs: null, deltaPlays: null }, all: true, past: false, newArtists: null }
  }
  let comparison: PeriodComparison
  if (back <= 0) {
    comparison = toComparison(yield* comparePeriodJob(kind, { now, offsetSec, topN: 5 }))
  } else {
    // A finished period against the whole one before it.
    const cur: PeriodStats  = yield* periodStatsJob(kind, { now, offsetSec, back, topN: 5 })
    const prev: PeriodStats = yield* periodStatsJob(kind, { now, offsetSec, back: back + 1, topN: 5 })
    comparison = { current: toSummary(cur), previous: toSummary(prev), deltaMs: pct(cur.ms, prev.ms), deltaPlays: pct(cur.plays, prev.plays) }
  }
  const { start, end } = periodRange(kind, now, offsetSec, Math.max(0, back))
  const fresh = yield* newToYouJob(start, end, 1)
  return { comparison, all: false, past: back > 0, newArtists: fresh.trusted ? fresh.artists : null }
}

/** Off the UI thread, cached per plays version, timezone and hour. */
export function storyAsync(kind: StoryKind, back = 0, now: Date = new Date()): Promise<StoryData> {
  const off = localOffsetSec(now)
  const hour = Math.floor(now.getTime() / 3_600_000)
  return cachedAsync(`story.${kind}.${back}`, `${off}:${hour}`, () => storyJob(kind, back, now, off))
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
