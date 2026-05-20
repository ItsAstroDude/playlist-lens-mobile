import React, { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
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
import { View, StyleSheet } from 'react-native'
import { Colors } from '@/constants/theme'

export default function RootLayout() {
  const [isReady,        setIsReady]        = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

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
  }, [])

  // Don't render until fonts and auth check are done
  if (!fontsLoaded || !isReady) {
    return <View style={styles.splash} />
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isAuthenticated ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="auth" />
        )}
      </Stack>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  splash: { flex: 1, backgroundColor: Colors.background },
})
