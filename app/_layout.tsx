import React, { useEffect, useState } from 'react'
import { Stack, router } from 'expo-router'
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
import * as SecureStore from 'expo-secure-store'
import { SecureKeys } from '@/utils/cache'
import { onSessionExpired, onSignedIn } from '@/utils/authEvents'
import { onOpenTutorial, onOpenWhatsNew } from '@/utils/overlayEvents'
import { Tutorial } from '@/components/onboarding/Tutorial'
import { WhatsNew } from '@/components/onboarding/WhatsNew'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { checkForUpdate, applyUpdate } from '@/utils/updates'
import {
  shouldShowTutorial, markTutorialSeen, shouldShowWhatsNew, markWhatsNewSeen,
} from '@/utils/whatsNew'
import { View, StyleSheet } from 'react-native'
import { Colors } from '@/constants/theme'

export default function RootLayout() {
  const [isReady,        setIsReady]        = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showTutorial,   setShowTutorial]   = useState(false)
  const [showWhatsNew,   setShowWhatsNew]    = useState(false)
  const [showUpdate,     setShowUpdate]      = useState(false)

  const [fontsLoaded] = useFonts({
    DMMono_400Regular,
    DMMono_500Medium,
    Syne_700Bold,
    Syne_800ExtraBold,
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
    const unsubWN  = onOpenWhatsNew(() => setShowWhatsNew(true))
    return () => { unsubExpired(); unsubSignedIn(); unsubTut(); unsubWN() }
  }, [])

  // First-run onboarding, else patch notes after a version bump.
  useEffect(() => {
    if (!isReady || !isAuthenticated) return
    if (shouldShowTutorial()) setShowTutorial(true)
    else if (shouldShowWhatsNew()) setShowWhatsNew(true)
  }, [isReady, isAuthenticated])

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
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="(tabs)"    options={{ animation: 'fade' }} />
            <Stack.Screen name="settings"  options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="taste"     options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="flagged-covers" options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <Stack.Screen name="auth" options={{ animation: 'fade' }} />
        )}
        {/* OAuth redirect landing — always reachable, regardless of auth state */}
        <Stack.Screen name="callback" options={{ animation: 'fade' }} />
      </Stack>

      {/* Root-mounted overlays (above the whole navigator) */}
      <WhatsNew visible={showWhatsNew} onClose={onWhatsNewClose} />
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
