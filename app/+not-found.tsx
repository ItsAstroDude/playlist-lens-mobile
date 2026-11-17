import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { Icon } from '@/components/ui/Icon'

/**
 * Shown for any route that doesn't exist (a stale deep link, a notification for
 * a screen that moved) — on-brand instead of Expo Router's default page.
 */
export default function NotFound() {
  const goHome = () => { haptic.light(); router.replace('/') }
  return (
    <View style={styles.container}>
      <AmbientBackground />
      <SafeAreaView style={styles.safe}>
        <Icon name="aperture-outline" size={56} color={alpha(Colors.greenPrimary, 0.8)} />
        <Text style={styles.title} accessibilityRole="header">Out of focus</Text>
        <Text style={styles.body}>That screen doesn’t exist — maybe an old link. Your lenses are right where you left them.</Text>
        <TouchableOpacity style={styles.btn} onPress={goHome} activeOpacity={0.85} accessibilityRole="button">
          <Icon name="arrow-back" size={16} color={Colors.background} />
          <Text style={styles.btnText}>Back to your lenses</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing['3xl'], gap: Spacing.md },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1, marginTop: Spacing.sm },
  body: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: FontSize.sm * 1.6 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: Radius.full,
    backgroundColor: Colors.greenPrimary,
  },
  btnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.background },
})
