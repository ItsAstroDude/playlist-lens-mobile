/**
 * Tests for utils/analyze.ts
 *
 * These are pure-function tests — no React, no native modules, no network.
 * If any of these fail, the analysis pipeline is broken at its core.
 */
import {
  buildAnalysis,
  computeVibe,
  computeVibeFromGenres,
  normalizeGenre,
  fmtDuration,
  fmtTempo,
} from '../utils/analyze'
import { makeTrack, makeFeatures } from './fixtures'
import type { SpotifyTrack, SpotifyAudioFeatures, GenreCount } from '../types'

// ─── buildAnalysis ────────────────────────────────────────────────────────────

describe('buildAnalysis', () => {
  const genreMap = { 'artist-1': ['hip-hop', 'rap'], 'artist-2': ['pop'] }

  it('returns correct shape with minimal data', () => {
    const tracks   = [makeTrack()]
    const features = [makeFeatures()]
    const result   = buildAnalysis('pl-1', 'My Playlist', '', null, tracks, features, genreMap)

    expect(result.playlistId).toBe('pl-1')
    expect(result.playlistName).toBe('My Playlist')
    expect(result.tracks).toHaveLength(1)
    expect(result.topArtists).toHaveLength(1)
    expect(result.audioFeatures).not.toBeNull()
    expect(result.vibe).toBeTruthy()
  })

  it('counts artist appearances correctly', () => {
    const tracks = [
      makeTrack({ id: 't1', artists: [{ id: 'a1', name: 'Drake' }] }),
      makeTrack({ id: 't2', artists: [{ id: 'a1', name: 'Drake' }] }),
      makeTrack({ id: 't3', artists: [{ id: 'a2', name: 'Kendrick' }] }),
    ]
    const result = buildAnalysis('pl', 'pl', '', null, tracks, [], {})

    const drake   = result.topArtists.find(a => a.id === 'a1')
    const kendrick = result.topArtists.find(a => a.id === 'a2')
    expect(drake?.count).toBe(2)
    expect(kendrick?.count).toBe(1)
    // Should be sorted by count desc
    expect(result.topArtists[0].id).toBe('a1')
  })

  it('weights genre tally by artist appearance count', () => {
    const tracks = [
      makeTrack({ id: 't1', artists: [{ id: 'a1', name: 'Artist A' }] }),
      makeTrack({ id: 't2', artists: [{ id: 'a1', name: 'Artist A' }] }),
      makeTrack({ id: 't3', artists: [{ id: 'a2', name: 'Artist B' }] }),
    ]
    const gmap = { a1: ['hip-hop'], a2: ['pop'] }
    const result = buildAnalysis('pl', 'pl', '', null, tracks, [], gmap)

    const hipHop = result.topGenres.find(g => g.genre === 'hip-hop')
    const pop    = result.topGenres.find(g => g.genre === 'pop')
    // hip-hop appears via a1 who has 2 tracks; pop via a2 who has 1
    expect(hipHop!.count).toBeGreaterThan(pop!.count)
  })

  it('averages audio features correctly', () => {
    const tracks = [
      makeTrack({ id: 't1' }),
      makeTrack({ id: 't2' }),
    ]
    const features = [
      makeFeatures({ id: 't1', energy: 0.4, danceability: 0.6 }),
      makeFeatures({ id: 't2', energy: 0.8, danceability: 0.2 }),
    ]
    const result = buildAnalysis('pl', 'pl', '', null, tracks, features, {})

    expect(result.audioFeatures?.energy).toBeCloseTo(0.6)
    expect(result.audioFeatures?.danceability).toBeCloseTo(0.4)
  })

  it('returns null audioFeatures when no features provided', () => {
    const result = buildAnalysis('pl', 'pl', '', null, [makeTrack()], [], {})
    expect(result.audioFeatures).toBeNull()
  })

  it('computes total duration correctly', () => {
    const tracks = [
      makeTrack({ id: 't1', duration_ms: 180_000 }),
      makeTrack({ id: 't2', duration_ms: 240_000 }),
    ]
    const result = buildAnalysis('pl', 'pl', '', null, tracks, [], {})
    expect(result.totalMs).toBe(420_000)
  })

  it('computes avgPop correctly', () => {
    const tracks = [
      makeTrack({ id: 't1', popularity: 40 }),
      makeTrack({ id: 't2', popularity: 80 }),
    ]
    const result = buildAnalysis('pl', 'pl', '', null, tracks, [], {})
    expect(result.avgPop).toBe(60)
  })

  it('buckets decades from release dates', () => {
    const tracks = [
      makeTrack({ id: 't1', album: { name: '', release_date: '1990-01-01', images: [] } }),
      makeTrack({ id: 't2', album: { name: '', release_date: '1995-06-15', images: [] } }),
      makeTrack({ id: 't3', album: { name: '', release_date: '2020-03-01', images: [] } }),
    ]
    const result = buildAnalysis('pl', 'pl', '', null, tracks, [], {})
    const nineties = result.decades.find(d => d.label === '1990s')
    const twenties = result.decades.find(d => d.label === '2020s')
    expect(nineties?.count).toBe(2)
    expect(twenties?.count).toBe(1)
  })

  it('caps topArtists at 50 and topGenres at 16', () => {
    const tracks = Array.from({ length: 60 }, (_, i) =>
      makeTrack({ id: `t${i}`, artists: [{ id: `a${i}`, name: `Artist ${i}` }] })
    )
    const gmap: Record<string, string[]> = {}
    tracks.forEach((t, i) => { gmap[`a${i}`] = [`genre-${i}`] })

    const result = buildAnalysis('pl', 'pl', '', null, tracks, [], gmap)
    expect(result.topArtists.length).toBeLessThanOrEqual(50)
    expect(result.topArtists.length).toBeGreaterThan(10) // deeper list than before
    expect(result.topGenres.length).toBeLessThanOrEqual(16)
  })

  it('excludes placeholder/invalid release years from decades', () => {
    const tracks = [
      makeTrack({ id: 't1', album: { name: '', release_date: '1900-01-01', images: [] } }), // placeholder
      makeTrack({ id: 't2', album: { name: '', release_date: '0000',       images: [] } }), // junk
      makeTrack({ id: 't3', album: { name: '', release_date: '2019-05-01', images: [] } }), // valid
    ]
    const result = buildAnalysis('pl', 'pl', '', null, tracks, [], {})
    expect(result.decades.find(d => d.label === '1900s')).toBeUndefined()
    expect(result.decades.find(d => d.label === '2010s')?.count).toBe(1)
  })

  it('handles an empty track list without throwing', () => {
    expect(() => buildAnalysis('pl', 'pl', '', null, [], [], {})).not.toThrow()
    const result = buildAnalysis('pl', 'pl', '', null, [], [], {})
    expect(result.tracks).toHaveLength(0)
    expect(result.avgPop).toBe(0)
    expect(result.totalMs).toBe(0)
  })
})

