import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Linking,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay } from 'react-native-reanimated'
import {
  Colors, FontFamily, FontSize, Spacing, Radius, alpha,
  ACCENTS, FONTS, activeAccentId, activeFontId, activeThemeMode,
} from '@/constants/theme'
import { BackButton } from '@/components/ui/BackButton'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Spring, haptic } from '@/constants/animation'
import { useAuth } from '@/hooks/useAuth'
import { clearCaches } from '@/utils/cache'
import {
  hapticsEnabled, setHapticsEnabled,
  reduceMotionEnabled, setReduceMotionEnabled,
  artworkEnabled, setArtworkEnabled,
  tributeEnabled, setTributeEnabled,
  getAccentId, setAccentId, getFontId, setFontId,
  getThemeMode, setThemeMode, type ThemeMode,
  getCustomQuote, setCustomQuote,
  NAVBAR_STYLES, getNavbarStyle, setNavbarStyle, launchNavbarStyle, type NavbarStyle,
  getNowPlayingPos, setNowPlayingPos, type NowPlayingPos,
} from '@/utils/settings'
import { notificationsEnabled, setNotificationsEnabled, sendTestNotification } from '@/utils/notifications'
import { clearWrappedStats } from '@/hooks/useWrapped'
import { loadArtReports } from '@/hooks/useArtwork'
import { checkForUpdate, applyUpdate, otaEnabled, currentUpdateLabel, reloadApp } from '@/utils/updates'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { emitOpenTutorial, emitOpenWhatsNew } from '@/utils/overlayEvents'
import { appVersion, nativeVersion } from '@/utils/version'
import { showDialog, confirmDialog } from '@/utils/dialog'
import type { SpotifyUser } from '@/types'

// Icon-tile tints — mid-tones that read on both the dark and the light theme.
const TINT = {
  accent: Colors.greenPrimary,
  violet: '#8B7CF6',
  pink:   '#F0609E',
  sky:    '#3FA9F5',
  amber:  '#F5A524',
  danger: Colors.error,
} as const
type Tint = keyof typeof TINT

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ label, footer, children }: { label: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel} accessibilityRole="header">{label}</Text>
      <View style={styles.sectionCard}>
        <View style={styles.cardSpecular} />
        {children}
      </View>
      {footer ? <Text style={styles.sectionFooter}>{footer}</Text> : null}
    </View>
  )
}

function Tile({ icon, tint }: { icon: IconName; tint: Tint }) {
  const c = TINT[tint]
  return (
    <View style={[styles.tile, { backgroundColor: alpha(c, 0.15), borderColor: alpha(c, 0.28) }]}>
      <Icon name={icon} size={16} color={c} />
    </View>
  )
}

// ─── Settings row ─────────────────────────────────────────────────────────────
function SettingRow({
  icon, tint = 'accent', label, hint, value, valueTone, onPress, danger, last,
}: {
  icon:       IconName
  tint?:      Tint
  label:      string
  hint?:      string
  value?:     string
  /** 'ok' renders the value as a green confirmation (e.g. "Cleared"). */
  valueTone?: 'ok'
  onPress?:   () => void
  danger?:    boolean
  last?:      boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={[label, value].filter(Boolean).join(', ')}
      accessibilityHint={hint}
    >
      <Tile icon={icon} tint={danger ? 'danger' : tint} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]} numberOfLines={1}>{label}</Text>
        {hint ? <Text style={styles.rowHint} numberOfLines={2}>{hint}</Text> : null}
      </View>
      {value ? (
        valueTone === 'ok'
          ? <View style={styles.okChip}><Icon name="checkmark" size={12} color={Colors.greenPrimary} /><Text style={styles.okText}>{value}</Text></View>
          : <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      ) : null}
      {onPress && !danger && <Icon name="chevron-forward" size={15} color={Colors.textMuted} />}
    </TouchableOpacity>
  )
}

