import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, Switch, TextInput,
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
import {
  Colors, FontFamily, FontSize, Spacing, Radius,
  ACCENTS, FONTS, activeAccentId, activeFontId, activeThemeMode,
} from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { useAuth } from '@/hooks/useAuth'
import { clearCaches } from '@/utils/cache'
import {
  hapticsEnabled, setHapticsEnabled,
  reduceMotionEnabled, setReduceMotionEnabled,
  artworkEnabled, setArtworkEnabled,
  getAccentId, setAccentId, getFontId, setFontId,
  getThemeMode, setThemeMode, type ThemeMode,
  getCustomQuote, setCustomQuote,
  NAVBAR_STYLES, getNavbarStyle, setNavbarStyle, launchNavbarStyle, type NavbarStyle,
} from '@/utils/settings'
import { clearWrappedStats } from '@/hooks/useWrapped'
import { loadArtReports } from '@/hooks/useArtwork'
import { checkForUpdate, applyUpdate, otaEnabled, currentUpdateLabel, reloadApp } from '@/utils/updates'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { emitOpenTutorial, emitOpenWhatsNew } from '@/utils/overlayEvents'
import { latestPatch } from '@/utils/whatsNew'
import type { SpotifyUser } from '@/types'

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

// ─── Toggle row ───────────────────────────────────────────────────────────────
function ToggleRow({
  icon, label, value, onValueChange, last,
}: {
  icon:          keyof typeof Ionicons.glyphMap
  label:         string
  value:         boolean
  onValueChange: (v: boolean) => void
  last?:         boolean
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={Colors.textMuted} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.glassBorder, true: 'rgba(83,224,118,0.45)' }}
        thumbColor={value ? Colors.greenPrimary : '#9a9a9a'}
        ios_backgroundColor={Colors.glassBorder}
      />
    </View>
  )
}