// ─── computeVibe ──────────────────────────────────────────────────────────────

describe('computeVibe', () => {
  it('returns dance vibe for high danceability + moderate energy, low valence', () => {
    // Made to move = danceability*1.4 + energy*0.4 - acousticness*0.3
    // Feel-good     = valence*1.0   + danceability*0.8 + energy*0.5
    // With valence low (0.15), dance (1.56) beats feel-good (1.19)
    const vibe = computeVibe({
      danceability: 0.95, energy: 0.6, valence: 0.15,
      acousticness: 0.05, instrumentalness: 0.0, liveness: 0.1, avgTempo: 128,
    })
    expect(vibe).toBe('💃 Made to move')
  })

  it('returns acoustic/raw vibe for high acousticness', () => {
    const vibe = computeVibe({
      danceability: 0.2, energy: 0.2, valence: 0.4,
      acousticness: 0.95, instrumentalness: 0.0, liveness: 0.1, avgTempo: 90,
    })
    expect(vibe).toBe('🎸 Raw & organic')
  })

  it('returns instrumental vibe for high instrumentalness', () => {
    const vibe = computeVibe({
      danceability: 0.3, energy: 0.4, valence: 0.3,
      acousticness: 0.2, instrumentalness: 0.9, liveness: 0.1, avgTempo: 100,
    })
    expect(vibe).toBe('🎹 Instrumental')
  })

  it('returns melancholic vibe for low energy + low valence', () => {
    const vibe = computeVibe({
      danceability: 0.2, energy: 0.15, valence: 0.1,
      acousticness: 0.3, instrumentalness: 0.0, liveness: 0.1, avgTempo: 75,
    })
    expect(vibe).toBe('🌙 Melancholic & calm')
  })

  it('returns dark vibe for high energy + low valence', () => {
    const vibe = computeVibe({
      danceability: 0.5, energy: 0.9, valence: 0.05,
      acousticness: 0.05, instrumentalness: 0.0, liveness: 0.2, avgTempo: 150,
    })
    expect(vibe).toBe('🌑 Intense & dark')
  })

  it('always returns a non-empty string', () => {
    // Neutral profile — should still pick something
    const vibe = computeVibe({
      danceability: 0.5, energy: 0.5, valence: 0.5,
      acousticness: 0.5, instrumentalness: 0.5, liveness: 0.5, avgTempo: 120,
    })
    expect(typeof vibe).toBe('string')
    expect(vibe.length).toBeGreaterThan(0)
  })
})

