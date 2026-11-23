/**
 * The Play tab's newer games (2.0.39), all on your own listening. Pure logic + SQL jobs,
 * no React; the screens are in components/play.
 *
 *  · Blind five — a few seconds of one of your top songs, from a random spot, on your
 *    Spotify. Pick it from four. Faster = more points.
 *  · Rank it — five artists a day: put them in order of how much you played them.
 *  · When? — one of your songs: which month were you most into it?
 */
import type { Ranked } from '@/utils/stats'
import { all, type Job } from '@/utils/sqlJob'

// ─── randomness ───────────────────────────────────────────────────────────────

/** A small seeded random (mulberry32): the same day gives the same Rank it five. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** YYYYMMDD of the local day: the daily seed and the "played today" key. */
export function dayKey(d: Date = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function shuffle<T>(xs: T[], rand: () => number = Math.random): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Blind five ───────────────────────────────────────────────────────────────

export const BLIND_ROUNDS = 10
export const CLIP_MS = 5_000

export interface BlindSong { name: string; artist: string; uri: string; plays: number }
export interface BlindRound { answer: BlindSong; options: BlindSong[] }

/** Your top songs that Spotify can play (a track uri), one per name + artist. */
export function blindPool(top: Ranked[]): BlindSong[] {
  const seen = new Set<string>()
  const out: BlindSong[] = []
  for (const t of top) {
    if (!t.uri?.startsWith('spotify:track:') || !t.name?.trim()) continue
    const k = `${t.name.toLowerCase()}|${(t.sub ?? '').toLowerCase()}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ name: t.name, artist: t.sub ?? '', uri: t.uri, plays: t.plays })
  }
  return out
}

export function canPlayBlind(pool: BlindSong[]): boolean { return pool.length >= 8 }

/**
 * `n` rounds: each a different song, with three others to pick from — other artists
 * first (two songs by the same artist is too mean), then anything.
 */
export function blindRounds(pool: BlindSong[], n = BLIND_ROUNDS, rand: () => number = Math.random): BlindRound[] {
  const answers = shuffle(pool, rand).slice(0, Math.min(n, pool.length))
  return answers.map(answer => {
    const others = shuffle(pool.filter(s => s.uri !== answer.uri), rand)
    const otherArtist = others.filter(s => s.artist.toLowerCase() !== answer.artist.toLowerCase())
    const picks = [...otherArtist, ...others.filter(s => !otherArtist.includes(s))].slice(0, 3)
    return { answer, options: shuffle([answer, ...picks], rand) }
  })
}

/** Where the clip starts: somewhere in 0:20–1:10, past most intros, before most ends. */
export function clipStart(rand: () => number = Math.random): number {
  return 20_000 + Math.floor(rand() * 50_000)
}

/** 100 for right, plus up to 100 more for speed (none after 10 s). Wrong = 0. */
export function blindPoints(right: boolean, ms: number): number {
  if (!right) return 0
  return 100 + Math.round(100 * Math.max(0, 1 - ms / 10_000))
}

export function blindVerdict(right: number, of: number): string {
  if (right === of) return 'Perfect. You could name these in your sleep.'
  if (right >= of * 0.7) return 'Sharp ears.'
  if (right >= of * 0.4) return 'Not bad. Some of these deserve another listen.'
  return 'Your own top songs, and still a mystery. Go again?'
}

// ─── Rank it ──────────────────────────────────────────────────────────────────

export interface RankItem { name: string; plays: number }

/**
 * Five artists with five different play counts, in a shuffled order that isn't already
 * right. Null when there aren't five to choose from.
 */
export function rankFive(top: Ranked[], rand: () => number = Math.random): RankItem[] | null {
  const byPlays = new Map<number, Ranked>()
  for (const a of top) if (a.name?.trim() && a.plays > 0 && !byPlays.has(a.plays)) byPlays.set(a.plays, a)
  const distinct = [...byPlays.values()]
  if (distinct.length < 5) return null
  const five = shuffle(distinct, rand).slice(0, 5).map(a => ({ name: a.name, plays: a.plays }))
  let order = shuffle(five, rand)
  for (let i = 0; i < 6 && rankScore(order) === 5; i++) order = shuffle(five, rand)
  if (rankScore(order) === 5) order = order.slice().reverse()
  return order
}

/** The right order: most played first. */
export function rankAnswer(items: RankItem[]): RankItem[] {
  return items.slice().sort((a, b) => b.plays - a.plays)
}

/** How many sit in their right place. */
export function rankScore(order: RankItem[]): number {
  const right = rankAnswer(order)
  return order.reduce((n, it, i) => n + (right[i].name === it.name ? 1 : 0), 0)
}

/** Move one item from `from` to `to` (a drag, or a move up / down). */
export function moveItem<T>(xs: T[], from: number, to: number): T[] {
  const a = xs.slice()
  const t = Math.max(0, Math.min(a.length - 1, to))
  const [it] = a.splice(from, 1)
  a.splice(t, 0, it)
  return a
}

/**
 * Where row `i` sits while row `from` is dragged over slot `to`: the rows between make
 * room. The dragged row itself stays at `i` (its finger offset moves it).
 */
export function dragSlot(i: number, from: number | null, to: number | null): number {
  if (from == null || to == null || i === from) return i
  if (from < to && i > from && i <= to) return i - 1
  if (from > to && i >= to && i < from) return i + 1
  return i
}

// ─── When? ────────────────────────────────────────────────────────────────────

export const WHEN_ROUNDS = 5
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface MonthCount { y: number; m: number; n: number }   // m: 0..11
export interface WhenRound { name: string; artist: string; plays: number; months: MonthCount[]; peak: { y: number; m: number } }

/**
 * The month with the most plays — only when it stands out (no tie for first, and at
 * least 3 plays), so there's a real answer.
 */
export function peakMonth(months: MonthCount[]): { y: number; m: number } | null {
  if (!months.length) return null
  const s = months.slice().sort((a, b) => b.n - a.n || a.y - b.y || a.m - b.m)
  if (s[0].n < 3 || (s[1] && s[1].n === s[0].n)) return null
  return { y: s[0].y, m: s[0].m }
}

/** 200 for the right month, 40 less for every month off. */
export function whenPoints(guess: { y: number; m: number }, answer: { y: number; m: number }): number {
  const off = Math.abs((guess.y * 12 + guess.m) - (answer.y * 12 + answer.m))
  return Math.max(0, 200 - 40 * off)
}

/** Plays of one song by local month. */
export function* songMonthsJob(name: string, artist: string, offsetSec: number): Job<MonthCount[]> {
  const rows: { y: number; m: number; n: number }[] = yield all(
    `SELECT CAST(strftime('%Y', t + ?, 'unixepoch') AS INTEGER) AS y,
            CAST(strftime('%m', t + ?, 'unixepoch') AS INTEGER) - 1 AS m,
            COUNT(*) AS n
     FROM plays WHERE track = ? AND artist = ? GROUP BY y, m`,
    [offsetSec, offsetSec, name, artist])
  return rows
}

/**
 * `n` rounds from your top songs (6+ plays): shuffled, keeping those with a clear peak
 * month. Stops looking after 40 songs.
 */
export function* whenRoundsJob(top: Ranked[], offsetSec: number, n = WHEN_ROUNDS, rand: () => number = Math.random): Job<WhenRound[]> {
  const cands = shuffle(top.filter(t => t.plays >= 6 && t.sub), rand).slice(0, 40)
  const out: WhenRound[] = []
  for (const c of cands) {
    if (out.length >= n) break
    const months: MonthCount[] = yield* songMonthsJob(c.name, c.sub!, offsetSec)
    const peak = peakMonth(months)
    if (peak) out.push({ name: c.name, artist: c.sub!, plays: c.plays, months, peak })
  }
  return out
}

export function whenVerdict(points: number, of: number): string {
  const k = points / of
  if (k >= 0.85) return 'You remember every era of yours.'
  if (k >= 0.6) return 'Good memory.'
  if (k >= 0.3) return 'Roughly right. Time flies.'
  return 'Where did the months go?'
}
