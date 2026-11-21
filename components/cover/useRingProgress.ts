import { useEffect, useRef } from 'react'
import {
  useSharedValue, withSpring, withTiming, withSequence, cancelAnimation, Easing,
  type SharedValue,
} from 'react-native-reanimated'
import { Spring } from '@/constants/animation'

export interface RingTrack {
  id:          string | null
  playing:     boolean
  progressMs:  number
  durationMs:  number
  /** Client clock when progressMs was read (Date.now()). */
  receivedAt:  number
}

/** Fraction of the track played right now, 0–1. */
export function liveFraction(t: RingTrack, now = Date.now()): number {
  if (!t.durationMs || t.durationMs <= 0) return 0
  const ms = t.progressMs + (t.playing ? Math.max(0, now - t.receivedAt) : 0)
  return Math.min(1, Math.max(0, ms / t.durationMs))
}

/**
 * The ring's progress (0–1) as a shared value, animated on the UI thread: between
 * polls it runs a linear timing to the end of the track, so no JS work per frame.
 * A new track rewinds the ring with the bouncy spring; a seek or resync uses the
 * snappy one. Under Reduce motion it just jumps.
 */
export function useRingProgress(track: RingTrack | null, reduced: boolean): SharedValue<number> {
  const p = useSharedValue(0)
  const lastId = useRef<string | null>(null)

  useEffect(() => {
    if (!track || !track.durationMs) {
      lastId.current = null
      cancelAnimation(p)
      p.value = reduced ? 0 : withSpring(0, Spring.snappy)
      return
    }
    const target = liveFraction(track)
    const changed = lastId.current !== track.id
    lastId.current = track.id

    if (reduced) { cancelAnimation(p); p.value = target; return }
    if (!track.playing) { p.value = withSpring(target, Spring.snappy); return }

    const remaining = Math.max(0, track.durationMs * (1 - target))
    const run = withTiming(1, { duration: remaining, easing: Easing.linear })
    if (changed || Math.abs(p.value - target) > 0.015) {
      p.value = withSequence(withSpring(target, changed ? Spring.bouncy : Spring.snappy), run)
    } else {
      p.value = run   // close enough: carry on from where the ring is
    }
  }, [track?.id, track?.playing, track?.progressMs, track?.durationMs, track?.receivedAt, reduced])

  return p
}