// ─── computeVibeFromGenres ────────────────────────────────────────────────────

describe('computeVibeFromGenres', () => {
  function g(genre: string, count = 10): GenreCount { return { genre, count } }

  it('returns null for empty genre list', () => {
    expect(computeVibeFromGenres([])).toBeNull()
  })

  it('detects hip-hop → dance vibe', () => {
    expect(computeVibeFromGenres([g('hip-hop'), g('trap')])).toBe('💃 Made to move')
  })

  it('detects metal → dark vibe', () => {
    expect(computeVibeFromGenres([g('metal'), g('hardcore')])).toBe('🌑 Intense & dark')
  })

  it('detects classical → instrumental vibe', () => {
    expect(computeVibeFromGenres([g('classical'), g('piano')])).toBe('🎹 Instrumental')
  })

  it('detects lo-fi → melancholic vibe', () => {
    expect(computeVibeFromGenres([g('lo-fi'), g('shoegaze')])).toBe('🌙 Melancholic & calm')
  })

  it('detects edm/house → dance vibe', () => {
    expect(computeVibeFromGenres([g('house'), g('techno'), g('edm')])).toBe('💃 Made to move')
  })

  it('detects folk/acoustic → raw & organic', () => {
    expect(computeVibeFromGenres([g('folk'), g('acoustic'), g('singer-songwriter')])).toBe('🎸 Raw & organic')
  })
})

// ─── normalizeGenre ───────────────────────────────────────────────────────────

describe('normalizeGenre', () => {
  it('normalises jpop → j-pop', () => {
    expect(normalizeGenre('jpop')).toBe('j-pop')
  })

  it('normalises "japanese pop" → j-pop', () => {
    expect(normalizeGenre('japanese pop')).toBe('j-pop')
  })

  it('normalises rnb → r&b', () => {
    expect(normalizeGenre('rnb')).toBe('r&b')
  })

  it('normalises "hip hop" → hip-hop', () => {
    expect(normalizeGenre('hip hop')).toBe('hip-hop')
  })

  it('normalises "drum & bass" → drum and bass', () => {
    expect(normalizeGenre('drum & bass')).toBe('drum and bass')
  })

  it('normalises "lofi beats" → lo-fi', () => {
    expect(normalizeGenre('lofi beats')).toBe('lo-fi')
  })

  it('normalises "retrowave" → synthwave', () => {
    expect(normalizeGenre('retrowave')).toBe('synthwave')
  })

  it('strips trailing "music" noise word', () => {
    expect(normalizeGenre('indie music')).toBe('indie')
  })

  it('passes through unknown genres unchanged', () => {
    expect(normalizeGenre('bossa nova')).toBe('bossa nova')
  })

  it('lowercases everything', () => {
    expect(normalizeGenre('POP')).toBe('pop')
  })
})

// ─── Formatting helpers ───────────────────────────────────────────────────────

describe('fmtDuration', () => {
  it('formats minutes only', () => {
    expect(fmtDuration(3 * 60_000)).toBe('3m')
  })

  it('formats hours + minutes', () => {
    expect(fmtDuration(90 * 60_000)).toBe('1h 30m')
  })

  it('handles 0ms', () => {
    expect(fmtDuration(0)).toBe('0m')
  })
})

describe('fmtTempo', () => {
  it('rounds and appends BPM', () => {
    expect(fmtTempo(127.7)).toBe('128 BPM')
  })

  it('handles whole numbers', () => {
    expect(fmtTempo(120)).toBe('120 BPM')
  })
})
