import { storage } from '@/utils/cache'
import { reportError, pendingErrors, sentErrors, flushErrors, setErrorScreen } from '@/utils/errorReport'
import { api, ApiError } from '@/utils/api'

jest.mock('@/utils/api', () => {
  const actual = jest.requireActual('@/utils/api')
  return { ...actual, api: { ...actual.api, post: jest.fn(), get: jest.fn(), delete: jest.fn() } }
})

beforeEach(() => { storage.clearAll(); jest.mocked(api.post).mockReset() })

describe('error reports', () => {
  it('queues an error with context, crash-safe (synchronously)', () => {
    setErrorScreen('/wrapped')
    reportError(new TypeError('x is undefined'), { fatal: true })
    const [e] = pendingErrors()
    expect(e).toMatchObject({ message: 'TypeError: x is undefined', fatal: true, screen: '/wrapped' })
    expect(e.stack).toBeTruthy()
    expect(e.version).toBeTruthy()
  })

  it('ignores expected conditions: logged out, offline', () => {
    reportError(new ApiError(401, 'Session expired'))
    reportError(new ApiError(0, 'Connection failed'))
    reportError(new Error('Network request failed'))
    expect(pendingErrors()).toEqual([])
  })

  it('reports non-Error values', () => {
    reportError('plain string'); reportError({ code: 7 })
    expect(pendingErrors().map(e => e.message)).toEqual(['plain string', '{"code":7}'])
  })

  it('keeps at most 50 queued', () => {
    for (let i = 0; i < 60; i++) reportError(new Error(`e${i}`))
    const q = pendingErrors()
    expect(q).toHaveLength(50)
    expect(q[49].message).toBe('Error: e59')
  })

  it('flush sends the queue and moves it to the sent list', async () => {
    jest.mocked(api.post).mockResolvedValue({ saved: 2 })
    reportError(new Error('a')); reportError(new Error('b'))
    expect(await flushErrors()).toBe(2)
    expect(api.post).toHaveBeenCalledWith('/api/errors', { errors: expect.any(Array) })
    expect(pendingErrors()).toEqual([])
    expect(sentErrors().map(e => e.message)).toEqual(['Error: b', 'Error: a'])
  })

  it('flush keeps the queue when the server is unreachable', async () => {
    jest.mocked(api.post).mockRejectedValue(new Error('404'))
    reportError(new Error('a'))
    expect(await flushErrors()).toBe(0)
    expect(pendingErrors()).toHaveLength(1)
  })
})
