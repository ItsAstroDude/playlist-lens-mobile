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
