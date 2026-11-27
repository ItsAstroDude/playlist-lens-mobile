import React from 'react'
import { PixelRatio, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'

/**
 * The now-playing progress underline's fill, driven by `progress` (0..1).
 *
 * It slides a full-width fill in from the left (translateX) inside the track's clip
 * instead of animating `width: %`. It looks the same, but `width` is a layout prop:
 * on the new architecture every frame of the minutes-long linear glide was a full
 * shadow-tree commit + layout + mount, at 120 Hz, even with the app sitting idle.
 * A transform skips the layout, but Reanimated 4.1 on Android still commits every
 * changed transform, and a 3-minute song moves the fill a fraction of a pixel per
 * frame, so the whole screen redrew at 120 Hz while you sat still. The offset is
 * snapped to whole physical pixels and handed to the style only when that pixel
 * changes (a reaction feeds `x`; the style re-runs only when `x` does — returning a
 * rounded number alone isn't enough, the transform array is new every frame). So the
 * slow glide commits a few times a second and looks identical (on screen it moves in
 * pixel steps either way). The 250 ms catch-up still moves every frame.
 * The parent track must clip (overflow: 'hidden').
 */
const PX = PixelRatio.get()
export function ProgressFill({ progress, style }: { progress: SharedValue<number>; style?: StyleProp<ViewStyle> }) {
  const w = useSharedValue(0)
  const x = useSharedValue(0)
  const onLayout = (e: LayoutChangeEvent) => { w.value = e.nativeEvent.layout.width }
  useAnimatedReaction(
    () => Math.round((Math.min(Math.max(progress.value, 0), 1) - 1) * w.value * PX) / PX,
    (cur, prev) => { if (cur !== prev) x.value = cur },
  )
  const anim = useAnimatedStyle(() => ({
    opacity: w.value > 0 ? 1 : 0,
    transform: [{ translateX: x.value }],
  }))
  return <Animated.View onLayout={onLayout} style={[style, { width: '100%' }, anim]} />
}
