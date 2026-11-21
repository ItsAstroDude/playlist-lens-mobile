import React from 'react'
import { type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'

/**
 * The now-playing progress underline's fill, driven by `progress` (0..1).
 *
 * It slides a full-width fill in from the left (translateX) inside the track's clip
 * instead of animating `width: %`. It looks the same, but `width` is a layout prop:
 * on the new architecture every frame of the minutes-long linear glide was a full
 * shadow-tree commit + layout + mount, at 120 Hz, even with the app sitting idle.
 * A transform skips all of that. The parent track must clip (overflow: 'hidden').
 */
export function ProgressFill({ progress, style }: { progress: SharedValue<number>; style?: StyleProp<ViewStyle> }) {
  const w = useSharedValue(0)
  const onLayout = (e: LayoutChangeEvent) => { w.value = e.nativeEvent.layout.width }
  const anim = useAnimatedStyle(() => ({
    opacity: w.value > 0 ? 1 : 0,
    transform: [{ translateX: (Math.min(Math.max(progress.value, 0), 1) - 1) * w.value }],
  }))
  return <Animated.View onLayout={onLayout} style={[style, { width: '100%' }, anim]} />
}
