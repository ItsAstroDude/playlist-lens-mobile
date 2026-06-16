/**
 * Tests for utils/playback.ts — the Custom Queues client (v1.5).
 * Pure helpers need no mocks; the network helpers mock global.fetch (same shape
 * as api.test.ts) to verify the play-then-append orchestration.
 */
import * as SecureStore from 'expo-secure-store'
jest.mock('expo-secure-store')
jest.mock('../utils/authEvents', () => ({ emitSessionExpired: jest.fn(), emitSignedIn: jest.fn() }))

import {
  pickTarget, orderUris, trackUrisOnly, classifyPlaybackError,
  startQueue, setPlaybackScopeMissing, playbackScopeMissing,
  type PlaybackDevice,
} from '@/utils/playback'
import { ApiError } from '@/utils/api'
import { storage } from '@/utils/cache'

const dev = (over: Partial<PlaybackDevice>): PlaybackDevice => ({
  id: 'd1', name: 'Phone', type: 'Smartphone',
  is_active: false, is_restricted: false, volume_percent: 50, ...over,
})

// ─── Pure helpers ─────────────────────────────────────────────────────────────
describe('pickTarget', () => {
  it('returns the active controllable device', () => {
    const t = pickTarget([dev({ id: 'a', is_active: false }), dev({ id: 'b', is_active: true })])
    expect(t).toEqual({ kind: 'active', device: expect.objectContaining({ id: 'b' }) })
  })
  it('falls back to the first idle controllable device', () => {
    const t = pickTarget([dev({ id: 'a' }), dev({ id: 'b' })])
    expect(t).toEqual({ kind: 'idle', device: expect.objectContaining({ id: 'a' }) })
  })
  it('ignores restricted and id-less devices', () => {
    expect(pickTarget([dev({ id: 'a', is_restricted: true }), dev({ id: null })]))
      .toEqual({ kind: 'none' })
  })
  it('returns none for an empty list', () => {
    expect(pickTarget([])).toEqual({ kind: 'none' })
  })
})

describe('orderUris / trackUrisOnly', () => {
  it('keeps only spotify:track: uris', () => {
    expect(trackUrisOnly(['spotify:track:a', 'spotify:album:b', 'spotify:local:c', 'spotify:track:d']))
      .toEqual(['spotify:track:a', 'spotify:track:d'])
  })
  it('preserves order when not shuffling', () => {
    const u = ['spotify:track:a', 'spotify:track:b', 'spotify:track:c']
    expect(orderUris(u, false)).toEqual(u)
  })
  it('shuffle keeps the same multiset', () => {
    const u = Array.from({ length: 20 }, (_, i) => `spotify:track:${i}`)
    expect([...orderUris(u, true)].sort()).toEqual([...u].sort())
  })
})

describe('classifyPlaybackError', () => {
  it('403 with premium message → premium', () => {
    expect(classifyPlaybackError(new ApiError(403, 'Player command failed: Premium required'))).toBe('premium')
  })
  it('403 otherwise → scope', () => {
    expect(classifyPlaybackError(new ApiError(403, 'Insufficient client scope'))).toBe('scope')
  })
  it('404 → noDevice', () => {
    expect(classifyPlaybackError(new ApiError(404, 'NO_ACTIVE_DEVICE'))).toBe('noDevice')
  })
  it('non-ApiError → other', () => {
    expect(classifyPlaybackError(new Error('boom'))).toBe('other')
  })
})

describe('scope flag', () => {
  it('persists and clears', () => {
    storage.clearAll()
    expect(playbackScopeMissing()).toBe(false)
    setPlaybackScopeMissing(true)
    expect(playbackScopeMissing()).toBe(true)
    setPlaybackScopeMissing(false)
    expect(playbackScopeMissing()).toBe(false)
  })
})

// ─── Orchestration (mocked fetch) ─────────────────────────────────────────────
function routeFetch(opts: { queueFails?: boolean } = {}) {
  const calls: Array<{ url: string; method: string; body: any }> = []
  global.fetch = jest.fn((url: any, init: any) => {
    const u = String(url)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body) : undefined
    calls.push({ url: u, method, body })
    const ok = (b: unknown, status = 200) => Promise.resolve({
      ok: status >= 200 && status < 300, status,
      headers: { get: () => null }, json: () => Promise.resolve(b),
    } as any)
    if (u.endsWith('/api/playback/play'))  return ok({ started: body.uris.length })
    if (u.endsWith('/api/playback/queue')) return opts.queueFails ? ok({ error: 'fail' }, 500) : ok({ queued: body.uri })
    return ok({})
  })
  return calls
}

describe('startQueue orchestration', () => {
  beforeEach(() => { (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok') })

  it('plays the first 100 and appends the remainder one-by-one', async () => {
    const calls = routeFetch()
    const uris = Array.from({ length: 150 }, (_, i) => `spotify:track:${i}`)
    const res = await startQueue(uris)
    expect(res).toEqual({ started: 100, queued: 50 })
    expect(calls.filter(c => c.url.endsWith('/api/playback/play')).length).toBe(1)
    expect(calls.filter(c => c.url.endsWith('/api/playback/queue')).length).toBe(50)
    // first play body holds exactly the first 100, in order
    const play = calls.find(c => c.url.endsWith('/api/playback/play'))!
    expect(play.method).toBe('PUT')
    expect(play.body.uris.length).toBe(100)
    expect(play.body.uris[0]).toBe('spotify:track:0')
  })

  it('forwards device_id when given', async () => {
    const calls = routeFetch()
    await startQueue(['spotify:track:a'], { deviceId: 'DEVICE9' })
    expect(calls[0].body.device_id).toBe('DEVICE9')
  })

  it('stops appending on the first queue failure but keeps the started count', async () => {
    routeFetch({ queueFails: true })
    const uris = Array.from({ length: 130 }, (_, i) => `spotify:track:${i}`)
    const res = await startQueue(uris)
    expect(res.started).toBe(100)
    expect(res.queued).toBe(0)   // first append failed → break
  })

  it('throws when there are no playable uris', async () => {
    routeFetch()
    await expect(startQueue(['spotify:album:x'])).rejects.toBeInstanceOf(ApiError)
  })
})
