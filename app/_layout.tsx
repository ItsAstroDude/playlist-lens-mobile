import React, { useEffect, useRef, useState } from 'react'
import { Stack, router } from 'expo-router'
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
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono'
import * as SecureStore from 'expo-secure-store'
import { SecureKeys } from '@/utils/cache'
import { onSessionExpired, onSignedIn } from '@/utils/authEvents'
import { onOpenTutorial, onOpenWhatsNew, onOpenStartQueue } from '@/utils/overlayEvents'
import { Tutorial } from '@/components/onboarding/Tutorial'
import { WhatsNew } from '@/components/onboarding/WhatsNew'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { QueueCartTray } from '@/components/queue/QueueCartTray'
import { StartQueueSheet } from '@/components/queue/StartQueueSheet'
import { checkForUpdate, applyUpdate } from '@/utils/updates'
import {
  shouldShowTutorial, markTutorialSeen, shouldShowWhatsNew, markWhatsNewSeen,
} from '@/utils/whatsNew'
import { useAutoWrapped } from '@/hooks/useAutoWrapped'
import { syncNotificationsOnLaunch } from '@/utils/notifications'
import { View, StyleSheet } from 'react-native'
import { Colors, activeThemeMode } from '@/constants/theme'

export default function RootLayout() {
  const [isReady,        setIsReady]        = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showTutorial,   setShowTutorial]   = useState(false)
  const [showWhatsNew,   setShowWhatsNew]    = useState(false)
  const [whatsNewAll,    setWhatsNewAll]     = useState(false)  // Settings = full history
  const [showUpdate,     setShowUpdate]      = useState(false)
  const [showQueue,      setShowQueue]       = useState(false)

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
  })

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
    // The floating queue tray (anywhere) opens the start-queue sheet.
    const unsubQueue = onOpenStartQueue(() => setShowQueue(true))
    return () => { unsubExpired(); unsubSignedIn(); unsubTut(); unsubWN(); unsubQueue() }
  }, [])

  // First-run onboarding, else patch notes after a version bump.
  useEffect(() => {
    if (!isReady || !isAuthenticated) return
    if (shouldShowTutorial()) setShowTutorial(true)
    // Auto-fire after a version bump → just the newest entry, not the whole history.
    else if (shouldShowWhatsNew()) { setWhatsNewAll(false); setShowWhatsNew(true) }
  }, [isReady, isAuthenticated])

  // ── Recap notifications (v1.5) — re-assert the schedule on launch + open Recaps
  // from a cold-start tap. The live tap listener is registered once below. ──
  const authedRef = useRef(false)
  useEffect(() => { authedRef.current = isAuthenticated }, [isAuthenticated])
  useEffect(() => {
    if (!isAuthenticated) return
    syncNotificationsOnLaunch()
    Notifications.getLastNotificationResponseAsync().then(resp => {
      if (resp?.notification.request.content.data?.kind === 'recap') router.push('/recaps')
    })
  }, [isAuthenticated])
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(resp => {
      if (authedRef.current && resp.notification.request.content.data?.kind === 'recap') router.push('/recaps')
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
            <Stack.Screen name="flagged-covers" options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <Stack.Screen name="auth" options={{ animation: 'fade' }} />
        )}
        {/* OAuth redirect landing — always reachable, regardless of auth state */}
        <Stack.Screen name="callback" options={{ animation: 'fade' }} />
      </Stack>

      {/* Root-mounted overlays (above the whole navigator) */}
      {isAuthenticated && <QueueCartTray />}
      <StartQueueSheet visible={showQueue} onClose={() => setShowQueue(false)} />
      <WhatsNew visible={showWhatsNew} all={whatsNewAll} onClose={onWhatsNewClose} />
      {showTutorial && <Tutorial onDone={onTutorialDone} />}
      <ConfirmModal
        visible={showUpdate}
        glyph="✦"
        title="You're almost set"
        message="There's a newer version available. Restart now to grab the latest — or do it later from Settings."
        confirmLabel="Update now"
        cancelLabel="Later"
        onConfirm={() => { setShowUpdate(false); applyUpdate() }}
        onCancel={() => setShowUpdate(false)}
      />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  splash: { flex: 1, backgroundColor: Colors.background },
})
