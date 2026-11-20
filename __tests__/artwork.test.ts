import { pickArtwork, norm } from '@/hooks/useArtwork'

const hit = (artistName: string, trackName: string, url = `http://x/${artistName}/100x100bb.jpg`) =>
  ({ artistName, trackName, artworkUrl100: url })

describe('norm', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(norm('Tyler, The Creator')).toBe('tyler the creator')
    expect(norm('Beyoncé')).toBe('beyonce')
    expect(norm('AC/DC')).toBe('ac dc')
  })
  it('maps & to and', () => {
    expect(norm('Florence & The Machine')).toBe('florence and the machine')
  })
})

describe('pickArtwork', () => {
  it('returns null for empty results', () => {
    expect(pickArtwork([], 'track', 'x', 'y')).toBeNull()
  })

  it('picks the result whose artist matches, not just the first hit', () => {
    const results = [
      hit('Some Cover Band', 'Sicko Mode'),                 // wrong artist, first
      hit('Travis Scott', 'Sicko Mode', 'http://ok/100x100bb.jpg'),
    ]
    const url = pickArtwork(results, 'track', 'Sicko Mode', 'Travis Scott')
    expect(url).toBe('http://ok/600x600bb.jpg') // upscaled, from the right artist
  })

  it('matches artist for an artist lookup (Tyler, The Creator)', () => {
    const results = [
      hit('Tribute Players', 'Earfquake'),
      hit('Tyler, The Creator', 'EARFQUAKE', 'http://tyler/100x100bb.jpg'),
    ]
    const url = pickArtwork(results, 'artist', 'Tyler, The Creator')
    expect(url).toBe('http://tyler/600x600bb.jpg')
  })

  it('prefers the matching title among same-artist hits', () => {
    const results = [
      hit('Kendrick Lamar', 'Money Trees'),
      hit('Kendrick Lamar', 'HUMBLE.', 'http://humble/100x100bb.jpg'),
    ]
    const url = pickArtwork(results, 'track', 'HUMBLE.', 'Kendrick Lamar')
    expect(url).toBe('http://humble/600x600bb.jpg')
  })

  it('falls back to the first result when no artist matches', () => {
    const results = [hit('Nobody', 'Whatever', 'http://fb/100x100bb.jpg')]
    const url = pickArtwork(results, 'track', 'X', 'Mystery Artist')
    expect(url).toBe('http://fb/600x600bb.jpg')
  })
})

describe('artwork cache (useArtwork)', () => {
  const { renderHook, waitFor } = require('@testing-library/react-native')
  const { storage } = require('@/utils/cache')

  const itunes = (results: unknown[], ok = true) =>
    jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 429, json: () => Promise.resolve({ results }) })

  // "A new launch": forget the hook's in-memory session (saved storage stays).
  const load = () => { const m = require('@/hooks/useArtwork'); m._resetArtworkSession(); return m }

  beforeEach(() => { storage.clearAll() })

  it('a found cover is saved and used next time without asking again', async () => {
    global.fetch = itunes([{ artistName: 'Radiohead', trackName: 'Reckoner', artworkUrl100: 'http://x/a/100x100bb.jpg' }]) as any
    const first = load()
    const r1 = renderHook(() => first.useArtwork('track', 'Reckoner', 'Radiohead'))
    await waitFor(() => expect(r1.result.current).toMatch(/^http/))
    const calls = (global.fetch as jest.Mock).mock.calls.length

    const second = load()                                   // "next launch"
    const r2 = renderHook(() => second.useArtwork('track', 'Reckoner', 'Radiohead'))
    expect(r2.result.current).toBe(r1.result.current)       // there on the first render
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(calls)
  })

  it('"no picture" is remembered across launches; a rate limit is not', async () => {
    global.fetch = itunes([], false) as any                  // 429
    const a = load()
    renderHook(() => a.useArtwork('track', 'Obscure', 'Nobody'))
    await waitFor(() => expect((global.fetch as jest.Mock)).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 0))
    expect(storage.getAllKeys().some((k: string) => k.startsWith('artmiss:'))).toBe(false)

    global.fetch = itunes([]) as any                         // a real "no match"
    const b = load()
    renderHook(() => b.useArtwork('track', 'Obscure', 'Nobody'))
    await waitFor(() => expect(storage.getAllKeys().some((k: string) => k.startsWith('artmiss:'))).toBe(true))

    global.fetch = itunes([]) as any
    const c = load()                                         // next launch: no lookup at all
    renderHook(() => c.useArtwork('track', 'Obscure', 'Nobody'))
    await new Promise(r => setTimeout(r, 0))
    expect(global.fetch as jest.Mock).not.toHaveBeenCalled()
  })

  it('Clear cache keeps found and hand-picked covers', () => {
    const { clearCaches } = require('@/utils/cache')
    storage.set('art:track:x:y', 'http://x'); storage.set('artov:track:x:y', 'http://pick'); storage.set('artmiss:art:track:z:', 1)
    storage.set('something_else', 'v')
    clearCaches()
    expect(storage.getString('art:track:x:y')).toBe('http://x')
    expect(storage.getString('artov:track:x:y')).toBe('http://pick')
    expect(storage.getAllKeys()).not.toContain('artmiss:art:track:z:')
    expect(storage.getAllKeys()).not.toContain('something_else')
  })
})
