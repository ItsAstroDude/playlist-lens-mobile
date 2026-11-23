/**
 * Server wake-up tracking.
 *
 * The backend runs on Render's free tier, which puts the server to sleep after
 * ~15 minutes without traffic. The first request after that hangs until it boots
 * (typically 30–60s). Previously only the Lenses list said so — every other
 * screen (and the login screen) just sat there with no hint of how long to wait.
 *
 * Every `apiFetch` (and the launch / foreground warm-up ping) reports here:
 *   • a request still unanswered after WAKE_THRESHOLD_MS, when we hadn't heard from
 *     the server for a sleep window before it and haven't since → "waking", timed
 *     from when that request started
 *   • any HTTP answer from the server → awake again
 *   • every tracked request gave up (offline) → stop claiming we're waking it
 *
 * The spot (components/spot) and the Lenses header render this state.
 */

export const WAKE_THRESHOLD_MS = 3000
/** Render sleeps after 15 min idle — warm up a little before that. */
export const LIKELY_ASLEEP_AFTER_MS = 14 * 60_000
/** What a cold start usually takes, for the copy and the progress bar. */
export const TYPICAL_WAKE_S = 60

type Listener = (wakingSince: number | null) => void

let wakingSince: number | null = null
let lastHeardAt = 0
let pending = 0
const listeners = new Set<Listener>()

function emit() { listeners.forEach(l => l(wakingSince)) }

/** Epoch ms the current wake-up began, or null when the server isn't known to be waking. */
export function getWakingSince(): number | null { return wakingSince }

export function onWakingChange(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** True when we haven't heard from the server recently enough to assume it's up. */
export function likelyAsleep(now = Date.now()): boolean {
  return lastHeardAt === 0 || now - lastHeardAt > LIKELY_ASLEEP_AFTER_MS
}

/** The server answered (any HTTP response that came from the app itself). */
export function markHeard(now = Date.now()) {
  lastHeardAt = now
  if (wakingSince !== null) { wakingSince = null; emit() }
}

/**
 * Track one request to the backend. Call `heard()` when the server answers and
 * `done()` once the request is finished (success or failure, after retries).
 */
export function trackRequest(now = Date.now()): { heard: () => void; done: () => void } {
  const startedAt = now
  // Heard from it within the sleep window → it's up; a slow answer is just slow.
  const mayBeAsleep = likelyAsleep(now)
  let finished = false
  pending++
  const timer = setTimeout(() => {
    // Only claim "waking" if the server has stayed silent since this request began.
    if (!mayBeAsleep || finished || lastHeardAt >= startedAt || wakingSince !== null) return
    wakingSince = startedAt
    emit()
  }, WAKE_THRESHOLD_MS)

  return {
    heard: () => markHeard(),
    done: () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      pending = Math.max(0, pending - 1)
      // Nothing left waiting on the server (e.g. all failed offline) → stop the banner.
      if (pending === 0 && wakingSince !== null) { wakingSince = null; emit() }
    },
  }
}

/** Is this HTTP status from the app itself (awake), not Render's proxy while it boots? */
export function isAppResponse(status: number): boolean {
  return status < 502 || status > 504
}

/** Copy for the wake-up indicator, by seconds waited so far. */
export function wakeCopy(elapsedS: number): string {
  if (elapsedS < 15) return 'The free server naps when idle · usually back in 30–60s'
  if (elapsedS < 45) return 'Still booting · usually under a minute'
  if (elapsedS < 90) return 'Almost there…'
  return 'Taking longer than usual · hang tight'
}

/** Rough progress for the bar: eases toward ~95% over a typical wake, never "done" early. */
export function wakeProgress(elapsedS: number): number {
  return Math.min(0.95, 1 - Math.exp(-elapsedS / (TYPICAL_WAKE_S / 2.2)))
}

/** Test-only: reset module state. */
export function __resetServerStatus() {
  wakingSince = null; lastHeardAt = 0; pending = 0; listeners.clear()
}
