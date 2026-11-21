// First import: starts the JS-side load-time clock (utils/perf).
import '@/utils/perf'
import React, { useEffect, useRef, useState } from 'react'
import { Stack, router, usePathname, type ErrorBoundaryProps } from 'expo-router'
import { installErrorReporting, reportError, flushErrors, setErrorScreen } from '@/utils/errorReport'
import { refreshWidget } from '@/utils/widget'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useFonts } from 'expo-font'
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono'
import {
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne'
// Selectable mono/body faces for Expressive Expressions (see FONTS in theme.ts).
// The Syne display face is the fixed brand face and is always loaded above.
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono'
import { Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope'
import { Outfit_500Medium, Outfit_700Bold } from '@expo-google-fonts/outfit'
import { useNowPlayingSelect } from '@/hooks/useNowPlaying'
import { usePalette } from '@/hooks/usePalette'
import { setTint, toHex, fallbackTint, type Tint } from '@/utils/liquidTint'
import { ensureReadable } from '@/utils/color'
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono'
import * as SecureStore from 'expo-secure-store'
import { SecureKeys } from '@/utils/cache'
import { onSessionExpired, onSignedIn } from '@/utils/authEvents'
import { onOpenTutorial, onOpenWhatsNew, onOpenStartQueue } from '@/utils/overlayEvents'
import { Tutorial } from '@/components/onboarding/Tutorial'
import { WhatsNew } from '@/components/onboarding/WhatsNew'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DialogHost } from '@/components/ui/DialogHost'
import { ServerWakeBanner } from '@/components/ui/ServerWakeBanner'
import { warmUp } from '@/utils/api'
import { QueueCartTray } from '@/components/queue/QueueCartTray'
import { StartQueueSheet } from '@/components/queue/StartQueueSheet'
import type { QueueItem } from '@/utils/queueCart'
import { checkForUpdate, applyUpdate } from '@/utils/updates'
import {
  shouldShowTutorial, markTutorialSeen, shouldShowWhatsNew, markWhatsNewSeen,
} from '@/utils/whatsNew'
import { useAutoWrapped } from '@/hooks/useAutoWrapped'
import { syncNotificationsOnLaunch } from '@/utils/notifications'
import { View, StyleSheet, AppState, Text, Pressable } from 'react-native'
import { Colors, Spacing, Radius, Type, activeThemeMode } from '@/constants/theme'

// Hook the global error handlers before anything renders (crash-safe MMKV queue).
installErrorReporting()

/**
 * Root error boundary (expo-router): a render crash anywhere lands here instead of a
 * blank app. Reported once, with a way back in.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const reported = useRef(false)
  if (!reported.current) { reported.current = true; reportError(error, { fatal: true, screen: 'error-boundary' }) }
  return (
    <View style={[styles.splash, styles.crash]}>
      <Text style={styles.crashTitle}>Something went wrong</Text>
      <Text style={styles.crashBody}>The error was saved and will be sent with your next sync, so it can be fixed.</Text>
      <Pressable onPress={retry} style={styles.crashBtn} accessibilityRole="button">
        <Text style={styles.crashBtnText}>Try again</Text>
      </Pressable>
    </View>
  )
}

/**
 * Liquid (2.0): feeds the playing song's cover colours into the app-wide tint the
 * aurora background floats in. Keeps the last song's colours when playback stops.
 */
function LiquidTintFeeder() {
  // Only the song (id + cover) — not progress, which changes every poll.
  const song = useNowPlayingSelect(np => (np?.item ? `${np.item.id ?? ''}\u0000${np.item.album?.images?.[0]?.url ?? ''}` : null))
  const { extract } = usePalette()
  const [id, art] = song ? song.split('\u0000') : [null, null]
  useEffect(() => {
    if (!id || !art) return
    let alive = true
    extract(`np-${id}`, art).then(p => {
      if (!alive) return
      const fb = fallbackTint()
      const pick = (c: string | undefined, i: number) => ensureReadable(toHex(c) ?? fb[i], 2.2)
      const t: Tint = [pick(p.primary, 0), pick(p.detail, 1), pick(p.secondary, 2), pick(p.background, 3)]
      setTint(t)
    }).catch(() => {})
    return () => { alive = false }
  }, [id, art])
  return null
}

/**
 * A recap notification opens the period that just ended as a story (week / month /
 * year), or the Recaps screen (seasons, and notifications scheduled before 2.0 Phase 4).
 */
function openRecap(data: Record<string, unknown> | undefined) {
  const story = data?.story as { kind?: unknown; back?: unknown } | undefined
  if (story && (story.kind === 'week' || story.kind === 'month' || story.kind === 'year') && typeof story.back === 'number') {
    router.push(`/story?kind=${story.kind}&back=${story.back}`)
  } else {
    router.push('/recaps')
  }
}

export default function RootLayout() {
  // Keep the current screen on error reports.
  const pathname = usePathname()
  useEffect(() => { setErrorScreen(pathname) }, [pathname])
  const [isReady,        setIsReady]        = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showTutorial,   setShowTutorial]   = useState(false)
  const [showWhatsNew,   setShowWhatsNew]    = useState(false)
  const [whatsNewAll,    setWhatsNewAll]     = useState(false)  // Settings = full history
  const [showUpdate,     setShowUpdate]      = useState(false)
  const [showQueue,      setShowQueue]       = useState(false)
  const [queueTracks,    setQueueTracks]     = useState<QueueItem[] | undefined>(undefined)

  // Best-effort auto-Wrapped refresh (keeps recaps fresh; no-ops when logged out).
  useAutoWrapped(isAuthenticated)

  const [fontsLoaded] = useFonts({
    DMMono_400Regular,
    DMMono_500Medium,
    Syne_700Bold,
    Syne_800ExtraBold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Outfit_500Medium,
    Outfit_700Bold,
  })

  // Wake the free-tier backend early (launch + every return to the app after it may
  // have slept) so it boots while cached data is on screen — and the wake-up banner
  // says so before the user taps anything, including on the login screen.
  useEffect(() => {
    warmUp()
    const sub = AppState.addEventListener('change', s => { if (s === 'active') warmUp() })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    async function checkAuth() {
      const token = await SecureStore.getItemAsync(SecureKeys.accessToken)
      setIsAuthenticated(!!token)
      setIsReady(true)
    }
    checkAuth()

    // When a 401 fires anywhere in the app, drop back to the auth screen
    const unsubExpired = onSessionExpired(() => {
      setIsAuthenticated(false)
      router.replace('/auth')
    })
    // When OAuth completes, flip to authed so the auth screen leaves the
    // navigator (back-gesture can't return to login).
    const unsubSignedIn = onSignedIn(() => {
      setIsAuthenticated(true)
    })
    // Settings can re-open onboarding / patch notes from anywhere.
    const unsubTut = onOpenTutorial(() => setShowTutorial(true))
    // Opened from Settings → show the full patch-note history.
    const unsubWN  = onOpenWhatsNew(() => { setWhatsNewAll(true); setShowWhatsNew(true) })
    // The floating queue tray (cart) or a shelf's "Play now" (ad-hoc list) opens the sheet.
    const unsubQueue = onOpenStartQueue(tracks => { setQueueTracks(tracks); setShowQueue(true) })
    return () => { unsubExpired(); unsubSignedIn(); unsubTut(); unsubWN(); unsubQueue() }
  }, [])

  // First-run onboarding, else patch notes after a version bump.
  useEffect(() => {
    if (!isReady || !isAuthenticated) return
    if (shouldShowTutorial()) setShowTutorial(true)
    // Auto-fire after a version bump → just the newest entry, not the whole history.
    else if (shouldShowWhatsNew()) { setWhatsNewAll(false); setShowWhatsNew(true) }
  }, [isReady, isAuthenticated])

  // Send queued error reports once logged in, and whenever the app comes back.
  useEffect(() => {
    if (!isAuthenticated) return
    flushErrors()
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') flushErrors()
      else if (s === 'background') refreshWidget()   // leave the widget current
    })
    return () => sub.remove()
  }, [isAuthenticated])

  // ── Recap notifications (v1.5) — re-assert the schedule on launch + open Recaps
  // from a cold-start tap. The live tap listener is registered once below. ──
  const authedRef = useRef(false)
  useEffect(() => { authedRef.current = isAuthenticated }, [isAuthenticated])
  useEffect(() => {
    if (!isAuthenticated) return
    syncNotificationsOnLaunch()
    Notifications.getLastNotificationResponseAsync().then(resp => {
      if (resp?.notification.request.content.data?.kind === 'recap') openRecap(resp.notification.request.content.data)
    })
  }, [isAuthenticated])
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(resp => {
      if (authedRef.current && resp.notification.request.content.data?.kind === 'recap') openRecap(resp.notification.request.content.data)
    })
    return () => sub.remove()
  }, [])

  const onTutorialDone = () => {
    markTutorialSeen()
    setShowTutorial(false)
    // A fresh install from a Release APK boots the build-time bundle; pull the
    // latest OTA right after onboarding so new users start current. If one is
    // ready, offer the on-brand restart (no-op when already up to date / in dev).
    checkForUpdate().then(outcome => { if (outcome === 'ready') setShowUpdate(true) })
  }
  const onWhatsNewClose = () => { markWhatsNewSeen(); setShowWhatsNew(false) }

  // Don't render until fonts and auth check are done
  if (!fontsLoaded || !isReady) {
    return <View style={styles.splash} />
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={activeThemeMode() === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="(tabs)"    options={{ animation: 'fade' }} />
            <Stack.Screen name="settings"  options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="taste"     options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="compare"   options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="recaps"    options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="history"   options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="flagged-covers" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="design"    options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="load-times" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="errors"    options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="motion-lab" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="cover-lab" options={{ animation: 'fade' }} />
            <Stack.Screen name="labs"      options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="wrapped"   options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="story"     options={{ animation: 'fade', gestureEnabled: false }} />
          </>
        ) : (
          <Stack.Screen name="auth" options={{ animation: 'fade' }} />
        )}
        {/* OAuth redirect landing — always reachable, regardless of auth state */}
        <Stack.Screen name="callback" options={{ animation: 'fade' }} />
      </Stack>

      {/* Root-mounted overlays (above the whole navigator) */}
      {isAuthenticated && <LiquidTintFeeder />}
      {isAuthenticated && <QueueCartTray />}
      <StartQueueSheet visible={showQueue} tracks={queueTracks} onClose={() => { setShowQueue(false); setQueueTracks(undefined) }} />
      <WhatsNew visible={showWhatsNew} all={whatsNewAll} onClose={onWhatsNewClose} />
      {showTutorial && <Tutorial onDone={onTutorialDone} />}
      <ConfirmModal
        visible={showUpdate}
        glyph="sparkles"
        title="You're almost set"
        message="There's a newer version available. Restart now to grab the latest — or do it later from Settings."
        confirmLabel="Update now"
        cancelLabel="Later"
        onConfirm={() => { setShowUpdate(false); applyUpdate() }}
        onCancel={() => setShowUpdate(false)}
      />
      {/* showDialog() / showToast() from anywhere — kept last so it sits on top */}
      <ServerWakeBanner />
      <DialogHost />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  splash: { flex: 1, backgroundColor: Colors.background },
  crash:        { alignItems: 'center', justifyContent: 'center', padding: Spacing['3xl'], gap: Spacing.md },
  crashTitle:   { ...Type.title, textAlign: 'center' },
  crashBody:    { ...Type.body, color: Colors.textMuted, textAlign: 'center' },
  crashBtn:     { marginTop: Spacing.md, backgroundColor: Colors.greenPrimary, borderRadius: Radius.full, paddingVertical: Spacing.md, paddingHorizontal: Spacing['2xl'] },
  crashBtnText: { ...Type.label, color: Colors.background },
})
