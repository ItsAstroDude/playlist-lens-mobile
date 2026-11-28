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

  it('rows scrolled away give up their iTunes turn: the row still on screen goes first', async () => {
    global.fetch = itunes([{ artistName: 'C', trackName: 'Gamma', artworkUrl100: 'http://c/100x100bb.jpg' }]) as any
    const m = load()
    const a = renderHook(() => m.useArtwork('track', 'Alpha', 'A'))
    const b = renderHook(() => m.useArtwork('track', 'Beta', 'B'))
    const c = renderHook(() => m.useArtwork('track', 'Gamma', 'C'))
    a.unmount(); b.unmount()                                 // scrolled off before their turn
    // Without skipping, Gamma would wait two 3.1 s gaps; waitFor gives up after 1 s.
    await waitFor(() => expect(c.result.current).toMatch(/^http/))
    const asked = (global.fetch as jest.Mock).mock.calls.map(([u]: [string]) => u).filter(u => u.includes('itunes'))
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('Gamma')
  })

  it('"no picture" is remembered across launches; a rate limit is not', async () => {
    global.fetch = itunes([], false) as any                  // 429
    const a = load()
    renderHook(() => a.useArtwork('track', 'Obscure', 'Nobody'))
    await waitFor(() => expect((global.fetch as jest.Mock)).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 0))
    expect(storage.getAllKeys().some((k: string) => k.startsWith('artmiss2:'))).toBe(false)

    global.fetch = itunes([]) as any                         // a real "no match"
    const b = load()
    renderHook(() => b.useArtwork('track', 'Obscure', 'Nobody'))
    await waitFor(() => expect(storage.getAllKeys().some((k: string) => k.startsWith('artmiss2:'))).toBe(true))

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

  it('a song iTunes doesn’t have gets its Spotify cover, found by the song’s URI in the play database', async () => {
    const { insertPlays, _resetForTests } = require('@/utils/playDb')
    _resetForTests()
    insertPlays([{ ts: '2026-11-16T10:00:00Z', ms_played: 1, spotify_track_uri: 'spotify:track:ABC123',
      master_metadata_track_name: 'God Only Knows', master_metadata_album_artist_name: 'bitbreaker', master_metadata_album_album_name: 'X' }], 'recent')
    global.fetch = jest.fn((url: string) => Promise.resolve(url.includes('oembed')
      ? { ok: true, status: 200, json: () => Promise.resolve({ thumbnail_url: 'https://i.scdn.co/image/abc' }) }
      : { ok: true, status: 200, json: () => Promise.resolve({ results: [] }) })) as any
    const m = load()
    const r = renderHook(() => m.useArtwork('track', 'God Only Knows', 'bitbreaker'))
    await waitFor(() => expect(r.result.current).toBe('https://i.scdn.co/image/abc'))
    const calls = (global.fetch as jest.Mock).mock.calls.map((c: unknown[]) => String(c[0]))
    expect(calls[0]).toContain('open.spotify.com%2Ftrack%2FABC123')
    expect(calls.some(u => u.includes('itunes'))).toBe(false)          // no need to ask iTunes
  })
})
