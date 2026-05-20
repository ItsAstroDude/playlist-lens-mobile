import React, { useEffect } from 'react'
import { View, StyleSheet, type ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated'
import { Colors, Radius } from '@/constants/theme'

interface SkeletonProps {
  width?:        number | `${number}%`
  height:        number
  borderRadius?: number
  style?:        ViewStyle
  // Pass an extracted palette color to tint the skeleton
  baseColor?:    string
}

export function Skeleton({
  width       = '100%',
  height,
  borderRadius = 8,
  style,
  baseColor,
}: SkeletonProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
  }, [])

  const animStyle = useAnimatedStyle(() => {
    const base   = baseColor ? `${baseColor}22` : 'rgba(255,255,255,0.06)'
    const bright = baseColor ? `${baseColor}44` : 'rgba(255,255,255,0.12)'
    return {
      backgroundColor: interpolateColor(progress.value, [0, 1], [base, bright]),
    }
  })

  return (
    <Animated.View
      style={[
        animStyle,
        { width, height, borderRadius },
        style,
      ]}
    />
  )
}

// ─── Skeleton presets ─────────────────────────────────────────────────────────
interface SkeletonCardProps {
  baseColor?: string
  style?:     ViewStyle
}

export function PlaylistCardSkeleton({ baseColor, style }: SkeletonCardProps) {
  return (
    <View style={[skStyles.card, style]}>
      <Skeleton height={140} borderRadius={10} baseColor={baseColor} style={{ marginBottom: 10 }} />
      <Skeleton height={12}  width="80%"  borderRadius={6} baseColor={baseColor} style={{ marginBottom: 6 }} />
      <Skeleton height={10}  width="50%"  borderRadius={6} baseColor={baseColor} />
    </View>
  )
}

export function StatCardSkeleton({ baseColor }: { baseColor?: string }) {
  return (
    <View style={skStyles.statCard}>
      <Skeleton height={10} width="60%" borderRadius={4} baseColor={baseColor} style={{ marginBottom: 8 }} />
      <Skeleton height={28} width="80%" borderRadius={6} baseColor={baseColor} />
    </View>
  )
}

export function ChartSkeleton({ baseColor }: { baseColor?: string }) {
  return (
    <View style={skStyles.chart}>
      <Skeleton height={10} width="40%" borderRadius={4} baseColor={baseColor} style={{ marginBottom: 16 }} />
      <Skeleton height={180} borderRadius={10} baseColor={baseColor} />
    </View>
  )
}

const skStyles = StyleSheet.create({
  card: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chart: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
})
