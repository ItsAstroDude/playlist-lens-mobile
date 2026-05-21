import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'
import { SecureKeys } from './cache'
import { emitSessionExpired } from './authEvents'

// ─── Config ───────────────────────────────────────────────────────────────────
// In dev, derive host IP from Expo's dev server so physical devices work.
// Constants.expoConfig.hostUri is e.g. "192.168.1.5:8081" — we swap the port.
function getDevUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const ip = hostUri.split(':')[0]
    return `http://${ip}:8888`
  }
  return 'http://localhost:8888'
}

export const BACKEND_URL = __DEV__
  ? getDevUrl()
  : 'https://playlist-lens-mobile.onrender.com'

// How long to wait before showing the "Waking up servers..." cold start UI
const COLD_START_THRESHOLD_MS = 3000

// Max retries for smart retry logic
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// ─── Types ────────────────────────────────────────────────────────────────────
interface FetchOptions extends RequestInit {
  onColdStart?: () => void    // called if request takes > 3s (Railway wake-up)
  onRetry?:     (attempt: number) => void
  retries?:     number
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { onColdStart, onRetry, retries = 0, ...fetchOptions } = options
  const url = `${BACKEND_URL}${path}`

  let coldStartTimer: ReturnType<typeof setTimeout> | null = null

  // Start cold start timer — if request takes > 3s show the UI
  if (onColdStart) {
    coldStartTimer = setTimeout(onColdStart, COLD_START_THRESHOLD_MS)
  }

  const attemptFetch = async (attempt: number): Promise<T> => {
    try {
      const token = await SecureStore.getItemAsync(SecureKeys.accessToken)
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(fetchOptions.headers || {}),
      }

      const response = await fetch(url, { ...fetchOptions, headers })

      // Handle 429 — rate limited, wait and retry
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10)
        if (attempt < MAX_RETRIES) {
          onRetry?.(attempt + 1)
          await delay(retryAfter * 1000)
          return attemptFetch(attempt + 1)
        }
        throw new ApiError(429, 'Rate limited. Please wait a moment and try again.')
      }

      // Handle auth expired — clear stored token and signal the app to re-route
      if (response.status === 401) {
        await SecureStore.deleteItemAsync(SecureKeys.accessToken).catch(() => {})
        emitSessionExpired()
        throw new ApiError(401, 'Session expired. Please log in again.')
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        // body.error can be a Spotify error object {status, message} or a plain string
        const errMsg = typeof body.error === 'string'
          ? body.error
          : body.error?.message ?? `Server error ${response.status}`
        throw new ApiError(response.status, errMsg)
      }

      return response.json() as Promise<T>

    } catch (err) {
      if (err instanceof ApiError) throw err

      // Network error — retry with backoff
      if (attempt < (retries || MAX_RETRIES)) {
        onRetry?.(attempt + 1)
        await delay(RETRY_DELAY_MS * Math.pow(2, attempt)) // exponential backoff
        return attemptFetch(attempt + 1)
      }

      throw new ApiError(0, 'Connection failed. Check your network and try again.')
    } finally {
      if (coldStartTimer) clearTimeout(coldStartTimer)
    }
  }

  return attemptFetch(0)
}

// ─── Convenience methods ──────────────────────────────────────────────────────
export const api = {
  get: <T>(path: string, opts?: FetchOptions) =>
    apiFetch<T>(path, { method: 'GET', ...opts }),

  post: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
}

// ─── Custom error class ───────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
