import { useCallback, useRef, useState } from 'react'
import { runOnJS } from 'react-native-reanimated'

const NONE = Symbol('unsettled')

/**
 * For one-shot entrances (ripple, rack focus, rolling digits): once the animation has
 * landed, the component re-renders as a plain View with the identical end-state style.
 *
 * Why: Reanimated 4 (Fabric) keeps the last animated props of every mounted animated
 * view in a registry and re-applies ALL of them on every commit, including the
 * ScrollView's scroll-offset commits. Nothing removes an entry but unmounting the
 * view. Wrapped → Year/All time mounts a few hundred entrance-animated views and keeps
 * them for the life of the tab, so every scroll frame anywhere in the app re-sent their
 * props + layout (~270 mount instructions, up to 13 ms on the UI thread).
 *
 * The motion is unchanged: same values, same timing; it just stops being "animated"
 * after it ends. `key` is what the animation is heading to (trigger, digit…): settled
 * only holds for the key it landed on, so a new key renders the animated view in the
 * very same render (from wherever the value sits) and the animation plays as before.
 *
 *   const { settled, begin, settleNow } = useSettle(trigger)
 *   useEffect(() => { v.value = withTiming(1, cfg, begin()) }, [trigger])
 *   if (settled) return <View style={finalStyle} />
 */
export function useSettle(key: unknown) {
  const [settledKey, setSettledKey] = useState<unknown>(NONE)
  const keyRef = useRef(key)
  keyRef.current = key
  const gen = useRef(0)
  const keyAt = useRef<unknown>(NONE)

  const done = useCallback((g: number) => {
    if (g === gen.current) setSettledKey(keyAt.current)
  }, [])

  /** Call when starting the animation; pass the result as its completion callback. */
  const begin = useCallback(() => {
    const g = ++gen.current
    keyAt.current = keyRef.current
    // Only a landed animation settles: one cancelled by a replay reports finished = false.
    return (finished?: boolean) => {
      'worklet'
      if (finished) runOnJS(done)(g)
    }
  }, [done])

  /** Already at rest with no animation (Reduce motion). */
  const settleNow = useCallback(() => {
    gen.current++
    setSettledKey(keyRef.current)
  }, [])

  return { settled: Object.is(settledKey, key), begin, settleNow }
}
