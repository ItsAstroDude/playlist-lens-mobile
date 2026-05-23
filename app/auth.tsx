import React, { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { router } from 'expo-router'
import { BlurView } from 'expo-blur'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, GreenGlow } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

const { width, height } = Dimensions.get('window')

export default function AuthScreen() {
  const { login, isLoading, error } = useAuth()

  // ── Orb animation (pulsing blurred green glow) ──
  const orbScale   = useSharedValue(1)
  const orbOpacity = useSharedValue(0.5)

  // ── Entrance animations ──
  const logoY       = useSharedValue(20)
  const logoOpacity = useSharedValue(0)
  const btnY        = useSharedValue(30)
  const btnOpacity  = useSharedValue(0)
  const tagY        = useSharedValue(20)
  const tagOpacity  = useSharedValue(0)

  useEffect(() => {
    // Orb pulse — breathes in and out on repeat
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,  { duration: 2800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
    orbOpacity.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4,  { duration: 2800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )

    // Staggered entrance
    logoY.value       = withDelay(200, withSpring(0, Spring.entrance))
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 500 }))
    tagY.value        = withDelay(350, withSpring(0, Spring.entrance))
    tagOpacity.value  = withDelay(350, withTiming(1, { duration: 500 }))
    btnY.value        = withDelay(500, withSpring(0, Spring.entrance))
    btnOpacity.value  = withDelay(500, withTiming(1, { duration: 500 }))
  }, [])

  const orbStyle = useAnimatedStyle(() => ({
    transform:  [{ scale: orbScale.value }],
    opacity:    orbOpacity.value,
  }))
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoY.value }],
    opacity:   logoOpacity.value,
  }))
  const tagStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tagY.value }],
    opacity:   tagOpacity.value,
  }))
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: btnY.value }],
    opacity:   btnOpacity.value,
  }))

  const handleLogin = async () => {
    haptic.medium()
    const success = await login()
    if (success) {
      haptic.success()
      router.replace('/(tabs)')
    }
  }

  return (
    <View style={styles.container}>
      {/* Pulsing green orb behind everything */}
      <Animated.View style={[styles.orb, orbStyle]} pointerEvents="none">
        <BlurView intensity={80} tint="dark" style={styles.orbBlur} />
      </Animated.View>

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Text style={styles.logoText}>
          playlist<Text style={styles.logoDot}>.</Text>lens
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, tagStyle]}>
        Deep analysis for your Spotify playlists.{'\n'}Moods, genres, hidden gems, and more.
      </Animated.Text>

      {/* Login button */}
      <Animated.View style={[styles.btnWrap, btnStyle]}>
        <Button
          label="Login with Spotify"
          onPress={handleLogin}
          loading={isLoading}
          size="lg"
          fullWidth
          style={styles.loginBtn}
          textStyle={styles.loginBtnText}
        />
        {error && (
          <Text style={styles.error}>{error}</Text>
        )}
      </Animated.View>

      {/* Subtle bottom note */}
      <Animated.Text style={[styles.note, tagStyle]}>
        Your data never leaves your device.
      </Animated.Text>
    </View>
  )
}

const ORB_SIZE = width * 0.9

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: Spacing['3xl'],
    gap:             Spacing['2xl'],
  },

  // Pulsing glow orb
  orb: {
    position:     'absolute',
    width:         ORB_SIZE,
    height:        ORB_SIZE,
    borderRadius:  ORB_SIZE / 2,
    backgroundColor: Colors.greenPrimary,
    top:           height * 0.1,
    alignSelf:     'center',
    ...GreenGlow,
    shadowRadius:  80,
    shadowOpacity: 0.30,
  },
  orbBlur: {
    flex:         1,
    borderRadius: ORB_SIZE / 2,
  },

  // Logo
  logoWrap: { alignItems: 'center' },
  logoText: {
    fontFamily: FontFamily.syneBold,
    fontSize:   FontSize['4xl'],
    color:      Colors.text,
    letterSpacing: -3,
  },
  logoDot: { color: Colors.greenPrimary },

  // Tagline
  tagline: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.base,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: FontSize.base * 1.7,
    maxWidth:   280,
  },

  // Button
  btnWrap: {
    width:  '100%',
    gap:    Spacing.md,
    alignItems: 'center',
  },
  loginBtn: {
    borderRadius: 40,
    ...GreenGlow,
  },
  loginBtnText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.md,
  },

  error: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.error,
    textAlign:  'center',
  },

  note: {
    position:   'absolute',
    bottom:     Spacing['3xl'],
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textDim,
  },
})
