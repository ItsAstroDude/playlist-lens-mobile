import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { Spring } from '@/constants/animation'
import { Button } from './Button'

// ─── Cold Start Overlay ───────────────────────────────────────────────────────

interface ColdStartOverlayProps {
  visible: boolean
}

export function ColdStartOverlay({ visible }: ColdStartOverlayProps) {
  const opacity    = useSharedValue(0)
  const translateY = useSharedValue(8)

  // Elapsed timer so the user can see something is progressing
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (visible) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [visible])

  useEffect(() => {
    if (visible) {
      opacity.value    = withSpring(1, Spring.entrance)
      translateY.value = withSpring(0, Spring.entrance)
    } else {
      opacity.value    = withSpring(0, Spring.snappy)
      translateY.value = withSpring(8, Spring.snappy)
    }
  }, [visible])

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const subCopy =
    elapsed < 8  ? 'Render cold starts take ~15–30s' :
    elapsed < 20 ? 'Still waking up, hang tight…'    :
                   'Almost there…'

  return (
    <Animated.View style={[styles.container, animStyle]} pointerEvents="none">
      <View style={styles.pill}>
        <View style={styles.dotWrap}>
          <PulseRings />
          <View style={styles.dot} />
        </View>
        <Text style={styles.text}>
          Waking up the server
          <Text style={styles.elapsed}>{'  '}{elapsed}s</Text>
        </Text>
      </View>
      <Text style={styles.sub}>{subCopy}</Text>
    </Animated.View>
  )
}

// Three concentric rings that pulse outward from the amber dot
function PulseRings() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <PulseRing delay={0} />
      <PulseRing delay={500} />
      <PulseRing delay={1000} />
    </View>
  )
}

function PulseRing({ delay }: { delay: number }) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    )
  }, [])

  const style = useAnimatedStyle(() => ({
    position:     'absolute',
    inset:        0,
    borderRadius: 99,
    borderWidth:  1,
    borderColor:  Colors.greenPrimary,
    opacity:      interpolate(progress.value, [0, 0.4, 1], [0.45, 0.15, 0]),
    transform:    [{ scale: interpolate(progress.value, [0, 1], [1, 3.4]) }],
  }))

  return <Animated.View style={style} />
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

  useEffect(() => {
    translateY.value = withDelay(100, withSpring(0, Spring.default))
    opacity.value    = withDelay(100, withSpring(1, Spring.entrance))
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }))

  return (
    <Animated.View style={[styles.retryContainer, animStyle]}>
      <View style={styles.retrySpecular} />
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const DOT = 8

const styles = StyleSheet.create({
  container: {
    alignItems:      'center',
    gap:             Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.sm,
    backgroundColor:   Colors.greenSubtle,
    borderWidth:       1,
    borderColor:       alpha(Colors.greenPrimary, 0.22),
    borderRadius:      Radius.full,
    paddingVertical:   Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  dotWrap: {
    width:          DOT,
    height:         DOT,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dot: {
    width:           DOT,
    height:          DOT,
    borderRadius:    DOT / 2,
    backgroundColor: Colors.greenPrimary,
    shadowColor:     Colors.greenPrimary,
    shadowOpacity:   0.8,
    shadowRadius:    6,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       4,
  },
  text: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.greenPrimary,
  },
  elapsed: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      alpha(Colors.greenPrimary, 0.45),
  },
  sub: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },

  // RetryBanner
  retryContainer: {
    backgroundColor:  Colors.glass,
    borderWidth:      1,
    borderColor:      `${Colors.error}30`,
    borderRadius:     Radius.lg,
    padding:          Spacing.xl,
    alignItems:       'center',
    gap:              Spacing.md,
    marginHorizontal: Spacing.lg,
    overflow:         'hidden',
  },
  retrySpecular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: Colors.glassHighlight,
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
