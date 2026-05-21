import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { useAuth } from '@/hooks/useAuth'

const { width: W, height: H } = Dimensions.get('window')

// The gear rests at horizontal center, near the bottom of the screen
const GEAR_SIZE    = 120
const GEAR_REST_X  = 0                    // translateX = 0 → centered
const GEAR_REST_Y  = 0                    // final resting Y (relative to resting anchor)
// Start position: gear button is top-right, ~40px from edge, ~60px from top
// Offset from the gear's resting anchor (center-bottom area)
const GEAR_START_X =  W / 2 - 52         // swings in from the right
const GEAR_START_Y = -(H * 0.72)         // launches from near top of screen

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  )
}

// ─── Settings row ─────────────────────────────────────────────────────────────
function SettingRow({
  icon, label, value, onPress, danger, last,
}: {
  icon:     keyof typeof Ionicons.glyphMap
  label:    string
  value?:   string
  onPress?: () => void
  danger?:  boolean
  last?:    boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons
          name={icon}
          size={16}
          color={danger ? Colors.error : Colors.textMuted}
        />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && !danger && (
        <Ionicons name="chevron-forward" size={14} color={Colors.textDim} />
      )}
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { logout } = useAuth()

  // ── Gear drop animation values ──
  const gearX       = useSharedValue(GEAR_START_X)
  const gearY       = useSharedValue(GEAR_START_Y)
  const gearRotate  = useSharedValue(0)
  const gearOpacity = useSharedValue(0)
  const gearScale   = useSharedValue(0.3)

  // Content fades in behind the falling gear
  const contentOpacity = useSharedValue(0)

  useEffect(() => {
    // Gear appears immediately at starting position
    gearOpacity.value = withTiming(1, { duration: 80 })

    // X: swings leftward — gentler spring, slight overshoot
    gearX.value = withSpring(GEAR_REST_X, {
      mass:      1.2,
      damping:   14,
      stiffness: 80,
    })

    // Y: falls with gravity feel — fast spring, small bounce at landing
    gearY.value = withSpring(GEAR_REST_Y, {
      mass:      1.0,
      damping:   16,
      stiffness: 120,
    })

    // Scale up from button size to full gear size
    gearScale.value = withSpring(1, {
      mass:      1,
      damping:   18,
      stiffness: 100,
    })

    // Spin during fall: 3 fast rotations, then slow idle spin
    gearRotate.value = withSequence(
      // Fast spin while falling (~600ms worth of rotation)
      withTiming(3 * 360, { duration: 700, easing: Easing.out(Easing.quad) }),
      // Settle into slow continuous idle rotation
      withRepeat(
        withTiming(3 * 360 + 360, { duration: 8000, easing: Easing.linear }),
        -1,
        false,
      ),
    )

    // Content fades in just after the gear starts its arc
    contentOpacity.value = withDelay(120, withTiming(1, { duration: 350 }))
  }, [])

  const gearStyle = useAnimatedStyle(() => ({
    opacity:   gearOpacity.value,
    transform: [
      { translateX: gearX.value },
      { translateY: gearY.value },
      { scale:      gearScale.value },
      { rotate:     `${gearRotate.value}deg` },
    ],
  }))

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }))

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Falling gear — absolute, centered horizontally, anchored to bottom */}
      <View style={styles.gearAnchor} pointerEvents="none">
        <Animated.View style={[styles.gearWrap, gearStyle]}>
          <Ionicons name="settings" size={GEAR_SIZE} color={Colors.glassBorder} />
        </Animated.View>
      </View>

      {/* Page content fades in behind the gear */}
      <Animated.View style={[{ flex: 1 }, contentStyle]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.heading}>settings</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* App */}
          <Section label="app">
            <SettingRow icon="notifications-outline" label="Notifications"  value="Coming soon" last />
          </Section>

          {/* Spotify */}
          <Section label="spotify">
            <SettingRow icon="musical-notes-outline" label="Extended quota mode" value="Coming soon" />
            <SettingRow icon="refresh-outline"       label="Clear cache"          value="Coming soon" last />
          </Section>

          {/* About */}
          <Section label="about">
            <SettingRow icon="information-circle-outline" label="Version"    value="1.0.0" />
            <SettingRow icon="code-slash-outline"         label="Built with" value="Expo SDK 54" last />
          </Section>

          {/* Account */}
          <Section label="account">
            <SettingRow
              icon="log-out-outline"
              label="Log out"
              onPress={logout}
              danger
              last
            />
          </Section>

          {/* Bottom padding so content doesn't hide under the gear */}
          <View style={{ height: GEAR_SIZE + 20 }} />
        </ScrollView>

      </Animated.View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Gear anchor sits at the bottom-center of the screen
  gearAnchor: {
    position:       'absolute',
    bottom:         -GEAR_SIZE * 0.3,   // slightly clipped at bottom
    left:           0,
    right:          0,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         10,
  },
  gearWrap: {
    width:          GEAR_SIZE,
    height:         GEAR_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
    opacity:        0.18,               // subtle, behind the content
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
  },
  backBtn: {
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily:    FontFamily.display,
    fontSize:      FontSize.xl,
    fontWeight:    '800',
    color:         Colors.text,
    letterSpacing: -0.5,
  },

  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 20, gap: Spacing.lg },

  // Section
  section:      { gap: Spacing.xs },
  sectionLabel: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    paddingLeft:   Spacing.xs,
  },
  sectionCard: {
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    borderRadius:    Radius.lg,
    overflow:        'hidden',
  },

  // Row
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  rowLast:        { borderBottomWidth: 0 },
  rowIcon: {
    width:           28,
    height:          28,
    borderRadius:    Radius.sm,
    backgroundColor: Colors.glass,
    alignItems:      'center',
    justifyContent:  'center',
  },
  rowIconDanger:    { backgroundColor: `${Colors.error}15` },
  rowLabel: {
    flex:       1,
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.text,
  },
  rowLabelDanger: { color: Colors.error },
  rowValue: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textDim,
  },
})
