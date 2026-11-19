import {
  useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation,
} from 'react-native-reanimated'
import { useMotionReduced } from './reduced'

/**
 * Motion #10 — Collapsing cover. Hook for a scroll view that opens on a cover hero:
 *   - the backdrop art scrolls at half speed and stretches when pulled past the top,
 *   - the centred cover and the title drift up, shrink and fade,
 *   - a compact title bar fades in once the hero has scrolled away.
 *
 *   const cc = useCollapsingCover(260)
 *   <Animated.ScrollView onScroll={cc.onScroll} scrollEventThrottle={16}>…
 *   <Animated.View style={[…, cc.backdrop]} /> <Animated.View style={cc.cover} /> …
 *   <Animated.View style={[styles.bar, cc.bar]} />   // absolutely placed over the top
 */
export function useCollapsingCover(heroH: number) {
  const reduced = useMotionReduced()
  const y = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler(e => { y.value = e.contentOffset.y })

  const backdrop = useAnimatedStyle(() => {
    if (reduced) return {}
    const pull = Math.max(0, -y.value)
    return {
      transform: [
        { translateY: y.value > 0 ? y.value * 0.5 : -pull / 2 },
        { scale: 1 + pull / heroH },
      ],
    }
  })
  const cover = useAnimatedStyle(() => {
    if (reduced) return {}
    const k = interpolate(y.value, [0, heroH * 0.8], [0, 1], Extrapolation.CLAMP)
    return { opacity: 1 - k * 0.8, transform: [{ translateY: y.value * 0.3 }, { scale: 1 - k * 0.22 }] }
  })
  const title = useAnimatedStyle(() => {
    if (reduced) return {}
    return {
      opacity: interpolate(y.value, [heroH * 0.25, heroH * 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: y.value * 0.18 }],
    }
  })
  const bar = useAnimatedStyle(() => {
    const k = interpolate(y.value, [heroH - 90, heroH - 40], [0, 1], Extrapolation.CLAMP)
    return { opacity: k, transform: [{ translateY: (1 - k) * -8 }] }
  })
  return { onScroll, scrollY: y, backdrop, cover, title, bar }
}
