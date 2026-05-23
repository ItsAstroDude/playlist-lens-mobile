/**
 * Shared test fixtures — realistic mock data matching the actual TypeScript types.
 */
import type {
  SpotifyTrack, SpotifyAudioFeatures, PlaylistAnalysis,
  AudioProfile, ArtistCount, GenreCount,
} from '../types'

// ─── Track factory ────────────────────────────────────────────────────────────
export function makeTrack(overrides: Partial<SpotifyTrack> = {}): SpotifyTrack {
  return {
    id:          'track-1',
    name:        'Test Track',
    popularity:  70,
    duration_ms: 210_000,
    artists:     [{ id: 'artist-1', name: 'Test Artist' }],
    album: {
      name:         'Test Album',
      release_date: '2020-01-01',
      images:       [],
    },
    external_urls: { spotify: 'https://open.spotify.com/track/test' },
    ...overrides,
  }
}

// ─── Audio features factory ───────────────────────────────────────────────────
export function makeFeatures(overrides: Partial<SpotifyAudioFeatures> = {}): SpotifyAudioFeatures {
  return {
    id:               'track-1',
    danceability:     0.7,
    energy:           0.8,
    valence:          0.6,
    acousticness:     0.1,
    instrumentalness: 0.0,
    liveness:         0.2,
    speechiness:      0.05,
    tempo:            128,
    key:              5,
    mode:             1,
    ...overrides,
  }
}

// ─── AudioProfile factory (averaged, used in PlaylistAnalysis) ────────────────
export function makeAudioProfile(overrides: Partial<AudioProfile> = {}): AudioProfile {
  return {
    danceability:     0.7,
    energy:           0.8,
    valence:          0.6,
    acousticness:     0.1,
    instrumentalness: 0.0,
    liveness:         0.2,
    avgTempo:         128,
    ...overrides,
  }
}

// ─── PlaylistAnalysis factory ─────────────────────────────────────────────────
export function makeAnalysis(overrides: Partial<PlaylistAnalysis> = {}): PlaylistAnalysis {
  const tracks = [
    makeTrack({ id: 't1', artists: [{ id: 'a1', name: 'Artist A' }] }),
    makeTrack({ id: 't2', artists: [{ id: 'a1', name: 'Artist A' }] }),
    makeTrack({ id: 't3', artists: [{ id: 'a2', name: 'Artist B' }] }),
  ]
  return {
    playlistId:    'pl-1',
    playlistName:  'Test Playlist',
    coverUrl:      '',
    palette:       null,
    tracks,
    topArtists: [
      { id: 'a1', name: 'Artist A', count: 2 },
      { id: 'a2', name: 'Artist B', count: 1 },
    ],
    topGenres: [
      { genre: 'hip-hop', count: 4 },
      { genre: 'pop',     count: 2 },
    ],
    audioFeatures: makeAudioProfile(),
    decades:       [{ label: '2020s', count: 3 }],
    popBuckets:    [
      { label: '0–20',   count: 0 },
      { label: '21–40',  count: 0 },
      { label: '41–60',  count: 0 },
      { label: '61–80',  count: 3 },
      { label: '81–100', count: 0 },
    ],
    totalMs:    630_000,
    avgPop:     70,
    avgTrackMs: 210_000,
    artistCount: 2,
    vibe:       '💃 Made to move',
    cachedAt:   Date.now(),
    ...overrides,
  }
}
