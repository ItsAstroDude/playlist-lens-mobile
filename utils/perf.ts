/**
 * Load-time instrumentation (1.9.1) — the baseline the 2.0 play database has to beat.
 *
 * Records a rolling window of samples per metric in MMKV and summarises them in
 * Settings › About › Load times. Everything here is best-effort and cheap: a failure
 * to record never affects the app.
 *
 * Clock: `performance.now()`. React Native's `rnStartupTiming.startTime` is on the same
 * clock and marks when the native host started, so cold start covers native init + JS
 * bundle + first content. If it's unavailable we fall back to when this module loaded
 * (JS start), and say so in the label.
 */
import { useEffect, useRef } from 'react'
import { storage } from '@/utils/cache'

const KEY        = 'perf.samples.v1'
const MAX_SAMPLES = 20

const now = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())

/** When this module first loaded — the first import of app/_layout. */
const JS_START = now()

export type Metric =
  | 'cold_start'    // app process start → first Lenses content on screen
  | 'js_start'      // JS bundle start → first Lenses content on screen
  | 'lenses'        // Lenses screen render → playlists on screen
  | 'wrapped'       // Wrapped tab render → content on screen
  | 'recaps'        // Recaps screen render → content on screen
  | 'read_buffer'   // parse the MMKV play buffer (JSON)
  | 'read_stats'    // parse the MMKV lifetime Wrapped stats blob (JSON)

export const METRIC_LABEL: Record<Metric, string> = {
  cold_start:  'Cold start',
  js_start:    'Cold start (from JS)',
  lenses:      'Lenses',
  wrapped:     'Wrapped',
  recaps:      'Recaps',
  read_buffer: 'Read recent plays',
  read_stats:  'Read lifetime stats',
}

/** Display order in Settings. */
export const METRICS: Metric[] = ['cold_start', 'js_start', 'lenses', 'wrapped', 'recaps', 'read_buffer', 'read_stats']

type Store = Partial<Record<Metric, number[]>> & { sizes?: Partial<Record<'buffer' | 'stats', number>> }

function read(): Store {
  try { const raw = storage.getString(KEY); return raw ? JSON.parse(raw) as Store : {} } catch { return {} }
}
function write(s: Store): void {
  try { storage.set(KEY, JSON.stringify(s)) } catch {}
}

/** Record one sample (ms). */
export function record(metric: Metric, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0 || ms > 120_000) return
  const s = read()
  const list = s[metric] ?? []
  list.push(Math.round(ms))
  s[metric] = list.slice(-MAX_SAMPLES)
  write(s)
}

/** Remember how big a stored blob is (chars ≈ bytes for this ASCII JSON). */
export function recordSize(which: 'buffer' | 'stats', chars: number): void {
  const s = read()
  s.sizes = { ...s.sizes, [which]: chars }
  write(s)
}

/** Time a synchronous function and record it. */
export function timed<T>(metric: Metric, fn: () => T): T {
  const t0 = now()
  try { return fn() } finally { record(metric, now() - t0) }
}

/** Native host start on the performance clock, or null if the runtime doesn't expose it. */
function nativeStart(): number | null {
  try {
    const t = (performance as unknown as { rnStartupTiming?: { startTime?: number | null } }).rnStartupTiming?.startTime
    return typeof t === 'number' && t > 0 && t <= JS_START ? t : null
  } catch { return null }
}

let coldStartDone = false
/** Call once the first real screen has content. Records cold start once per process. */
function markFirstContent(at: number): void {
  if (coldStartDone) return
  coldStartDone = true
  record('js_start', at - JS_START)
  const ns = nativeStart()
  if (ns !== null) record('cold_start', at - ns)
}

/**
 * The time of this component's first render. Call it on the FIRST line of a screen so
 * the synchronous work done while rendering (parsing storage, computing stats) counts.
 */
export function useRenderStart(): number {
  const t0 = useRef<number>(0)
  if (t0.current === 0) t0.current = now()
  return t0.current
}

/**
 * Record `metric` = `start` (from useRenderStart) → the first frame after `ready`
 * turns true. Once per mount. `firstContent` also closes the cold-start clock.
 */
export function useLoadTime(metric: Metric, start: number, ready: boolean, opts?: { firstContent?: boolean }): void {
  const done = useRef(false)
  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    // Next frame ≈ when the content is actually painted.
    requestAnimationFrame(() => {
      const at = now()
      record(metric, at - start)
      if (opts?.firstContent) markFirstContent(at)
    })
  }, [ready])
}

export interface MetricSummary { metric: Metric; label: string; median: number; last: number; count: number }

export function summary(): { rows: MetricSummary[]; sizes: Store['sizes'] } {
  const s = read()
  const rows: MetricSummary[] = []
  for (const m of METRICS) {
    const list = s[m]
    if (!list?.length) continue
    const sorted = [...list].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    rows.push({ metric: m, label: METRIC_LABEL[m], median, last: list[list.length - 1], count: list.length })
  }
  return { rows, sizes: s.sizes }
}

export function clearPerf(): void { try { storage.remove(KEY) } catch {} }

/** "840 ms" / "2.4 s". */
export function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
}
/** "3.2 MB" / "640 KB". */
export function fmtSize(chars: number): string {
  return chars >= 1_000_000 ? `${(chars / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(chars / 1000))} KB`
}
