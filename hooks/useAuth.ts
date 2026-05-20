import { useState, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { SecureKeys, flush } from '@/utils/cache'
import { api, BACKEND_URL } from '@/utils/api'
import type { SpotifyUser } from '@/types'

WebBrowser.maybeCompleteAuthSession()

// ─── PKCE + CSRF helpers ──────────────────────────────────────────────────────
function generateState(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // ── Check if we already have a valid token ──
  const getToken = useCallback(async (): Promise<string | null> => {
    return SecureStore.getItemAsync(SecureKeys.accessToken)
  }, [])

  // ── Kick off Spotify OAuth via backend ──
  const login = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      // Generate CSRF state param — verified server-side
      const state = generateState()

      // Build the login URL pointing at our Flask backend
      const loginUrl = `${BACKEND_URL}/login?mobile=true&state=${state}`

      // Open in an in-app browser session
      const result = await WebBrowser.openAuthSessionAsync(
        loginUrl,
        Linking.createURL('/auth/callback')
      )

      if (result.type !== 'success') {
        setError('Login was cancelled.')
        return false
      }

      // Parse the callback URL for our token
      const url = new URL(result.url)
      const token = url.searchParams.get('access_token')
      const refresh = url.searchParams.get('refresh_token')
      const returnedState = url.searchParams.get('state')
      const errorParam = url.searchParams.get('error')

      if (errorParam) {
        setError(`Spotify error: ${errorParam}`)
        return false
      }

      // CSRF check — state must match what we sent
      if (returnedState !== state) {
        setError('Security check failed. Please try again.')
        return false
      }

      if (!token) {
        setError('No token received. Please try again.')
        return false
      }

      // Persist tokens securely
      await SecureStore.setItemAsync(SecureKeys.accessToken, token)
      if (refresh) {
        await SecureStore.setItemAsync(SecureKeys.refreshToken, refresh)
      }

      return true
    } catch (err) {
      setError('Something went wrong. Check your connection.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Logout — flush everything ──
  const logout = useCallback(async (): Promise<void> => {
    await flush()
  }, [])

  // ── Fetch current user ──
  const getMe = useCallback(async (): Promise<SpotifyUser | null> => {
    try {
      return await api.get<SpotifyUser>('/api/me')
    } catch {
      return null
    }
  }, [])

  return { login, logout, getToken, getMe, isLoading, error }
}
