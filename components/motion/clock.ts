import { useCallback } from 'react'
import { useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated'

// One frame's worth of time at most, so a long pause (app in the background) resumes
// where it left off instead of leaping ahead.
const MAX_STEP_MS = 100

/**
 * A running clock (ms) for endless motion: drifting blobs, waves, the aperture.
 *
 * Don't use `f.timeSinceFirstFrame` for this. `useFrameCallback` re-registers whenever
 * its callback changes (an inline arrow = every render), and a fresh registration
 * restarts that count at 0, so the motion snapped back to its first frame on every
 * parent re-render. That was the once-a-second "jump" on the Now Playing sheet,
 * whose clock re-renders it every second. This clock adds up frame deltas with a
 * stable callback, so re-renders and pauses don't reset it.
 */
export function useMotionClock(running: boolean): SharedValue<number> {
  const t = useSharedValue(0)
  const tick = useCallback((f: FrameInfo) => {
    'worklet'
    const dt = f.timeSincePreviousFrame ?? 0
    t.value += Math.min(Math.max(dt, 0), MAX_STEP_MS)
  }, [])
  useFrameCallback(tick, running)
  return t
}
