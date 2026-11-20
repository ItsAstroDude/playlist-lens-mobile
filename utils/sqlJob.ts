/**
 * Write a multi-query computation once, run it either way:
 *
 *   function* myStats(): Job<Result> {
 *     const a: Row[] = yield all('SELECT …', [x])
 *     const b: Row | null = yield first('SELECT …')
 *     yield exec('CREATE TEMP TABLE …')
 *     return combine(a, b)
 *   }
 *   runSync(myStats())        // cheap queries, tests
 *   await runAsync(myStats()) // heavy ones: on the stats connection, on SQLite's own thread
 *
 * Each `yield` hands one query to the runner and gets its result back.
 */
import { useEffect, useState } from 'react'
import { db, statsDb, playsVersion } from '@/utils/playDb'
import { storage } from '@/utils/cache'

type Args = (string | number | null)[]
export type Query =
  | { op: 'all'; sql: string; args: Args }
  | { op: 'first'; sql: string; args: Args }
  | { op: 'exec'; sql: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Job<T> = Generator<Query, T, any>

export const all   = (sql: string, args: Args = []): Query => ({ op: 'all', sql, args })
export const first = (sql: string, args: Args = []): Query => ({ op: 'first', sql, args })
export const exec  = (sql: string): Query => ({ op: 'exec', sql })

export function runSync<T>(job: Job<T>): T {
  const d = db()
  let step = job.next()
  while (!step.done) {
    const q = step.value
    let res: unknown
    try {
      res = q.op === 'all' ? d.getAllSync(q.sql, q.args)
        : q.op === 'first' ? d.getFirstSync(q.sql, q.args)
        : (d.execSync(q.sql), undefined)
    } catch (e) { step = job.throw(e); continue }   // lets the job's `finally` clean up
    step = job.next(res)
  }
  return step.value
}

/**
 * Runs on the second (stats) connection, so the screen's own quick queries on the main
 * connection never queue behind a long one.
 */
export async function runAsync<T>(job: Job<T>): Promise<T> {
  const d = statsDb()
  let step = job.next()
  while (!step.done) {
    const q = step.value
    let res: unknown
    try {
      res = q.op === 'all' ? await d.getAllAsync(q.sql, q.args)
        : q.op === 'first' ? await d.getFirstAsync(q.sql, q.args)
        : (await d.execAsync(q.sql), undefined)
    } catch (e) { step = job.throw(e); continue }
    step = job.next(res)
  }
  return step.value
}

// ─── cache ────────────────────────────────────────────────────────────────────
// Heavy answers only change when plays do; playDb counts every write, so checking
// costs nothing (no table scan on the UI thread).
const cache = new Map<string, { sig: string; value: Promise<unknown> }>()

/** Changes whenever a play is added, replaced or removed (or an import swaps in). */
export function playsSignature(): string {
  return String(playsVersion())
}

const PERSIST_PREFIX = 'stat_cache.v2.'
type Saved = { sig: string; value: unknown }

// Answers saved by 2.0.5 (no version stamp): drop them once.
try { for (const k of storage.getAllKeys()) if (k.startsWith('stat_cache.v1.')) storage.remove(k) } catch { /* best effort */ }

function readSaved(name: string): Saved | undefined {
  try {
    const raw = storage.getString(PERSIST_PREFIX + name)
    if (raw) { const v = JSON.parse(raw) as Saved; if (v && typeof v.sig === 'string') return v }
  } catch { /* unreadable — recompute */ }
  return undefined
}

/**
 * Run `make()` off the UI thread, once per (name, extra, plays signature). Callers asking
 * again before it finishes share the same promise. `extra` covers inputs that aren't
 * plays (the timezone, today's date). The last answer is also saved on the phone, so
 * `peekCached` can show it instantly next time — even after a restart — while the
 * fresh one is worked out.
 */
export function cachedAsync<T>(name: string, extra: string, make: () => Job<T>): Promise<T> {
  const sig = `${playsSignature()}|${extra}`
  const hit = cache.get(name)
  if (hit && hit.sig === sig) return hit.value as Promise<T>
  // Saved before a restart for these same plays? Then it's still the answer.
  const saved = readSaved(name)
  if (saved && saved.sig === sig) {
    const value = Promise.resolve(saved.value as T)
    cache.set(name, { sig, value }); last.set(name, saved.value)
    return value
  }
  const value = runAsync(make())
  cache.set(name, { sig, value })
  value.then(
    v => { last.set(name, v); try { storage.set(PERSIST_PREFIX + name, JSON.stringify({ sig, value: v })) } catch { /* best effort */ } },
    () => { if (cache.get(name)?.value === value) cache.delete(name) },
  )
  return value
}

const last = new Map<string, unknown>()

/** The last answer for `name` (this session or a saved one), or undefined. Instant. */
export function peekCached<T>(name: string): T | undefined {
  if (last.has(name)) return last.get(name) as T
  const saved = readSaved(name)
  if (saved) { last.set(name, saved.value); return saved.value as T }
  return undefined
}

/**
 * State for a heavy stat: starts from the last saved answer (instant), then swaps in
 * the fresh one when `run()` resolves. `loading` is true until the first fresh answer.
 * Re-runs when `deps` change; does nothing while `enabled` is false.
 * `peek: false` skips the saved answer (when it could belong to a different period).
 */
export function useCachedStat<T>(
  name: string, run: () => Promise<T>, deps: unknown[], opts: { enabled?: boolean; peek?: boolean } = {},
): { value: T | undefined; loading: boolean } {
  const enabled = opts.enabled ?? true
  const [value, setValue] = useState<T | undefined>(() => (opts.peek === false ? undefined : peekCached<T>(name)))
  const [loading, setLoading] = useState(enabled)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    setLoading(true)
    if (opts.peek === false) setValue(undefined)
    run().then(v => { if (alive) { setValue(v); setLoading(false) } }, () => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [enabled, ...deps])  // eslint-disable-line react-hooks/exhaustive-deps
  return { value, loading }
}

/** Forget every saved stat (Clear history). */
export function clearStatCache(): void {
  cache.clear(); last.clear()
  try { for (const k of storage.getAllKeys()) if (k.startsWith(PERSIST_PREFIX)) storage.remove(k) } catch { /* best effort */ }
}

/** Test hook. */
export function _clearJobCache(): void { cache.clear(); last.clear() }