// ─── Accent swatches ──────────────────────────────────────────────────────────
function AccentPicker({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  return (
    <View style={styles.swatchRow}>
      {ACCENTS.map(a => {
        const active = a.id === value
        return (
          <TouchableOpacity
            key={a.id}
            onPress={() => onPick(a.id)}
            activeOpacity={0.7}
            style={[styles.swatch, { backgroundColor: a.hex }, active && styles.swatchActive]}
          >
            {active && <Ionicons name="checkmark" size={16} color="#000" />}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Font options (each label rendered in its own face) ─────────────────────────
function FontPicker({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  return (
    <View>
      {FONTS.map((f, i) => {
        const active = f.id === value
        return (
          <TouchableOpacity
            key={f.id}
            onPress={() => onPick(f.id)}
            activeOpacity={0.7}
            style={[styles.fontRow, i === FONTS.length - 1 && { borderBottomWidth: 0 }]}
          >
            <Text style={[styles.fontSample, { fontFamily: f.mono }, active && { color: Colors.greenPrimary }]}>
              {f.label}
            </Text>
            {active && <Ionicons name="checkmark-circle" size={18} color={Colors.greenPrimary} />}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Navbar style options ───────────────────────────────────────────────────────
function NavbarPicker({ value, onPick }: { value: NavbarStyle; onPick: (id: NavbarStyle) => void }) {
  return (
    <View>
      {NAVBAR_STYLES.map((n, i) => {
        const active = n.id === value
        return (
          <TouchableOpacity
            key={n.id}
            onPress={() => onPick(n.id)}
            activeOpacity={0.7}
            style={[styles.fontRow, i === NAVBAR_STYLES.length - 1 && { borderBottomWidth: 0 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.navbarLabel, active && { color: Colors.greenPrimary }]}>{n.label}</Text>
              <Text style={styles.navbarHint}>{n.hint}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={18} color={Colors.greenPrimary} />}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { logout, getMe } = useAuth()

  const [haptics, setHaptics]           = useState(hapticsEnabled())
  const [reduceMotion, setReduceMotion] = useState(reduceMotionEnabled())
  const [artwork, setArtwork]           = useState(artworkEnabled())
  const [me, setMe]                     = useState<SpotifyUser | null>(null)
  const [cacheCleared, setCacheCleared] = useState(false)
  const [wrappedCleared, setWrappedCleared] = useState(false)
  const [updateMsg, setUpdateMsg]       = useState<string | null>(null)
  const [showRestart, setShowRestart]   = useState(false)
  const flaggedCount = loadArtReports().length

  // ── Appearance — selections persist immediately, apply on the next reload ──
  const [pendingMode, setPendingMode]     = useState<ThemeMode>(getThemeMode)
  const [pendingAccent, setPendingAccent] = useState(getAccentId)
  const [pendingFont, setPendingFont]     = useState(getFontId)
  const [pendingNavbar, setPendingNavbar] = useState<NavbarStyle>(getNavbarStyle)
  const [showApplyRestart, setShowApplyRestart] = useState(false)
  const appearanceDirty =
    pendingMode   !== activeThemeMode() ||
    pendingAccent !== activeAccentId() ||
    pendingFont   !== activeFontId()   ||
    pendingNavbar !== launchNavbarStyle()

  const onPickMode   = (m: ThemeMode) => { haptic.light(); setThemeMode(m); setPendingMode(m) }
  const onPickAccent = (id: string) => { haptic.light(); setAccentId(id); setPendingAccent(id) }
  const onPickFont   = (id: string) => { haptic.light(); setFontId(id);   setPendingFont(id) }
  const onPickNavbar = (id: NavbarStyle) => { haptic.light(); setNavbarStyle(id); setPendingNavbar(id) }

  // Custom home banner — saved on blur/submit, applies live (no restart needed).
  const [quote, setQuote] = useState(getCustomQuote)
  const saveQuote = () => { setCustomQuote(quote); haptic.light() }

  useEffect(() => { getMe().then(setMe) }, [])

  const onToggleHaptics = (v: boolean) => {
    setHaptics(v)
    setHapticsEnabled(v)
    if (v) haptic.light()
  }

  const onToggleReduceMotion = (v: boolean) => {
    setReduceMotion(v)
    setReduceMotionEnabled(v)
    haptic.light()
  }

  const onToggleArtwork = (v: boolean) => {
    setArtwork(v)
    setArtworkEnabled(v)
    haptic.light()
  }

  const onClearWrapped = () => {
    Alert.alert(
      'Clear Wrapped history?',
      'Removes your imported listening history and all its stats. Your playlists are untouched — re-import the Spotify export anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: () => {
            clearWrappedStats()
            haptic.success()
            setWrappedCleared(true)
            setTimeout(() => setWrappedCleared(false), 2500)
          },
        },
      ],
    )
  }

  const onCheckUpdates = async () => {
    if (!otaEnabled()) { setUpdateMsg('Not in this build'); setTimeout(() => setUpdateMsg(null), 2500); return }
    haptic.light()
    setUpdateMsg('Checking…')
    const outcome = await checkForUpdate()
    if (outcome === 'ready') {
      setUpdateMsg('Update ready')
      setShowRestart(true)
    } else if (outcome === 'none') {
      setUpdateMsg('Up to date ✓')
      setTimeout(() => setUpdateMsg(null), 2500)
    } else {
      setUpdateMsg('Check failed')
      setTimeout(() => setUpdateMsg(null), 2500)
    }
  }

  const onClearCache = () => {
    Alert.alert(
      'Clear cache?',
      'Removes cached playlist analyses and your taste profile. You stay logged in — everything rebuilds as you browse.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: () => {
            clearCaches()
            haptic.success()
            setCacheCleared(true)
            setTimeout(() => setCacheCleared(false), 2500)
          },
        },
      ],
    )
  }

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
          {/* Preferences */}
          <Section label="preferences">
            <ToggleRow
              icon="phone-portrait-outline"
              label="Haptics"
              value={haptics}
              onValueChange={onToggleHaptics}
            />
            <ToggleRow
              icon="contract-outline"
              label="Reduce motion"
              value={reduceMotion}
              onValueChange={onToggleReduceMotion}
            />
            <ToggleRow
              icon="image-outline"
              label="Show artwork"
              value={artwork}
              onValueChange={onToggleArtwork}
              last
            />
          </Section>

          {/* Appearance */}
          <Section label="appearance">
            <View style={styles.appearanceBlock}>
              <Text style={styles.pickerLabel}>Theme</Text>
              <View style={styles.segment}>
                {(['dark', 'light'] as ThemeMode[]).map(m => {
                  const active = pendingMode === m
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => onPickMode(m)}
                      activeOpacity={0.8}
                      style={[styles.segItem, active && styles.segItemActive]}
                    >
                      <Ionicons
                        name={m === 'dark' ? 'moon' : 'sunny'}
                        size={14}
                        color={active ? Colors.background : Colors.textMuted}
                      />
                      <Text style={[styles.segText, active && styles.segTextActive]}>
                        {m === 'dark' ? 'Dark' : 'Light'}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
            <View style={styles.appearanceBlock}>
              <Text style={styles.pickerLabel}>Accent</Text>
              <AccentPicker value={pendingAccent} onPick={onPickAccent} />
            </View>
            <View style={styles.appearanceBlock}>
              <Text style={styles.pickerLabel}>Font</Text>
              <FontPicker value={pendingFont} onPick={onPickFont} />
            </View>
            <View style={styles.appearanceBlock}>
              <Text style={styles.pickerLabel}>Navigation</Text>
              <NavbarPicker value={pendingNavbar} onPick={onPickNavbar} />
            </View>
            <View style={[styles.appearanceBlock, !appearanceDirty && { borderBottomWidth: 0 }]}>
              <Text style={styles.pickerLabel}>Home banner</Text>
              <TextInput
                style={styles.quoteInput}
                value={quote}
                onChangeText={setQuote}
                onBlur={saveQuote}
                onSubmitEditing={saveQuote}
                placeholder="Your own line on the home strip…"
                placeholderTextColor={Colors.textDim}
                maxLength={64}
                returnKeyType="done"
              />
              <Text style={styles.quoteHint}>
                {quote.trim() ? 'Joins the rotating tips — applies right away.' : 'Empty = the rotating tips only.'}
              </Text>
            </View>
            {appearanceDirty && (
              <TouchableOpacity style={styles.applyRow} onPress={() => { haptic.medium(); setShowApplyRestart(true) }} activeOpacity={0.7}>
                <Ionicons name="refresh" size={16} color={Colors.greenPrimary} />
                <Text style={styles.applyText}>Restart to apply your new look</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.greenPrimary} />
              </TouchableOpacity>
            )}
          </Section>

          {/* Data */}
          <Section label="data">
            <SettingRow
              icon="trash-outline"
              label="Clear cache"
              value={cacheCleared ? 'Cleared ✓' : undefined}
              onPress={onClearCache}
            />
            <SettingRow
              icon="disc-outline"
              label="Clear Wrapped history"
              value={wrappedCleared ? 'Cleared ✓' : undefined}
              onPress={onClearWrapped}
            />
            <SettingRow
              icon="flag-outline"
              label="Flagged covers"
              value={flaggedCount > 0 ? String(flaggedCount) : undefined}
              onPress={() => { haptic.light(); router.push('/flagged-covers') }}
              last
            />
          </Section>

          {/* Guide */}
          <Section label="guide">
            <SettingRow
              icon="sparkles-outline"
              label="What's new"
              value={`v${latestPatch().version}`}
              onPress={() => { haptic.light(); emitOpenWhatsNew() }}
            />
            <SettingRow
              icon="school-outline"
              label="Replay tutorial"
              onPress={() => { haptic.light(); emitOpenTutorial() }}
              last
            />
          </Section>

          {/* Spotify */}
          <Section label="spotify">
            <SettingRow icon="pulse-outline" label="Audio features" value="Pre-2024 apps" last />
          </Section>

          {/* About */}
          <Section label="about">
            <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" />
            <SettingRow
              icon="cloud-download-outline"
              label="Check for updates"
              value={updateMsg ?? currentUpdateLabel()}
              onPress={onCheckUpdates}
            />
            <SettingRow icon="code-slash-outline" label="Built with" value="Expo SDK 54" last />
          </Section>

          {/* Account */}
          <Section label="account">
            <SettingRow
              icon="person-circle-outline"
              label={me?.display_name || 'Spotify account'}
              value={me ? 'Connected' : '…'}
            />
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

      <ConfirmModal
        visible={showRestart}
        glyph="✦"
        title="Update ready"
        message="A fresh version is downloaded and ready to go. Restart now to apply it?"
        confirmLabel="Restart"
        cancelLabel="Later"
        onConfirm={() => { setShowRestart(false); applyUpdate() }}
        onCancel={() => { setShowRestart(false); setUpdateMsg(null) }}
      />

      <ConfirmModal
        visible={showApplyRestart}
        glyph="✦"
        title="Restart to apply"
        message="Your new look is saved. Restart the app now to see it?"
        confirmLabel="Restart"
        cancelLabel="Later"
        onConfirm={() => { setShowApplyRestart(false); reloadApp() }}
        onCancel={() => setShowApplyRestart(false)}
      />
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

  // ── Appearance ──
  appearanceBlock: {
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    gap:               Spacing.md,
  },
  pickerLabel: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  segment: {
    flexDirection:   'row',
    gap:             Spacing.sm,
  },
  segItem: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             Spacing.xs + 2,
    paddingVertical: Spacing.sm + 1,
    borderRadius:    Radius.md,
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
  },
  segItemActive: {
    backgroundColor: Colors.greenPrimary,
    borderColor:     Colors.greenPrimary,
  },
  segText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
    color:      Colors.textMuted,
  },
  segTextActive: {
    color: Colors.background,
  },
  swatchRow: {
    flexDirection: 'row',
    gap:           Spacing.sm,
    flexWrap:      'wrap',
  },
  swatch: {
    width:          34,
    height:         34,
    borderRadius:   Radius.full,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    2,
    borderColor:    'transparent',
  },
  swatchActive: {
    borderColor: Colors.text,
  },
  fontRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  fontSample: {
    fontSize: FontSize.md,
    color:    Colors.textSecondary,
  },
  navbarLabel: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  navbarHint: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textDim,
    marginTop:  1,
  },
  applyRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.md,
    backgroundColor:   Colors.greenSubtle,
  },
  applyText: {
    flex:       1,
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
    color:      Colors.greenPrimary,
  },
  quoteInput: {
    fontFamily:        FontFamily.mono,
    fontSize:          FontSize.sm,
    color:             Colors.text,
    backgroundColor:   Colors.glass,
    borderWidth:       1,
    borderColor:       Colors.glassBorder,
    borderRadius:      Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
  },
  quoteHint: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textDim,
  },
})
