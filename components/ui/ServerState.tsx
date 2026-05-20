import React, { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme'
import { Spring } from '@/constants/animation'
import { Button } from './Button'

interface ColdStartOverlayProps {
  visible: boolean
}

// Shown when a request takes > 3s — Railway free tier wake-up
export function ColdStartOverlay({ visible }: ColdStartOverlayProps) {
  const opacity    = useSharedValue(0)
  const translateY = useSharedValue(10)
  const dotScale   = useSharedValue(1)

  useEffect(() => {
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [])

  useEffect(() => {
    if (visible) {
      opacity.value    = withSpring(1, Spring.entrance)
      translateY.value = withSpring(0, Spring.entrance)
    } else {
      // Let exit animation play before becoming non-interactive
      opacity.value    = withSpring(0, Spring.snappy)
      translateY.value = withSpring(10, Spring.snappy)
    }
  }, [visible])

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }))

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={styles.pill}>
        <Animated.View style={[styles.dot, dotStyle]} />
        <Text style={styles.text}>Waking up the server…</Text>
      </View>
      <Text style={styles.sub}>Render cold starts can take up to 30 seconds</Text>
    </Animated.View>
  )
}

// ─── Retry Banner ─────────────────────────────────────────────────────────────
interface RetryBannerProps {
  message:  string
  onRetry:  () => void
  loading?: boolean
}

export function RetryBanner({ message, onRetry, loading }: RetryBannerProps) {
  const translateY = useSharedValue(40)
  const opacity    = useSharedValue(0)

  React.useEffect(() => {
    translateY.value = withDelay(100, withSpring(0, Spring.default))
    opacity.value    = withDelay(100, withSpring(1, Spring.entrance))
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }))

  return (
    <Animated.View style={[styles.retryContainer, animStyle]}>
      <Text style={styles.retryMessage}>{message}</Text>
      <Button
        label={loading ? 'Retrying…' : 'Retry Connection'}
        onPress={onRetry}
        loading={loading}
        size="sm"
        style={styles.retryButton}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.sm,
    backgroundColor: 'rgba(255,179,71,0.1)',
    borderWidth:     1,
    borderColor:     'rgba(255,179,71,0.25)',
    borderRadius:    99,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.warning,
  },
  text: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.warning,
  },
  sub: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },

  // Retry
  retryContainer: {
    backgroundColor: Colors.errorSubtle,
    borderWidth:     1,
    borderColor:     `${Colors.error}33`,
    borderRadius:    14,
    padding:         Spacing.xl,
    alignItems:      'center',
    gap:             Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  retryMessage: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.base,
    color:      Colors.error,
    textAlign:  'center',
    lineHeight: FontSize.base * 1.6,
  },
  retryButton: {
    borderColor: Colors.error,
  },
})
