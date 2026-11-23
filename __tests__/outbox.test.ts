const mockPost = jest.fn()
jest.mock('@/utils/api', () => {
  class ApiError extends Error { mockStatus = 0 }
  return { ApiError, api: { post: (...a: unknown[]) => mockPost(...a) } }
})
jest.mock('@/utils/dialog', () => ({ showToast: jest.fn() }))
jest.mock('@/utils/scopeStatus', () => ({ setScopeStatus: jest.fn() }))

import { _resetOutbox, enqueue, kick, nextDelay, pendingCount } from '@/utils/outbox'
import { showToast } from '@/utils/dialog'

beforeEach(() => { _resetOutbox(); mockPost.mockReset(); jest.useFakeTimers() })
afterEach(() => { jest.useRealTimers() })
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }

describe('outbox', () => {
  it('backs off 2 s, 5 s, 15 s, 1 min, then 5 min', () => {
    expect([1, 2, 3, 4, 5, 9].map(nextDelay)).toEqual([2_000, 5_000, 15_000, 60_000, 300_000, 300_000])
  })
  it('sends a new playlist and forgets it once it lands', async () => {
    mockPost.mockResolvedValue({})
    enqueue({ kind: 'create', name: 'Mix (refreshed)', uris: ['spotify:track:a'], description: 'd' })
    await flush()
    expect(mockPost).toHaveBeenCalledWith('/api/playlist/create', { name: 'Mix (refreshed)', uris: ['spotify:track:a'], description: 'd' })
    expect(pendingCount()).toBe(0)
  })
  it('trims in order — backup first — and never backs up twice on a retry', async () => {
    mockPost.mockResolvedValueOnce({})                         // duplicate ok
      .mockRejectedValueOnce(new Error('network'))             // remove fails
      .mockResolvedValue({})                                   // remove ok on retry
    enqueue({ kind: 'trim', playlistId: 'p1', backupName: 'backup', cutUris: ['spotify:track:x'] })
    await flush()
    expect(mockPost.mock.calls.map(c => c[0])).toEqual(['/api/playlist/p1/duplicate', '/api/playlist/p1/remove'])
    expect(pendingCount()).toBe(1)
    jest.advanceTimersByTime(2_000); await flush(); await kick(); await flush()
    expect(mockPost.mock.calls.map(c => c[0])).toEqual(['/api/playlist/p1/duplicate', '/api/playlist/p1/remove', '/api/playlist/p1/remove'])
    expect(pendingCount()).toBe(0)
  })
  it('keeps trying quietly, and says so once after a few failures', async () => {
    mockPost.mockRejectedValue(new Error('down'))
    enqueue({ kind: 'create', name: 'n', uris: [], description: '' })
    for (const wait of [0, 2_000, 5_000, 15_000]) { jest.advanceTimersByTime(wait); await flush(); await kick(); await flush() }
    expect(pendingCount()).toBe(1)
    expect((showToast as jest.Mock).mock.calls.length).toBe(1)
  })
})
