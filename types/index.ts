// ─── Spotify API Types ────────────────────────────────────────────────────────
export interface SpotifyUser {
  id:           string
  display_name: string
  images:       Array<{ url: string; width: number; height: number }>
}

export interface SpotifyPlaylist {
  id:     string
  name:   string
  images: Array<{ url: string }>
  tracks: { total: number }
  owner:  { display_name: string }
}

export interface SpotifyTrack {
  id:           string
  name:         string
  popularity:   number
  duration_ms:  number
  artists:      Array<{ id: string; name: string }>
  album: {
    name:         string
    release_date: string
    images:       Array<{ url: string }>
  }
  external_urls: { spotify: string }
}

export interface SpotifyAudioFeatures {
  id:               string
  danceability:     number
  energy:           number
  valence:          number
  acousticness:     number
  instrumentalness: number
  liveness:         number
  speechiness:      number
  tempo:            number
  key:              number
  mode:             number
}

// ─── App Types ────────────────────────────────────────────────────────────────
export interface PlaylistPalette {
  primary:    string
  secondary:  string
  background: string
  detail:     string
}

export interface PlaylistAnalysis {
  playlistId:    string
  playlistName:  string
  coverUrl:      string
  palette:       PlaylistPalette | null
  tracks:        SpotifyTrack[]
  topArtists:    ArtistCount[]
  topGenres:     GenreCount[]
  audioFeatures: AudioProfile | null
  decades:       DecadeCount[]
  popBuckets:    PopBucket[]
  totalMs:       number
  avgPop:        number
  avgTrackMs:    number
  artistCount:   number
  vibe:          string | null
  cachedAt:      number
}

export interface ArtistCount {
  id:    string
  name:  string
  count: number
}

export interface GenreCount {
  genre: string
  count: number
}

export interface AudioProfile {
  danceability:     number
  energy:           number
  valence:          number
  acousticness:     number
  instrumentalness: number
  liveness:         number
  avgTempo:         number
}

export interface DecadeCount {
  label: string
  count: number
}

export interface PopBucket {
  label: string
  count: number
}

// ─── Taste Profile ────────────────────────────────────────────────────────────
export interface TasteProfile {
  version:       number
  name:          string
  trackCount:    number
  playlistCount: number
  vibe:          string | null
  topArtists:    ArtistCount[]
  topGenres:     GenreCount[]
  af:            AudioProfile | null
  generatedAt:   string
}

// ─── API State ────────────────────────────────────────────────────────────────
export type ApiStatus = 'idle' | 'cold-start' | 'loading' | 'success' | 'error' | 'retrying'

export interface ApiState<T> {
  status:  ApiStatus
  data:    T | null
  error:   string | null
  partial: Partial<T> | null  // for smart retry — what we have so far
}
