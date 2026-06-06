import React, { useEffect, useRef, useState } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { finalizeAuthFromParams } from '@/hooks/useAuth'
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme'

/**
 * OAuth redirect landing route.
 *
 * Spotify → backend → `playlistlens://callback?access_token=…&refresh_token=…&state=…`
 *
 * On Android, Chrome Custom Tabs commonly fire a server 302-to-custom-scheme as
 * an external intent rather than handing it back to openAuthSessionAsync, so the
 * deep link lands here as a real navigation. This screen verifies the CSRF state,
 * stores the tokens, and routes into the app. (When the auth session *does*
 * capture the redirect, useAuth handles it directly and this route never mounts.)
 */
export default function CallbackScreen() {
  const params = useLocalSearchParams<{
    access_token?:  string
    refresh_token?: string
    state?:         string
    error?:         string
  }>()
  const [msg, setMsg] = useState('Finishing sign-in…')
  const handled = useRef(false)

  useEffect(() => {
    const hasPayload = !!(params.access_token || params.error)
    if (handled.current || !hasPayload) return
    handled.current = true

    ;(async () => {
      const res = await finalizeAuthFromParams(params)
      try { WebBrowser.dismissBrowser() } catch {}
      if (res.ok) {
        router.replace('/(tabs)')
      } else {
        setMsg(res.error)
        setTimeout(() => router.replace('/auth'), 1400)
      }
    })()
  }, [params])

  // Safety net: if the redirect arrives with no usable payload, don't spin forever.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!handled.current) router.replace('/auth')
    }, 6000)
    return () => clearTimeout(t)
  }, [])

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.greenPrimary} size="large" />
      <Text style={styles.text}>{msg}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             Spacing.xl,
  },
  text: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.base,
    color:      Colors.textMuted,
  },
})
