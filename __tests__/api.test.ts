/**
 * Tests for utils/api.ts
 *
 * We mock the global `fetch` and `expo-secure-store` so network calls
 * never leave the process. Tests verify retry logic, error handling,
 * and auth token injection.
 */

// Mock SecureStore before importing api so the module picks up our mock
import * as SecureStore from 'expo-secure-store'
jest.mock('expo-secure-store')

// Mock authEvents so session-expired doesn't blow up
jest.mock('../utils/authEvents', () => ({
  emitSessionExpired: jest.fn(),
}))

import { apiFetch, ApiError } from '../utils/api'
import { emitSessionExpired } from '../utils/authEvents'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok:      status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => headers[h] ?? null },
    json:    () => Promise.resolve(body),
  } as any)
}

function mockFetchNetwork() {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'))
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('apiFetch — happy path', () => {
  beforeEach(() => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok_123')
  })

  it('returns parsed JSON on 200', async () => {
    mockFetch(200, { items: [1, 2, 3] })
    const res = await apiFetch<{ items: number[] }>('/api/playlists')
    expect(res.items).toEqual([1, 2, 3])
  })

  it('injects Authorization header when token exists', async () => {
    mockFetch(200, {})
    await apiFetch('/api/me')
    const callArgs = (global.fetch as jest.Mock).mock.calls[0]
    expect(callArgs[1].headers.Authorization).toBe('Bearer tok_123')
  })

  it('skips Authorization header when no token stored', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)
    mockFetch(200, {})
    await apiFetch('/api/playlists')
    const callArgs = (global.fetch as jest.Mock).mock.calls[0]
    expect(callArgs[1].headers.Authorization).toBeUndefined()
  })
})

// ─── Error handling ───────────────────────────────────────────────────────────

describe('apiFetch — error handling', () => {
  beforeEach(() => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok_abc')
  })

  it('throws ApiError with server status on 4xx/5xx', async () => {
    mockFetch(500, { error: 'Internal server error' })
    await expect(apiFetch('/api/broken')).rejects.toThrow(ApiError)
  })

  it('propagates server error message from response body', async () => {
    mockFetch(400, { error: 'Bad playlist ID' })
    try {
      await apiFetch('/api/playlist/bad/tracks')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).message).toBe('Bad playlist ID')
    }
  })

  it('handles nested Spotify error object', async () => {
    mockFetch(400, { error: { status: 400, message: 'Invalid id' } })
    try {
      await apiFetch('/api/audio-features')
    } catch (e) {
      expect((e as ApiError).message).toBe('Invalid id')
    }
  })

  it('throws ApiError on network failure after retries', async () => {
    jest.useFakeTimers()
    mockFetchNetwork()
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)

    const promise = apiFetch('/api/playlists')

    // Attach the rejection handler FIRST so the rejection is not unhandled
    // when runAllTimersAsync fires the retry back-offs and settles the promise
    const assertion = expect(promise).rejects.toBeInstanceOf(ApiError)
    await jest.runAllTimersAsync()
    await assertion

    jest.useRealTimers()
  }, 15_000)

  it('exposes the HTTP status code on ApiError', async () => {
    mockFetch(404, { error: 'Not found' })
    try {
      await apiFetch('/api/profile/load/BAD-999')
    } catch (e) {
      expect((e as ApiError).status).toBe(404)
    }
  })
})

// ─── 401 — session expiry ─────────────────────────────────────────────────────

describe('apiFetch — 401 handling', () => {
  it('clears the stored token on 401', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('expired_tok')
    mockFetch(401, { error: 'Unauthorized' })

    await apiFetch('/api/me').catch(() => {})

    expect(SecureStore.deleteItemAsync).toHaveBeenCalled()
  })

  it('emits sessionExpired event on 401', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('expired_tok')
    mockFetch(401, {})

    await apiFetch('/api/me').catch(() => {})

    expect(emitSessionExpired).toHaveBeenCalled()
  })

  it('throws ApiError with status 401', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok')
    mockFetch(401, {})

    const err = await apiFetch('/api/me').catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(401)
  })
})

// ─── Cold start callback ──────────────────────────────────────────────────────

describe('apiFetch — cold start callback', () => {
  it('fires onColdStart callback when request takes > 3s', async () => {
    jest.useFakeTimers()
    const onColdStart = jest.fn()
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)

    // Fetch resolves after 4 seconds (simulated via fake timer)
    let resolveFetch!: (v: unknown) => void
    global.fetch = jest.fn().mockReturnValue(
      new Promise(res => { resolveFetch = res })
    )

    const promise = apiFetch('/api/playlists', { onColdStart })

    // Advance past the 3s cold-start threshold
    await jest.advanceTimersByTimeAsync(3100)
    expect(onColdStart).toHaveBeenCalledTimes(1)

    // Now resolve the fetch so the promise settles
    resolveFetch({
      ok: true, status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({}),
    })
    await promise

    jest.useRealTimers()
  })

  it('does NOT fire onColdStart when request resolves quickly', async () => {
    const onColdStart = jest.fn()
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)
    mockFetch(200, {})

    await apiFetch('/api/playlists', { onColdStart })
    expect(onColdStart).not.toHaveBeenCalled()
  })
})

// ─── ApiError ─────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const e = new ApiError(404, 'not found')
    expect(e).toBeInstanceOf(Error)
  })

  it('exposes status and message', () => {
    const e = new ApiError(429, 'Rate limited')
    expect(e.status).toBe(429)
    expect(e.message).toBe('Rate limited')
    expect(e.name).toBe('ApiError')
  })
})
