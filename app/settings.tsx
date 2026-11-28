import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Linking,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay } from 'react-native-reanimated'
import {
  Colors, FontFamily, FontSize, Spacing, Radius, Type, alpha,
  ACCENTS, FONTS, activeAccentId, activeFontId, activeThemeMode,
} from '@/constants/theme'
import { BackButton } from '@/components/ui/BackButton'
import { useIsCover } from '@/hooks/useScreen'
import { useBottomGutter } from '@/hooks/useCoverClearance'
import { LiquidBackground } from '@/components/motion/LiquidBackground'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Section, ListRow as SettingRow, ToggleRow } from '@/components/ui'
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
  errorReportsEnabled, setErrorReportsEnabled,
} from '@/utils/settings'
import { dropPendingErrors } from '@/utils/errorReport'

const PRIVACY_POLICY_URL = 'https://playlist-lens-mobile.onrender.com/privacy'
import { notificationsEnabled, setNotificationsEnabled, sendTestNotification } from '@/utils/notifications'
import { clearWrappedStats } from '@/hooks/useWrapped'
import { loadArtReports } from '@/hooks/useArtwork'
import { checkForUpdate, applyUpdate, otaEnabled, currentUpdateLabel, reloadApp } from '@/utils/updates'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { emitOpenTutorial, emitOpenWhatsNew } from '@/utils/overlayEvents'
import { appVersion, nativeVersion } from '@/utils/version'
import { showDialog, confirmDialog, showToast } from '@/utils/dialog'
import {
  fetchTrackingStatus, enrollTracking, unenrollTracking, syncTrackedPlays, trackingEnrolled,
  type TrackingStatus,
} from '@/utils/tracking'
import type { SpotifyUser } from '@/types'
import { useSparkMode, setSparkMode, nextSparkMode } from '@/components/spark'
import { APP_ICONS, appIconsSupported, getAppIcon, setAppIcon, iconForAccent, type AppIconOption } from '@/utils/appIcon'
import { backupStatus, onBackupStatus, backupAgo } from '@/utils/backup'

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