// ─── Toggle row ───────────────────────────────────────────────────────────────
function ToggleRow({
  icon, tint = 'accent', label, hint, value, onValueChange, last,
}: {
  icon:          IconName
  tint?:         Tint
  label:         string
  hint?:         string
  value:         boolean
  onValueChange: (v: boolean) => void
  last?:         boolean
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Tile icon={icon} tint={tint} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
        {hint ? <Text style={styles.rowHint} numberOfLines={2}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        accessibilityHint={hint}
        trackColor={{ false: Colors.glassBorder, true: alpha(Colors.greenPrimary, 0.45) }}
        thumbColor={value ? Colors.greenPrimary : '#9a9a9a'}
        ios_backgroundColor={Colors.glassBorder}
      />
    </View>
  )
}

// ─── Profile card — who's connected, on what plan ──────────────────────────────
function ProfileCard({ me, onReconnect, reconnectMsg }: {
  me: SpotifyUser | null; onReconnect: () => void; reconnectMsg: string | null
}) {
  const avatar = me?.images?.[0]?.url
  const initial = (me?.display_name || '?').trim().charAt(0).toUpperCase()
  const plan = me?.product === 'premium' ? 'Premium' : me?.product ? 'Free' : null
  return (
    <View style={styles.profile}>
      <View style={styles.cardSpecular} />
      {avatar
        ? <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" transition={150} />
        : <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.avatarInitial}>{initial}</Text></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.profileName} numberOfLines={1}>{me?.display_name || (me ? 'Spotify user' : 'Loading…')}</Text>
        <View style={styles.profileMeta}>
          <Icon name="checkmark-circle" size={12} color={Colors.greenPrimary} />
          <Text style={styles.profileMetaText}>Spotify connected</Text>
          {plan && <View style={[styles.planChip, plan === 'Premium' && styles.planChipPremium]}>
            <Text style={[styles.planText, plan === 'Premium' && styles.planTextPremium]}>{plan}</Text>
          </View>}
        </View>
      </View>
      <TouchableOpacity
        style={styles.reconnectBtn} onPress={onReconnect} activeOpacity={0.75} hitSlop={6}
        accessibilityRole="button" accessibilityLabel="Reconnect Spotify"
        accessibilityHint="Re-runs the Spotify sign-in to pick up new permissions"
      >
        <Icon name="sync" size={14} color={Colors.greenPrimary} />
        <Text style={styles.reconnectText}>{reconnectMsg ?? 'Reconnect'}</Text>
      </TouchableOpacity>
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
            accessibilityRole="radio" accessibilityLabel={a.label} accessibilityState={{ selected: active }}
          >
            {active && <Icon name="checkmark" size={16} color="#000" />}
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
            {active && <Icon name="checkmark-circle" size={18} color={Colors.greenPrimary} />}
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
            {active && <Icon name="checkmark-circle" size={18} color={Colors.greenPrimary} />}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { login, logout, getMe } = useAuth()

  const [haptics, setHaptics]           = useState(hapticsEnabled())
  const [reduceMotion, setReduceMotion] = useState(reduceMotionEnabled())
  const [artwork, setArtwork]           = useState(artworkEnabled())
  const [tribute, setTribute]           = useState(tributeEnabled())
  const [notifs, setNotifs]             = useState(notificationsEnabled())
  const [notifTested, setNotifTested]   = useState(false)
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

  // Now-playing placement applies LIVE (the bar/strip subscribe) — no restart row.
  const [npPos, setNpPos] = useState<NowPlayingPos>(getNowPlayingPos)
  const onPickNpPos = (p: NowPlayingPos) => { haptic.light(); setNowPlayingPos(p); setNpPos(p) }

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

  const onToggleTribute = (v: boolean) => {
    setTribute(v)
    setTributeEnabled(v)
    haptic.light()
  }

  // Permission denied at the OS level — offer a one-tap jump to the app's settings page.
  const notificationsOffDialog = (why: string) => showDialog({
    glyph: 'notifications-off-outline', title: 'Notifications are off',
    message: `Allow notifications for playlist.lens in your phone settings ${why}.`,
    confirmLabel: 'Open settings', cancelLabel: 'Not now',
    onConfirm: () => { Linking.openSettings().catch(() => {}) },
  })

  // Recap notifications — turning on asks OS permission; reverts if it's denied.
  const onToggleNotifications = async (v: boolean) => {
    haptic.light()
    setNotifs(v)
    const result = await setNotificationsEnabled(v)
    if (result !== v) {
      setNotifs(result)
      if (v && !result) {
        notificationsOffDialog('to get recap nudges')
      }
    }
  }

  const onTestNotification = async () => {
    haptic.light()
    const ok = await sendTestNotification()
    if (ok) {
      if (!notifs) setNotifs(true)   // permission just granted via the test
      setNotifTested(true)
      setTimeout(() => setNotifTested(false), 3000)
    } else {
      notificationsOffDialog('to receive a test')
    }
  }

  const onClearWrapped = () => {
    confirmDialog({
      glyph: 'trash-outline', destructive: true, confirmLabel: 'Clear',
      title: 'Clear Wrapped history?',
      message: 'Removes your imported listening history and all its stats. Your playlists are untouched — re-import the Spotify export anytime.',
      onConfirm: () => {
        clearWrappedStats()
        setWrappedCleared(true)
        setTimeout(() => setWrappedCleared(false), 2500)
      },
    })
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
      setUpdateMsg('Up to date')
      setTimeout(() => setUpdateMsg(null), 2500)
    } else {
      setUpdateMsg('Check failed')
      setTimeout(() => setUpdateMsg(null), 2500)
    }
  }

  // ── Reconnect Spotify (v1.3) — re-runs OAuth to pick up the new scopes
  // (now-playing + playlist editing). Safe to do anytime; tokens just refresh.
  const [reconnectMsg, setReconnectMsg] = useState<string | null>(null)
  const onReconnect = async () => {
    haptic.medium()
    setReconnectMsg('Opening Spotify…')
    const ok = await login()
    setReconnectMsg(ok ? 'Connected' : 'Cancelled')
    if (ok) haptic.success()
    setTimeout(() => setReconnectMsg(null), 2500)
  }

  const onClearCache = () => {
    confirmDialog({
      glyph: 'trash-outline', destructive: true, confirmLabel: 'Clear',
      title: 'Clear cache?',
      message: 'Removes cached playlist analyses and your taste profile. You stay logged in — everything rebuilds as you browse.',
      onConfirm: () => {
        clearCaches()
        setCacheCleared(true)
        setTimeout(() => setCacheCleared(false), 2500)
      },
    })
  }

  const insets = useSafeAreaInsets()

  // ── Entrance — header + content rise in like the other screens ──
  const enterY = useSharedValue(14)
  const enterO = useSharedValue(0)
  useEffect(() => {
    enterY.value = withDelay(40, withSpring(0, Spring.entrance))
    enterO.value = withDelay(40, withTiming(1, { duration: 320 }))
  }, [])
  const enterStyle = useAnimatedStyle(() => ({ opacity: enterO.value, transform: [{ translateY: enterY.value }] }))

  const okMsg = (m: string | null) => m === 'Up to date' || m === 'Connected'

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        <View style={styles.header}>
          <BackButton />
        </View>

        <Animated.View style={[{ flex: 1 }, enterStyle]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing['4xl'] }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title} accessibilityRole="header">settings</Text>

          <ProfileCard me={me} onReconnect={onReconnect} reconnectMsg={reconnectMsg} />

          {/* Experience */}
          <Section label="experience">
            <ToggleRow icon="phone-portrait-outline" label="Haptics" hint="Little taps on presses and confirmations"
              value={haptics} onValueChange={onToggleHaptics} />
            <ToggleRow icon="leaf-outline" tint="sky" label="Reduce motion" hint="Calmer screens — no drifting glows or auto-rotating tips"
              value={reduceMotion} onValueChange={onToggleReduceMotion} />
            <ToggleRow icon="image-outline" tint="violet" label="Show artwork" hint="Covers and artist photos across the app"
              value={artwork} onValueChange={onToggleArtwork} />
            <ToggleRow icon="flower-outline" tint="pink" label="Memorial marks" hint="A quiet † beside artists who’ve passed"
              value={tribute} onValueChange={onToggleTribute} last />
          </Section>

          {/* Notifications */}
          <Section label="notifications">
            <ToggleRow icon="notifications-outline" tint="amber" label="Recap notifications"
              hint="A nudge when your weekly, monthly, seasonal or yearly recap is ready"
              value={notifs} onValueChange={onToggleNotifications} />
            <SettingRow icon="paper-plane-outline" tint="amber" label="Send a test notification"
              value={notifTested ? 'Sent' : undefined} valueTone="ok" onPress={onTestNotification} last />
          </Section>

          {/* Appearance */}
          <Section label="appearance" footer={appearanceDirty ? undefined : 'Theme, accent, font and navigation apply after a quick restart.'}>
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
                      accessibilityRole="radio" accessibilityState={{ selected: active }}
                    >
                      <Icon name={m === 'dark' ? 'moon' : 'sunny'} size={14} color={active ? Colors.background : Colors.textMuted} />
                      <Text style={[styles.segText, active && styles.segTextActive]}>{m === 'dark' ? 'Dark' : 'Light'}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
            <View style={styles.appearanceBlock}>
              <View style={styles.pickerHead}>
                <Text style={styles.pickerLabel}>Accent</Text>
                <Text style={styles.pickerValue}>{ACCENTS.find(a => a.id === pendingAccent)?.label}</Text>
              </View>
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
            <View style={styles.appearanceBlock}>
              <Text style={styles.pickerLabel}>Now playing</Text>
              <View style={styles.segment}>
                {([
                  { id: 'bottom', icon: 'chevron-down-circle-outline', label: 'Above nav' },
                  { id: 'top',    icon: 'chevron-up-circle-outline',   label: 'Home strip' },
                ] as Array<{ id: NowPlayingPos; icon: IconName; label: string }>).map(o => {
                  const active = npPos === o.id
                  return (
                    <TouchableOpacity
                      key={o.id}
                      onPress={() => onPickNpPos(o.id)}
                      activeOpacity={0.8}
                      style={[styles.segItem, active && styles.segItemActive]}
                      accessibilityRole="radio" accessibilityState={{ selected: active }}
                    >
                      <Icon name={o.icon} size={14} color={active ? Colors.background : Colors.textMuted} />
                      <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <Text style={styles.quoteHint}>
                Where the live bar lives — docked above the nav, or up in the home tips strip.
              </Text>
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
                placeholderTextColor={Colors.textMuted}
                maxLength={64}
                returnKeyType="done"
                accessibilityLabel="Home banner text"
              />
              <Text style={styles.quoteHint}>
                {quote.trim() ? 'Joins the rotating tips — applies right away.' : 'Empty = the rotating tips only.'}
              </Text>
            </View>
            {appearanceDirty && (
              <TouchableOpacity
                style={styles.applyRow} onPress={() => { haptic.medium(); setShowApplyRestart(true) }} activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Icon name="refresh" size={16} color={Colors.greenPrimary} />
                <Text style={styles.applyText}>Restart to apply your new look</Text>
                <Icon name="chevron-forward" size={14} color={Colors.greenPrimary} />
              </TouchableOpacity>
            )}
          </Section>

          {/* Data */}
          <Section label="data & storage">
            <SettingRow icon="layers-outline" tint="sky" label="Clear cache"
              hint="Playlist analyses + taste profile — they rebuild as you browse"
              value={cacheCleared ? 'Cleared' : undefined} valueTone="ok" onPress={onClearCache} />
            <SettingRow icon="disc-outline" tint="violet" label="Clear Wrapped history"
              hint="Your imported listening history and its stats"
              value={wrappedCleared ? 'Cleared' : undefined} valueTone="ok" onPress={onClearWrapped} />
            <SettingRow icon="flag-outline" tint="pink" label="Flagged covers"
              value={flaggedCount > 0 ? String(flaggedCount) : undefined}
              onPress={() => { haptic.light(); router.push('/flagged-covers') }} last />
          </Section>

          {/* Help */}
          <Section label="help">
            <SettingRow icon="sparkles-outline" label="What’s new" value={`v${appVersion()}`}
              onPress={() => { haptic.light(); emitOpenWhatsNew() }} />
            <SettingRow icon="school-outline" tint="sky" label="Replay the tour"
              onPress={() => { haptic.light(); emitOpenTutorial() }} last />
          </Section>

          {/* About */}
          <Section label="about">
            <SettingRow icon="information-circle-outline" tint="violet" label="Version"
              hint={`Build ${nativeVersion()} · ${currentUpdateLabel() === 'base build' ? 'base build' : `update ${currentUpdateLabel()}`}`}
              value={appVersion()} />
            <SettingRow icon="cloud-download-outline" tint="sky" label="Check for updates"
              value={updateMsg ?? undefined} valueTone={okMsg(updateMsg) ? 'ok' : undefined} onPress={onCheckUpdates} />
            <SettingRow icon="pulse-outline" tint="amber" label="Audio features"
              hint="Spotify only shares these with apps registered before Nov 2024 — vibes fall back to genres" />
            <SettingRow icon="shapes-outline" tint="pink" label="Icons" hint="Ionicons by Ionic — MIT licence"
              onPress={() => { Linking.openURL('https://ionic.io/ionicons').catch(() => {}) }} last />
          </Section>

          <TouchableOpacity
            style={styles.logout} onPress={logout} activeOpacity={0.75}
            accessibilityRole="button" accessibilityLabel="Log out"
          >
            <Icon name="log-out-outline" size={16} color={Colors.error} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerMark}>playlist<Text style={{ color: Colors.greenPrimary }}>.</Text>lens</Text>
            <Text style={styles.footerSub}>v{appVersion()} · made with Expo</Text>
          </View>
        </ScrollView>
        </Animated.View>
      </SafeAreaView>

      <ConfirmModal
        visible={showRestart}
        glyph="sparkles"
        title="Update ready"
        message="A fresh version is downloaded and ready to go. Restart now to apply it?"
        confirmLabel="Restart"
        cancelLabel="Later"
        onConfirm={() => { setShowRestart(false); applyUpdate() }}
        onCancel={() => { setShowRestart(false); setUpdateMsg(null) }}
      />

      <ConfirmModal
        visible={showApplyRestart}
        glyph="sparkles"
        title="Restart to apply"
        message="Your new look is saved. Restart the app now to see it?"
        confirmLabel="Restart"
        cancelLabel="Later"
        onConfirm={() => { setShowApplyRestart(false); reloadApp() }}
        onCancel={() => setShowApplyRestart(false)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  title: {
    fontFamily: FontFamily.syneBold, fontSize: FontSize['3xl'], color: Colors.text,
    letterSpacing: -1.5, marginBottom: Spacing.xs,
  },

  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.xl },

  // Profile
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, borderRadius: Radius.xl, overflow: 'hidden',
    backgroundColor: alpha(Colors.greenPrimary, 0.07),
    borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.25),
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarEmpty: { backgroundColor: alpha(Colors.greenPrimary, 0.18), alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.greenPrimary },
  profileName: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  profileMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  profileMetaText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  planChip: {
    marginLeft: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  planChipPremium: { backgroundColor: alpha(Colors.greenPrimary, 0.15), borderColor: alpha(Colors.greenPrimary, 0.4) },
  planText: { fontFamily: FontFamily.monoMedium, fontSize: 9, color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  planTextPremium: { color: Colors.greenPrimary },
  reconnectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm - 1, borderRadius: Radius.full,
    borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.4), backgroundColor: alpha(Colors.greenPrimary, 0.08),
  },
  reconnectText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.greenPrimary },

  // Section
  section:      { gap: Spacing.sm },
  sectionLabel: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    paddingLeft:   Spacing.xs,
  },
  sectionFooter: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, paddingHorizontal: Spacing.xs, lineHeight: FontSize.xs * 1.5 },
  sectionCard: {
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    borderRadius:    Radius.lg,
    overflow:        'hidden',
  },
  cardSpecular: { position: 'absolute', top: 0, left: Spacing.lg, right: Spacing.lg, height: 1, backgroundColor: Colors.glassHighlight },

  // Row
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.md,
    minHeight:         56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
  },
  rowLast:  { borderBottomWidth: 0 },
  tile: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:  { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  rowLabelDanger: { color: Colors.error },
  rowHint:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: FontSize.xs * 1.45 },
  rowValue: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, maxWidth: 140 },
  okChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
    backgroundColor: alpha(Colors.greenPrimary, 0.12),
  },
  okText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.greenPrimary },

  pickerHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValue: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textSecondary },

  // Log out + footer
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: alpha(Colors.error, 0.35), backgroundColor: alpha(Colors.error, 0.07),
  },
  logoutText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.error },
  footer: { alignItems: 'center', gap: 4, paddingTop: Spacing.sm },
  footerMark: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.textMuted, letterSpacing: -0.5 },
  footerSub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },

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
    color:      Colors.textMuted,
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
    color:      Colors.textMuted,
  },
})
