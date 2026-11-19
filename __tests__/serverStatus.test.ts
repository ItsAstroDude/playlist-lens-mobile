import {
  trackRequest, markHeard, likelyAsleep, getWakingSince, onWakingChange, isAppResponse,
  wakeCopy, wakeProgress, WAKE_THRESHOLD_MS, LIKELY_ASLEEP_AFTER_MS, __resetServerStatus,
} from '../utils/serverStatus'

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1_000_000_000); __resetServerStatus() })
afterEach(() => { jest.useRealTimers() })

describe('serverStatus', () => {
  it('flags waking when a request to a possibly-asleep server stays silent past the threshold', () => {
    const seen: (number | null)[] = []
    onWakingChange(s => seen.push(s))
    const start = Date.now()
    const req = trackRequest()
    jest.advanceTimersByTime(WAKE_THRESHOLD_MS - 1)
    expect(getWakingSince()).toBeNull()
    jest.advanceTimersByTime(1)
    expect(getWakingSince()).toBe(start)   // timed from when the request began
    req.heard(); req.done()
    expect(getWakingSince()).toBeNull()
    expect(seen).toEqual([start, null])
  })

  it('does not flag a fast request', () => {
    const req = trackRequest()
    jest.advanceTimersByTime(500)
    req.heard(); req.done()
    jest.advanceTimersByTime(WAKE_THRESHOLD_MS * 2)
    expect(getWakingSince()).toBeNull()
  })

  it('does not flag a slow request when the server answered recently (it is awake, just slow)', () => {
    markHeard()
    jest.advanceTimersByTime(60_000)
    const req = trackRequest()
    jest.advanceTimersByTime(WAKE_THRESHOLD_MS * 3)
    expect(getWakingSince()).toBeNull()
    req.done()
  })

  it('treats the server as possibly asleep again after the idle window', () => {
    markHeard()
    expect(likelyAsleep()).toBe(false)
    jest.advanceTimersByTime(LIKELY_ASLEEP_AFTER_MS + 1)
    expect(likelyAsleep()).toBe(true)
  })

  it('clears once every pending request has given up (offline), but not before', () => {
    const a = trackRequest(); const b = trackRequest()
    jest.advanceTimersByTime(WAKE_THRESHOLD_MS)
    expect(getWakingSince()).not.toBeNull()
    a.done()
    expect(getWakingSince()).not.toBeNull()
    b.done()
    expect(getWakingSince()).toBeNull()
  })

  it('treats Render gateway errors as "still booting", everything else as the app answering', () => {
    expect(isAppResponse(200)).toBe(true)
    expect(isAppResponse(404)).toBe(true)
    expect(isAppResponse(500)).toBe(true)
    expect(isAppResponse(502)).toBe(false)
    expect(isAppResponse(503)).toBe(false)
    expect(isAppResponse(504)).toBe(false)
  })

  it('copy and progress move along with the wait and never claim to be done', () => {
    expect(wakeCopy(2)).toMatch(/30–60s/)
    expect(wakeCopy(100)).toMatch(/longer than usual/)
    expect(wakeProgress(0)).toBe(0)
    expect(wakeProgress(30)).toBeGreaterThan(wakeProgress(10))
    expect(wakeProgress(10_000)).toBeLessThanOrEqual(0.95)
  })
})
