// ─── Spotify API Types ────────────────────────────────────────────────────────
export interface SpotifyUser {
  id:           string
  display_name: string
  images:       Array<{ url: string; width: number; height: number }>
  // Subscription tier from GET /v1/me (needs user-read-private, which we hold).
  // 'premium' is required for v1.5 Custom Queues playback control.
  product?:     'premium' | 'free' | 'open'
}

export interface SpotifyPlaylist {
  id:     string
  name:   string
  images: Array<{ url: string }>
  tracks: { total: number }
  owner:  { display_name: string; id?: string }
  collaborative?: boolean   // collaborative playlists are also swipe-editable
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
  // Present in the raw Spotify payload all along — typed for swipe-refresh
  // (writes need uri, the preview resolver wants the ISRC).
  uri?:          string
  is_local?:     boolean
  external_ids?: { isrc?: string }
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
  artistCount?:  number   // distinct artists across all playlists (added in build 2)
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
