/**
 * Tests for the taste profile aggregation logic (hooks/useTasteProfile.ts).
 *
 * We test the exported `aggregate` function directly — no hooks, no React,
 * no backend calls needed. If these fail, the Taste Profile tab will show
 * wrong data.
 */
import { aggregate } from '../hooks/useTasteProfile'
import { makeAnalysis, makeAudioProfile } from './fixtures'
import type { PlaylistAnalysis } from '../types'

describe('aggregate', () => {

  // ─── Artist tallying ────────────────────────────────────────────────────────

  it('sums artist counts across playlists', () => {
    const a = makeAnalysis({
      playlistId: 'pl-1',
      topArtists: [{ id: 'a1', name: 'Drake', count: 5 }],
    })
    const b = makeAnalysis({
      playlistId: 'pl-2',
      topArtists: [{ id: 'a1', name: 'Drake', count: 3 }, { id: 'a2', name: 'Kendrick', count: 2 }],
    })

    const result = aggregate([a, b])
    const drake = result.topArtists.find(x => x.id === 'a1')
    expect(drake?.count).toBe(8)
  })

  it('sorts top artists by combined count descending', () => {
    const a = makeAnalysis({
      playlistId: 'pl-1',
      topArtists: [
        { id: 'a1', name: 'Small', count: 1 },
        { id: 'a2', name: 'Big',   count: 10 },
      ],
    })

    const result = aggregate([a])
    expect(result.topArtists[0].id).toBe('a2')
  })

  it('caps topArtists at 12', () => {
    const artists = Array.from({ length: 20 }, (_, i) => ({
      id: `a${i}`, name: `Artist ${i}`, count: 1,
    }))
    const a = makeAnalysis({ playlistId: 'pl-1', topArtists: artists })

    const result = aggregate([a])
    expect(result.topArtists.length).toBeLessThanOrEqual(12)
  })

  // ─── Genre tallying ──────────────────────────────────────────────────────────

  it('sums genre counts across playlists', () => {
    const a = makeAnalysis({
      playlistId: 'pl-1',
      topGenres:  [{ genre: 'hip-hop', count: 6 }, { genre: 'pop', count: 2 }],
    })
    const b = makeAnalysis({
      playlistId: 'pl-2',
      topGenres:  [{ genre: 'hip-hop', count: 4 }, { genre: 'r&b', count: 3 }],
    })

    const result = aggregate([a, b])
    const hipHop = result.topGenres.find(g => g.genre === 'hip-hop')
    expect(hipHop?.count).toBe(10)
  })

  it('caps topGenres at 16', () => {
    const genres = Array.from({ length: 25 }, (_, i) => ({ genre: `genre-${i}`, count: 1 }))
    const a = makeAnalysis({ playlistId: 'pl-1', topGenres: genres })

    const result = aggregate([a])
    expect(result.topGenres.length).toBeLessThanOrEqual(16)
  })

  // ─── Track + playlist count ──────────────────────────────────────────────────

  it('sums trackCount from all analyses', () => {
    const a = makeAnalysis({ playlistId: 'pl-1', tracks: Array(10).fill(null).map((_, i) => ({ id: `t${i}`, name: '', popularity: 0, duration_ms: 0, artists: [{ id: 'a', name: 'A' }], album: { name: '', release_date: '2020-01-01', images: [] }, external_urls: { spotify: '' } })) })
    const b = makeAnalysis({ playlistId: 'pl-2', tracks: Array(5).fill(null).map((_, i) => ({ id: `u${i}`, name: '', popularity: 0, duration_ms: 0, artists: [{ id: 'b', name: 'B' }], album: { name: '', release_date: '2020-01-01', images: [] }, external_urls: { spotify: '' } })) })

    const result = aggregate([a, b])
    expect(result.trackCount).toBe(15)
    expect(result.playlistCount).toBe(2)
  })

  // ─── Audio feature averaging ─────────────────────────────────────────────────

  it('averages audio features across playlists that have them', () => {
    const a = makeAnalysis({
      playlistId:    'pl-1',
      audioFeatures: makeAudioProfile({ energy: 0.4, danceability: 0.6 }),
    })
    const b = makeAnalysis({
      playlistId:    'pl-2',
      audioFeatures: makeAudioProfile({ energy: 0.8, danceability: 0.2 }),
    })

    const result = aggregate([a, b])
    expect(result.af?.energy).toBeCloseTo(0.6)
    expect(result.af?.danceability).toBeCloseTo(0.4)
  })

  it('excludes playlists without audio features from the average', () => {
    const withAudio = makeAnalysis({
      playlistId:    'pl-1',
      audioFeatures: makeAudioProfile({ energy: 0.8 }),
    })
    const noAudio = makeAnalysis({
      playlistId:    'pl-2',
      audioFeatures: null,
    })

    const result = aggregate([withAudio, noAudio])
    // Average should only come from the one playlist that has features
    expect(result.af?.energy).toBeCloseTo(0.8)
  })

  it('returns null af when no playlist has audio features', () => {
    const a = makeAnalysis({ playlistId: 'pl-1', audioFeatures: null })
    const b = makeAnalysis({ playlistId: 'pl-2', audioFeatures: null })

    const result = aggregate([a, b])
    expect(result.af).toBeNull()
  })

  // ─── Vibe computation ────────────────────────────────────────────────────────

  it('returns a vibe string when audio features are present', () => {
    const result = aggregate([makeAnalysis()])
    expect(typeof result.vibe).toBe('string')
    expect(result.vibe!.length).toBeGreaterThan(0)
  })

  it('falls back to genre-based vibe when no audio features', () => {
    const a = makeAnalysis({
      audioFeatures: null,
      topGenres:     [{ genre: 'hip-hop', count: 10 }],
    })
    const result = aggregate([a])
    // Should still produce a vibe from genres
    expect(result.vibe).toBeTruthy()
  })

  // ─── Edge cases ──────────────────────────────────────────────────────────────

  it('handles a single analysis without throwing', () => {
    expect(() => aggregate([makeAnalysis()])).not.toThrow()
  })

  it('handles an empty array without throwing', () => {
    const result = aggregate([])
    expect(result.playlistCount).toBe(0)
    expect(result.trackCount).toBe(0)
    expect(result.topArtists).toHaveLength(0)
    expect(result.topGenres).toHaveLength(0)
    expect(result.af).toBeNull()
  })

  it('handles analyses with empty artist/genre lists', () => {
    const a = makeAnalysis({ topArtists: [], topGenres: [] })
    expect(() => aggregate([a])).not.toThrow()
  })
})