// ─── App icon (2.0) — applies right away, no restart ───────────────────────────────
function IconPicker({ value, onPick }: { value: AppIconOption['name']; onPick: (name: AppIconOption['name']) => void }) {
  return (
    <View style={styles.swatchRow}>
      {APP_ICONS.map(i => {
        const active = i.name === value
        return (
          <TouchableOpacity
            key={i.name}
            onPress={() => onPick(i.name)}
            activeOpacity={0.7}
            style={[styles.iconTile, active && styles.iconTileActive]}
            accessibilityRole="radio" accessibilityLabel={`${i.label} icon`} accessibilityState={{ selected: active }}
          >
            <Image source={i.preview} style={styles.iconImg} contentFit="cover" />
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
  const [crashReports, setCrashReports] = useState(errorReportsEnabled())
  const sparkMode = useSparkMode()
  const [notifs, setNotifs]             = useState(notificationsEnabled())
  const [notifTested, setNotifTested]   = useState(false)
  const [me, setMe]                     = useState<SpotifyUser | null>(null)
  const [cacheCleared, setCacheCleared] = useState(false)
  // Backup & restore (2.0.47): when you last backed up, live.
  const [backup, setBackup] = useState(backupStatus)
  useEffect(() => onBackupStatus(() => setBackup(backupStatus())), [])
  const [wrappedCleared, setWrappedCleared] = useState(false)
  const [updateMsg, setUpdateMsg]       = useState<string | null>(null)
  const [showRestart, setShowRestart]   = useState(false)
  const flaggedCount = loadArtReports().length

  // ── Appearance — selections persist immediately, apply on the next reload ──
  const [pendingMode, setPendingMode]     = useState<ThemeMode>(getThemeMode)
  const [pendingAccent, setPendingAccent] = useState(getAccentId)
  const [appIcon, setAppIconState] = useState(getAppIcon)
  const onPickIcon = async (name: AppIconOption['name']) => {
    if (name === appIcon) return
    haptic.light()
    try {
      await setAppIcon(name)
      setAppIconState(name)
      showToast('Icon changed — your home screen updates in a moment', 'sparkles')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t change the icon', 'alert-circle-outline')
    }
  }
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

  // ── Listening tracking (v1.8) — server saves every play hourly ──
  const [track, setTrack]         = useState<TrackingStatus | null>(null)
  const [trackOn, setTrackOn]     = useState(trackingEnrolled())
  const [trackBusy, setTrackBusy] = useState(false)
  const refreshTrack = () =>
    fetchTrackingStatus().then(s => { setTrack(s); setTrackOn(!!s.enrolled) }).catch(() => {})
  useEffect(() => { refreshTrack() }, [])

  const trackHint = (() => {
    if (trackBusy) return 'Working…'
    if (track && !track.available) return 'Not switched on for this server yet'
    if (!trackOn) return 'Saves every play hourly — even with the app closed — for real weekly stats'
    if (track?.status === 'paused') return 'Paused — Spotify stopped accepting the sign-in. Reconnect, then turn this off and on.'
    const since = track?.enrolled_at ? new Date(track.enrolled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null
    const n = track?.plays ?? 0
    return `${since ? `Since ${since} · ` : ''}${n.toLocaleString()} ${n === 1 ? 'play' : 'plays'} saved`
  })()

  const onToggleTracking = (v: boolean) => {
    haptic.light()
    if (v) {
      confirmDialog({
        glyph: 'pulse', title: 'Track your listening?', confirmLabel: 'Turn on',
        message: 'Spotify only remembers your last 50 plays. With tracking on, the playlist.lens server saves them every hour — even when the app is closed — so weekly and monthly stats are complete. Your Spotify sign-in is stored encrypted, and turning this off deletes it along with every saved play.',
        onConfirm: async () => {
          setTrackBusy(true)
          try {
            const r = await enrollTracking()
            setTrackOn(true)
            showToast(`Tracking on — ${r.backfilled} recent ${r.backfilled === 1 ? 'play' : 'plays'} saved`, 'pulse')
          } catch (e: any) {
            showDialog({ glyph: 'alert-circle-outline', title: 'Couldn’t turn on tracking', message: e?.message ?? 'Try again in a moment.' })
          } finally {
            setTrackBusy(false); refreshTrack()
          }
        },
      })
    } else {
      confirmDialog({
        glyph: 'trash-outline', destructive: true, confirmLabel: 'Turn off & delete',
        title: 'Turn off tracking?',
        message: 'The server stops saving your plays and deletes your stored sign-in and every play it saved. Stats already on this phone stay.',
        onConfirm: async () => {
          setTrackBusy(true)
          try {
            await unenrollTracking()
            setTrackOn(false)
            showToast('Tracking off — server data deleted', 'trash-outline')
          } catch (e: any) {
            showDialog({ glyph: 'alert-circle-outline', title: 'Couldn’t turn off tracking', message: e?.message ?? 'Try again in a moment.' })
          } finally {
            setTrackBusy(false); refreshTrack()
          }
        },
      })
    }
  }

  const onSyncNow = async () => {
    haptic.light()
    setTrackBusy(true)
    try {
      const n = await syncTrackedPlays()
      showToast(n ? `Synced ${n} new ${n === 1 ? 'play' : 'plays'}` : 'Already up to date', 'checkmark-circle')
    } catch {
      showToast('Couldn’t sync — try again in a moment', 'cloud-offline-outline')
    } finally {
      setTrackBusy(false); refreshTrack()
    }
  }

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

  const onToggleCrashReports = (v: boolean) => {
    setCrashReports(v)
    setErrorReportsEnabled(v)
    if (!v) dropPendingErrors()   // unsent ones never leave the phone
    haptic.light()
    showToast(v ? 'Crash reports on' : 'Crash reports off', v ? 'bug-outline' : 'eye-off-outline')
  }

  // Logging out only clears the phone. With tracking on, the server would keep saving
  // plays with the stored sign-in, so ask what the user wants instead of guessing.
  const onLogout = () => {
    if (!trackOn) { logout(); return }
    showDialog({
      glyph: 'pulse', title: 'Log out',
      message: 'Listening tracking is on. If you keep it, the server keeps saving your plays while you’re logged out. If you stop it, the server deletes your stored sign-in and every saved play.',
      cancelLabel: 'Cancel',
      altLabel: 'Keep tracking',
      confirmLabel: 'Stop tracking', destructive: true,
      onAlt: () => { logout() },
      onConfirm: async () => {
        setTrackBusy(true)
        try {
          await unenrollTracking()
          await logout()
        } catch (e: any) {
          setTrackBusy(false)
          showDialog({ glyph: 'alert-circle-outline', title: 'Couldn’t turn off tracking',
            message: `${e?.message ?? 'Try again in a moment.'} You’re still logged in, so you can try again.` })
        }
      },
    })
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
      title: 'Clear Rewind history?',
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
  // Flip cover screen: back + title on one row (like every page there), content ends above the cameras.
  const cover = useIsCover()
  const bottom = useBottomGutter(insets.bottom + Spacing['4xl'])

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
      <LiquidBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        <View style={[styles.header, cover && styles.headerCover]}>
          <BackButton />
          {cover && <Text style={styles.titleCover} accessibilityRole="header" numberOfLines={1}>Settings</Text>}
        </View>

        <Animated.View style={[{ flex: 1 }, enterStyle]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, cover && styles.scrollCover, { paddingBottom: bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!cover && <Text style={styles.title} accessibilityRole="header">settings</Text>}

          <ProfileCard me={me} onReconnect={onReconnect} reconnectMsg={reconnectMsg} />

          {/* Listening tracking */}
          <Section label="listening">
            <ToggleRow icon="pulse" label="Track my listening" hint={trackHint}
              value={trackOn} onValueChange={onToggleTracking}
              disabled={trackBusy || (track !== null && !track.available)} last={!trackOn} />
            {trackOn && (
              <SettingRow icon="sync" tint="sky" label="Sync now"
                hint="Pull the latest saved plays onto this phone" onPress={onSyncNow} last />
            )}
          </Section>

          {/* Experience */}
          <Section label="experience">
            <ToggleRow icon="phone-portrait-outline" label="Haptics" hint="Little taps on presses and confirmations"
              value={haptics} onValueChange={onToggleHaptics} />
            <ToggleRow icon="leaf-outline" tint="sky" label="Reduce motion" hint="Calmer screens — no drifting glows or auto-rotating tips"
              value={reduceMotion} onValueChange={onToggleReduceMotion} />
            <ToggleRow icon="image-outline" tint="violet" label="Show artwork" hint="Covers and artist photos across the app"
              value={artwork} onValueChange={onToggleArtwork} />
            <ToggleRow icon="flower-outline" tint="pink" label="Memorial marks" hint="A quiet † beside artists who’ve passed"
              value={tribute} onValueChange={onToggleTribute} />
            <SettingRow icon="star-outline" tint="amber" label="Spark"
              hint={sparkMode === 'on' ? 'Says hi now and then, and answers when you tap him'
                : sparkMode === 'quiet' ? 'Only talks when you tap him' : 'Hidden — the wordmark gets its dot back'}
              value={sparkMode === 'on' ? 'On' : sparkMode === 'quiet' ? 'Quiet' : 'Off'}
              onPress={() => { haptic.light(); setSparkMode(nextSparkMode(sparkMode)) }} last />
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
            {appIconsSupported() && (
              <View style={styles.appearanceBlock}>
                <View style={styles.pickerHead}>
                  <Text style={styles.pickerLabel}>App icon</Text>
                  {iconForAccent(pendingAccent).name !== appIcon ? (
                    <TouchableOpacity onPress={() => onPickIcon(iconForAccent(pendingAccent).name)} hitSlop={8} accessibilityRole="button">
                      <Text style={[styles.pickerValue, { color: Colors.greenPrimary }]}>Match accent</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.pickerValue}>{APP_ICONS.find(i => i.name === appIcon)?.label}</Text>
                  )}
                </View>
                <IconPicker value={appIcon} onPick={onPickIcon} />
              </View>
            )}
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
                  { id: 'top',    icon: 'chevron-up-circle-outline',   label: 'Header button' },
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
                Where the live bar lives — docked above the nav, or as a cover button by settings on Lenses (news drops out of it; tap it for controls).
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
            <SettingRow icon="shield-half-outline" tint="violet" label="Backup & restore"
              hint="Keep your history safe: one file in Drive or Files"
              value={backup.lastAt ? backupAgo(backup.lastAt) : 'Never'}
              onPress={() => { haptic.light(); router.push('/backup') }} />
            <SettingRow icon="layers-outline" tint="sky" label="Clear cache"
              hint="Playlist analyses + taste profile — they rebuild as you browse"
              value={cacheCleared ? 'Cleared' : undefined} valueTone="ok" onPress={onClearCache} />
            <SettingRow icon="disc-outline" tint="violet" label="Clear Rewind history"
              hint="Your imported listening history and its stats"
              value={wrappedCleared ? 'Cleared' : undefined} valueTone="ok" onPress={onClearWrapped} />
            <SettingRow icon="flag-outline" tint="pink" label="Flagged covers"
              value={flaggedCount > 0 ? String(flaggedCount) : undefined}
              onPress={() => { haptic.light(); router.push('/flagged-covers') }} last />
          </Section>

          {/* Help */}
          <Section label="help">
            <SettingRow icon="book-outline" tint="sky" label="Learn the app"
              hint="Everything playlist.lens can do, and where to find it"
              onPress={() => { haptic.light(); router.push('/learn') }} />
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
            <SettingRow icon="flask-outline" tint="amber" label="Labs"
              hint="Prototypes and testing tools: cover screen, motion, load times, errors, design system, update details"
              onPress={() => { haptic.light(); router.push('/labs') }} />
            <ToggleRow icon="bug-outline" tint="pink" label="Send crash reports"
              hint="Error details go to the playlist.lens server, linked to your Spotify account"
              value={crashReports} onValueChange={onToggleCrashReports} />
            <SettingRow icon="shield-checkmark-outline" tint="sky" label="Privacy policy"
              hint="What’s stored, where, and how to delete it"
              onPress={() => { haptic.light(); Linking.openURL(PRIVACY_POLICY_URL).catch(() => {}) }} />
            <SettingRow icon="shapes-outline" tint="pink" label="Icons" hint="Ionicons by Ionic — MIT licence"
              onPress={() => { Linking.openURL('https://ionic.io/ionicons').catch(() => {}) }} last />
          </Section>

          <TouchableOpacity
            style={styles.logout} onPress={onLogout} activeOpacity={0.75}
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
  headerCover: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.sm },
  titleCover:  { ...Type.title, fontSize: 24, lineHeight: 30, letterSpacing: -1, flex: 1, minWidth: 0 },
  title: {
    fontFamily: FontFamily.syneBold, fontSize: FontSize['3xl'], color: Colors.text,
    letterSpacing: -1.5, marginBottom: Spacing.xs,
  },

  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.xl },
  scrollCover: { gap: Spacing.lg },

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
  cardSpecular: { position: 'absolute', top: 0, left: Spacing.lg, right: Spacing.lg, height: 1, backgroundColor: Colors.glassHighlight },

  // Row

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
  iconTile: {
    width: 46, height: 46, borderRadius: 13, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
  },
  iconTileActive: { borderColor: Colors.text },
  iconImg: { width: '100%', height: '100%' },
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
