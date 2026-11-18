/**
 * The director decides WHEN Spark speaks (SPARK_BRIEF §6):
 *  - modes: on (default) · quiet (only when tapped) · off (hidden)
 *  - at most 1 unprompted line per screen visit, ~3 per session
 *  - a greeting only after ≥ 12 h away (the very first one introduces him)
 *  - lines come from shuffled decks, so he doesn't repeat himself until he's said them all
 *  - 5 quick taps → the rock gag
 */
import { useSyncExternalStore } from 'react'
import { storage } from '@/utils/cache'
import { weekFacts } from '@/utils/liveLines'
import { LINES, factLines, greetingBank, type Bank } from './lines'

export type SparkMode = 'on' | 'quiet' | 'off'
const K = {
  mode: 'spark.mode',
  lastGreet: 'spark.lastGreet',
  deck: (b: string) => `spark.deck.${b}`,
}
export const GREET_GAP_MS = 12 * 3600_000
const RETURN_GAP_MS = 3 * 86400_000
export const SESSION_CAP = 3
const ROCK_TAPS = 5
const ROCK_WINDOW_MS = 2500

// ── mode ──
const listeners = new Set<() => void>()
export function getSparkMode(): SparkMode {
  const v = storage.getString(K.mode)
  return v === 'quiet' || v === 'off' ? v : 'on'
}
export function setSparkMode(m: SparkMode): void {
  storage.set(K.mode, m)
  listeners.forEach(l => l())
}
export function nextSparkMode(m: SparkMode): SparkMode { return m === 'on' ? 'quiet' : m === 'quiet' ? 'off' : 'on' }
export function useSparkMode(): SparkMode {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, getSparkMode)
}

// ── decks: a shuffled order per bank, persisted so he doesn't repeat across launches ──
function shuffle(n: number, rnd: () => number, avoidFirst?: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  if (n > 1 && a[0] === avoidFirst) [a[0], a[1]] = [a[1], a[0]]
  return a
}
export function drawFrom(key: string, lines: string[], rnd: () => number = Math.random): string {
  let deck: number[] = []
  let last: number | undefined
  try { const raw = storage.getString(K.deck(key)); if (raw) ({ deck, last } = JSON.parse(raw)) } catch {}
  deck = deck.filter(i => i < lines.length)
  if (!deck.length) deck = shuffle(lines.length, rnd, last)
  const i = deck.shift()!
  storage.set(K.deck(key), JSON.stringify({ deck, last: i }))
  return lines[i]
}
const draw = (b: Bank, rnd?: () => number) => drawFrom(b, LINES[b], rnd)

// ── session budget ──
let spokenThisSession = 0
export function _resetSession(): void { spokenThisSession = 0; tapTimes = [] }

/**
 * The greeting, if one is due: mode is 'on', under the session cap, and ≥ 12 h since the
 * last one. Marks it said. Returns null when Spark should stay quiet.
 */
export function greetingLine(now: Date = new Date(), rnd?: () => number): string | null {
  if (getSparkMode() !== 'on' || spokenThisSession >= SESSION_CAP) return null
  const last = storage.getNumber(K.lastGreet)
  const t = now.getTime()
  if (last !== undefined && t - last < GREET_GAP_MS) return null
  storage.set(K.lastGreet, t)
  spokenThisSession++
  if (last === undefined) return LINES.greeting_first[0]
  if (t - last >= RETURN_GAP_MS) return draw('greeting_return', rnd)
  return draw(greetingBank(now.getHours()), rnd)
}

let tapTimes: number[] = []
/** What Spark says when tapped (works in 'on' and 'quiet'). `rock` = the 5-tap gag. */
export function tapLine(now: number = Date.now(), rnd: () => number = Math.random): { line: string; rock: boolean } {
  tapTimes = [...tapTimes.filter(t => now - t < ROCK_WINDOW_MS), now]
  if (tapTimes.length >= ROCK_TAPS) { tapTimes = []; return { line: draw('rock', rnd), rock: true } }
  // Half the time (when there's something true to say) a fact from this week.
  if (rnd() < 0.5) {
    const facts = factLines(weekFacts())
    if (facts.length) return { line: drawFrom('facts', facts, rnd), rock: false }
  }
  return { line: draw('tap', rnd), rock: false }
}
