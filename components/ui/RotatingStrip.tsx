import React, { useEffect, useState } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'

/**
 * A quiet rotating line for the Lenses top strip — tips, music quotes, fun.
 * Fades between lines every few seconds. `override` lets a future remote banner
 * pin a message (announcements) without code changes.
 */
const LINES = [
  '✦  Every playlist tells a story.',
  '♪  Where words fail, music speaks.',
  '✦  Tap your taste profile to see the big picture.',
  '◐  New: import your lifetime history in Wrapped.',
  '♥  Pretending the aux is yours again.',
  '✦  Without music, life would be a mistake.',
  '☾  Your late-night playlist knows things.',
  '◍  Compare two playlists — see who really wins.',
  '✦  Skips are just unspoken opinions.',
  '♪  Good taste is a playlist away.',
]

export function RotatingStrip({ override }: { override?: string }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * LINES.length))
  const op = useSharedValue(1)

  useEffect(() => {
    if (override) return
    const id = setInterval(() => {
      op.value = withTiming(0, { duration: 350 })
      setTimeout(() => {
        setI(p => (p + 1) % LINES.length)
        op.value = withTiming(1, { duration: 350 })
      }, 370)
    }, 5200)
    return () => clearInterval(id)
  }, [override])

  const style = useAnimatedStyle(() => ({ opacity: op.value }))
  const text = override ?? LINES[i]

  return (
    <View style={styles.wrap}>
      <Animated.Text style={[styles.text, style]} numberOfLines={1}>{text}</Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  text: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
})
