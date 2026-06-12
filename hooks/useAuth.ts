import { useState, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { SecureKeys, flush } from '@/utils/cache'
import { api, BACKEND_URL } from '@/utils/api'
import { emitSessionExpired, emitSignedIn } from '@/utils/authEvents'
import { setScopeStatus } from '@/utils/scopeStatus'
import type { SpotifyUser } from '@/types'

WebBrowser.maybeCompleteAuthSession()

// ─── PKCE + CSRF helpers ──────────────────────────────────────────────────────
function generateState(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// new URL() can silently misparse custom schemes like playlistlens:// in
// Hermes — searchParams may be empty even when the query string is present.
// This manual parser handles any URL format safely.
function parseUrlParams(url: string): Record<string, string> {
  const qi = url.indexOf('?')
  if (qi === -1) return {}
  return Object.fromEntries(
    url.slice(qi + 1).split('&').filter(Boolean).map(pair => {
      const ei = pair.indexOf('=')
      if (ei === -1) return [decodeURIComponent(pair), '']
      return [decodeURIComponent(pair.slice(0, ei)), decodeURIComponent(pair.slice(ei + 1))]
    })
  )
}

// ─── Token finalization ───────────────────────────────────────────────────────
// Shared by BOTH redirect paths:
//   1. openAuthSessionAsync capture (returns the URL directly)        → finalizeAuthFromUrl
//   2. the /callback deep-link route (Expo Router parses the params)  → finalizeAuthFromParams
// Verifies the CSRF state against the value we persisted before opening the
// browser, then stores the tokens. Idempotent — safe to run from either path.
type AuthResult = { ok: true } | { ok: false; error: string }

function first(v?: string | string[] | null): string | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export async function finalizeAuthFromParams(params: {
  access_token?:  string | string[] | null
  refresh_token?: string | string[] | null
  state?:         string | string[] | null
  error?:         string | string[] | null
}): Promise<AuthResult> {
  const token         = first(params.access_token)
  const refresh       = first(params.refresh_token)
  const returnedState = first(params.state)
  const errorParam    = first(params.error)

  if (errorParam) return { ok: false, error: `Spotify error: ${errorParam}` }

  // CSRF check — state must match what we sent (read from secure storage so this
  // works even when the app was cold-started by the redirect intent).
  const savedState = await SecureStore.getItemAsync(SecureKeys.oauthState)
  if (!returnedState || returnedState !== savedState) {
    return { ok: false, error: 'Security check failed. Please try again.' }
  }

  if (!token) return { ok: false, error: 'No token received. Please try again.' }

  await SecureStore.setItemAsync(SecureKeys.accessToken, token)
  if (refresh) await SecureStore.setItemAsync(SecureKeys.refreshToken, refresh)
  // One-time state — clear so it can't be replayed.
  await SecureStore.deleteItemAsync(SecureKeys.oauthState)

  // Any login through the v1.3 backend grants the full scope set (now-playing
  // + playlist writes) — clear any pending "reconnect Spotify" prompts.
  setScopeStatus('ok')

  // Tell the root layout we're authed → it purges the auth screen from the
  // navigator so a back-gesture can't pop back to login.
  emitSignedIn()

  return { ok: true }
}

export async function finalizeAuthFromUrl(url: string): Promise<AuthResult> {
  return finalizeAuthFromParams(parseUrlParams(url))
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
      // Generate CSRF state and persist it so the /callback route can verify it
      // (the redirect may cold-start the app, losing this closure's memory).
      const state = generateState()
      await SecureStore.setItemAsync(SecureKeys.oauthState, state)

      // The deep-link URL this build listens on. Use a dedicated top-level
      // /callback route — Android Chrome Custom Tabs frequently fire a server
      // 302-to-custom-scheme as an external intent instead of handing it back to
      // the auth session, so app/callback.tsx is the reliable handler.
      const redirectUrl = Linking.createURL('/callback')

      // Pass it to the backend so the callback redirects to the right scheme
      const loginUrl = `${BACKEND_URL}/login?mobile=true&state=${state}&redirect_url=${encodeURIComponent(redirectUrl)}`

      // Open in an in-app browser session
      const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUrl)

      // Happy path: the auth session captured the redirect itself.
      if (result.type === 'success') {
        const res = await finalizeAuthFromUrl(result.url)
        if (!res.ok) { setError(res.error); return false }
        return true
      }

      // Capture failed (Custom Tab launched the intent → /callback route handles
      // it) OR the user cancelled. Give the route a moment to store the token;
      // if it does, this was a successful login through the deep-link path.
      for (let i = 0; i < 25; i++) {
        const token = await SecureStore.getItemAsync(SecureKeys.accessToken)
        if (token) return true
        await new Promise(r => setTimeout(r, 120))
      }

      setError('Login was cancelled.')
      return false
    } catch (err) {
      setError('Something went wrong. Check your connection.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Logout — flush everything and route back to auth ──
  const logout = useCallback(async (): Promise<void> => {
    await flush()
    emitSessionExpired()
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
