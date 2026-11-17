/**
 * Period listening summaries (v1.8 Wrapped revamp) — stats.fm-style "this week".
 *
 * Pure functions over the local play buffer (tracked plays + device pulls + the
 * import's recent tail). UTC throughout, matching utils/periods.ts, so a week here
 * is the same ISO week Recaps shows.
 */
import type { StreamRow } from '@/utils/wrapped'

export type SummaryKind = 'week' | 'month' | 'year'

export interface TopItem { name: string; sub?: string; ms: number; plays: number; uri?: string }

export interface PeriodSummary {
  kind:        SummaryKind
  start:       number          // ms epoch, inclusive
  end:         number          // ms epoch, exclusive (period end, not "now")
  ms:          number
  plays:       number
  artists:     number          // unique
  tracks:      number          // unique
  buckets:     number[]        // ms per day (week: Mon→Sun; month: per day) or per month (year)
  topArtists:  TopItem[]
  topTracks:   TopItem[]
  topAlbums:   TopItem[]
}

export interface PeriodComparison {
  current:  PeriodSummary
  /** The previous period, cut at the same elapsed point — a fair "vs last week so far". */
  previous: PeriodSummary
  deltaMs:    number | null    // % change, null when there's nothing to compare against
  deltaPlays: number | null
}

const DAY = 86_400_000

/** [start, end) of the period containing `now`, shifted back by `back` periods. */
export function periodRange(kind: SummaryKind, now: Date, back = 0): { start: number; end: number } {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate()
  if (kind === 'week') {
    const dow = (now.getUTCDay() + 6) % 7                       // Mon = 0
    const start = Date.UTC(y, m, d - dow - 7 * back)
    return { start, end: start + 7 * DAY }
  }
  if (kind === 'month') {
    return { start: Date.UTC(y, m - back, 1), end: Date.UTC(y, m - back + 1, 1) }
  }
  return { start: Date.UTC(y - back, 0, 1), end: Date.UTC(y - back + 1, 0, 1) }
}

function bucketCount(kind: SummaryKind, start: number, end: number): number {
  if (kind === 'week') return 7
  if (kind === 'year') return 12
  return Math.round((end - start) / DAY)
}

function bucketOf(kind: SummaryKind, start: number, t: number): number {
  if (kind === 'year') return new Date(t).getUTCMonth()
  return Math.floor((t - start) / DAY)
}

function top(map: Map<string, TopItem>, by: 'ms' | 'plays', n: number): TopItem[] {
  return [...map.values()]
    .sort((a, b) => (b[by] - a[by]) || (by === 'plays' ? b.ms - a.ms : b.plays - a.plays) || a.name.localeCompare(b.name))
    .slice(0, n)
}

/**
 * Summarise plays in [start, cutoff). `cutoff` defaults to the period end; pass an
 * earlier one to compare "so far". Rows need not be sorted.
 */
export function summarize(
  rows: StreamRow[], kind: SummaryKind, range: { start: number; end: number }, cutoff = range.end, topN = 5,
): PeriodSummary {
  const buckets = new Array(bucketCount(kind, range.start, range.end)).fill(0)
  const artists = new Map<string, TopItem>()
  const tracks  = new Map<string, TopItem>()
  const albums  = new Map<string, TopItem>()
  let ms = 0, plays = 0

  for (const r of rows) {
    if (r.spotify_episode_uri) continue                         // music only
    const name = r.master_metadata_track_name ?? r.trackName
    if (!name) continue
    const t = Date.parse(r.ts ?? r.endTime ?? '')
    if (!Number.isFinite(t) || t < range.start || t >= cutoff) continue
    const played = r.ms_played ?? r.msPlayed ?? 0
    const artist = r.master_metadata_album_artist_name ?? r.artistName ?? 'Unknown artist'
    const album  = r.master_metadata_album_album_name ?? null

    ms += played; plays++
    const b = bucketOf(kind, range.start, t)
    if (b >= 0 && b < buckets.length) buckets[b] += played

    const a = artists.get(artist) ?? { name: artist, ms: 0, plays: 0 }
    a.ms += played; a.plays++; artists.set(artist, a)

    const tk = `${name}\u0000${artist}`
    const tr = tracks.get(tk) ?? { name, sub: artist, ms: 0, plays: 0, uri: r.spotify_track_uri ?? undefined }
    tr.ms += played; tr.plays++
    if (!tr.uri && r.spotify_track_uri) tr.uri = r.spotify_track_uri
    tracks.set(tk, tr)

    if (album) {
      const ak = `${album}\u0000${artist}`
      const al = albums.get(ak) ?? { name: album, sub: artist, ms: 0, plays: 0 }
      al.ms += played; al.plays++; albums.set(ak, al)
    }
  }

  return {
    kind, start: range.start, end: range.end, ms, plays,
    artists: artists.size, tracks: tracks.size, buckets,
    topArtists: top(artists, 'ms', topN),
    topTracks:  top(tracks, 'plays', topN),
    topAlbums:  top(albums, 'ms', Math.min(topN, 3)),
  }
}

function pct(cur: number, prev: number): number | null {
  if (prev <= 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}

/** This period so far vs the previous period at the same elapsed point. */
export function comparePeriods(rows: StreamRow[], kind: SummaryKind, now: Date = new Date()): PeriodComparison {
  const cur = periodRange(kind, now)
  const prev = periodRange(kind, now, 1)
  const elapsed = Math.min(now.getTime(), cur.end) - cur.start
  const current = summarize(rows, kind, cur, Math.min(now.getTime() + 1, cur.end))
  const previous = summarize(rows, kind, prev, Math.min(prev.start + elapsed + 1, prev.end))
  return {
    current, previous,
    deltaMs:    pct(current.ms, previous.ms),
    deltaPlays: pct(current.plays, previous.plays),
  }
}

/** "Nov 10 – 16", "November 2026", "2026" — in the viewer's locale. */
export function periodTitle(s: Pick<PeriodSummary, 'kind' | 'start' | 'end'>): string {
  const opts = { timeZone: 'UTC' } as const
  const a = new Date(s.start)
  if (s.kind === 'year') return String(a.getUTCFullYear())
  if (s.kind === 'month') return a.toLocaleDateString(undefined, { ...opts, month: 'long', year: 'numeric' })
  const b = new Date(s.end - DAY)
  const sameMonth = a.getUTCMonth() === b.getUTCMonth()
  const left  = a.toLocaleDateString(undefined, { ...opts, month: 'short', day: 'numeric' })
  const right = sameMonth
    ? b.toLocaleDateString(undefined, { ...opts, day: 'numeric' })
    : b.toLocaleDateString(undefined, { ...opts, month: 'short', day: 'numeric' })
  return `${left} – ${right}`
}

/** Short bucket labels for the bar chart. */
export function bucketLabels(s: Pick<PeriodSummary, 'kind' | 'buckets'>): string[] {
  if (s.kind === 'week') return ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  if (s.kind === 'year') return ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  return s.buckets.map((_, i) => (i === 0 || (i + 1) % 7 === 0 ? String(i + 1) : ''))
}
