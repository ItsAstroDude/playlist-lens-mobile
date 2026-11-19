import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { usePathname } from 'expo-router'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha, activeThemeMode } from '@/constants/theme'
import { Spring } from '@/constants/animation'
import { useServerWaking } from '@/hooks/useServerWaking'
import { wakeCopy, wakeProgress } from '@/utils/serverStatus'
import { WakeDot } from './ServerState'

/**
 * Root-mounted "Waking up the server · 12s" pill. Shows on every screen while the
 * free-tier backend boots, with how long it's been and what to expect. The Lenses
 * tab shows the same thing inline in its header, so the banner sits that one out.
 */
export function ServerWakeBanner() {
  const elapsed  = useServerWaking()
  const pathname = usePathname()
  const insets   = useSafeAreaInsets()
  const visible  = elapsed !== null && pathname !== '/'

  // Keep the last count on screen while it fades out.
  const [shown, setShown] = useState<number | null>(null)
  useEffect(() => { if (elapsed !== null) setShown(elapsed) }, [elapsed])

  const y = useSharedValue(-24)
  const o = useSharedValue(0)
  useEffect(() => {
    if (visible) {
      y.value = withSpring(0, Spring.entrance)
      o.value = withTiming(1, { duration: 180 })
    } else {
      y.value = withTiming(-24, { duration: 220 })
      o.value = withTiming(0, { duration: 220 }, done => { if (done) runOnJS(setShown)(null) })
    }
  }, [visible])

  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }))

  if (shown === null) return null
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + Spacing.sm }, style]}>
      <View
        style={styles.card}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Waking up the server, ${shown} seconds. ${wakeCopy(shown)}`}
      >
        <BlurView intensity={30} tint={activeThemeMode() === 'light' ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
        <View style={styles.specular} />
        <View style={styles.row}>
          <WakeDot />
          <Text style={styles.title}>
            Waking up the server
            <Text style={styles.elapsed}>{'  '}{shown}s</Text>
          </Text>
        </View>
        <Text style={styles.sub} numberOfLines={1}>{wakeCopy(shown)}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(wakeProgress(shown) * 100)}%` }]} />
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: Spacing.lg, right: Spacing.lg,
    alignItems: 'center', zIndex: 55,   // under toasts (60)
  },
  card: {
    width: '100%', maxWidth: 420, gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.22),
    backgroundColor: Colors.sheet, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12,
  },
  specular: { position: 'absolute', top: 0, left: Spacing.lg, right: Spacing.lg, height: 1, backgroundColor: Colors.glassHighlight },
  row:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.greenPrimary },
  elapsed: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: alpha(Colors.greenPrimary, 0.55) },
  sub:     { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  track:   { height: 2, borderRadius: 1, backgroundColor: alpha(Colors.greenPrimary, 0.15), overflow: 'hidden', marginTop: 2 },
  fill:    { height: 2, borderRadius: 1, backgroundColor: Colors.greenPrimary },
})
