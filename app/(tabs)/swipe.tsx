import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'

export default function SwipeTab() {
  // gentle pulse on the placeholder glyph
  const pulse = useSharedValue(1)
  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,  { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    )
  }, [])
  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))

  return (
    <View style={styles.container}>
      <View style={styles.ambientViolet} pointerEvents="none" />
      <View style={styles.ambientPink}   pointerEvents="none" />
      <LinearGradient colors={[Colors.auroraTop, Colors.auroraBot]} style={styles.aurora} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.logo}>playlist<Text style={styles.dot}>.</Text>lens</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>swipe</Text>
          <Text style={styles.sub}>Refresh a playlist with swipes</Text>
        </View>

        <View style={styles.center}>
          <Animated.View style={[styles.glyphWrap, glyphStyle]}>
            <View style={styles.cardBack} />
            <View style={styles.cardFront}>
              <Text style={styles.heart}>♥</Text>
            </View>
          </Animated.View>
          <Text style={styles.soon}>Coming soon</Text>
          <Text style={styles.blurb}>
            Listen to snippets and swipe right to keep,{'\n'}left to cut — then save it back to Spotify.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  ambientViolet: { position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.violetGlow },
  ambientPink:   { position: 'absolute', bottom: -100, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: Colors.pinkGlow },
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  safe: { flex: 1, zIndex: 1 },

  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  logo: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, letterSpacing: -1 },
  dot: { color: Colors.greenPrimary },
  titleBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: 3 },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1 },
  sub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingBottom: 80 },
  glyphWrap: { width: 140, height: 160, alignItems: 'center', justifyContent: 'center' },
  cardBack: { position: 'absolute', width: 110, height: 150, borderRadius: Radius.xl, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, transform: [{ rotate: '8deg' }, { translateX: 14 }] },
  cardFront: { width: 110, height: 150, borderRadius: Radius.xl, backgroundColor: 'rgba(83,224,118,0.08)', borderWidth: 1, borderColor: 'rgba(83,224,118,0.3)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  heart: { fontSize: 48, color: Colors.greenPrimary },
  soon: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.textSecondary, letterSpacing: -0.5 },
  blurb: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: FontSize.sm * 1.6 },
})
