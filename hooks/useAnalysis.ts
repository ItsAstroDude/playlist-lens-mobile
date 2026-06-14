import { useState, useCallback } from 'react'
import { api, ApiError } from '@/utils/api'
import { getCache, setCache, deleteCache, CacheKeys } from '@/utils/cache'
import { buildAnalysis, isPlaylistAnalysis } from '@/utils/analyze'
import type {
  SpotifyTrack,
  SpotifyAudioFeatures,
  PlaylistAnalysis,
  PlaylistPalette,
  ApiState,
} from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAnalysis() {
  const [state, setState] = useState<ApiState<PlaylistAnalysis>>({
    status: 'idle', data: null, error: null, partial: null,
  })

  const analyze = useCallback(async (
    playlistId:   string,
    playlistName: string,
    coverUrl:     string,
    palette:      PlaylistPalette | null,
    opts?:        { onColdStart?: () => void; onGone?: () => void },
  ) => {
    // MMKV cache hit — instant. Self-heal poisoned entries (see isPlaylistAnalysis).
    const cacheKey = CacheKeys.playlistAnalysis(playlistId)
    const cached   = getCache<PlaylistAnalysis>(cacheKey)
    if (cached && isPlaylistAnalysis(cached)) {
      setState({ status: 'success', data: cached, error: null, partial: null })
      return cached
    }
    if (cached) deleteCache(cacheKey)   // malformed — drop it and re-analyze

    setState({ status: 'loading', data: null, error: null, partial: null })

    try {
      // ── 1. Fetch all tracks (backend paginates up to 500) ──
      const tracksRes = await api.get<{ items: Array<{ track: SpotifyTrack }> }>(
        `/api/playlist/${playlistId}/tracks`,
        { onColdStart: opts?.onColdStart },
      )
      // Deleted/unfollowed on Spotify → backend returns no items. Treat as gone.
      if (!tracksRes || !Array.isArray(tracksRes.items)) throw new ApiError(404, 'PLAYLIST_GONE')
      const tracks = tracksRes.items.map(i => i.track).filter(Boolean)

      // ── 2. Rank artists by track count so genre lookup covers the most
      //       representative artists, not just the first 50 encountered ──
      const artistFreq: Record<string, number> = {}
      for (const track of tracks) {
        for (const artist of track.artists) {
          artistFreq[artist.id] = (artistFreq[artist.id] || 0) + 1
        }
      }
      const rankedArtistIds = Object.entries(artistFreq)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
        .slice(0, 150) // top 150 artists by frequency

      // ── 3. All unique track IDs (full playlist, not capped) ──
      const trackIds = [...new Set(tracks.map(t => t.id).filter(Boolean))]

      // ── 4. Batch audio features (100 per request) + artist genres (50 per
      //       request) in parallel — covers the full playlist accurately ──
      const featureChunks = chunkArray(trackIds,       100)
      const artistChunks  = chunkArray(rankedArtistIds, 50)

      const [featureResults, artistResults] = await Promise.all([
        Promise.all(
          featureChunks.map(chunk =>
            api.get<{ audio_features: SpotifyAudioFeatures[] }>(
              `/api/audio-features?ids=${chunk.join(',')}`,
            )
            .then(r => r.audio_features || [])
            .catch(() => [] as SpotifyAudioFeatures[]),
          ),
        ),
        Promise.all(
          artistChunks.map(chunk =>
            api.get<{ artists: Array<{ id: string; genres: string[] }> }>(
              `/api/artists?ids=${chunk.join(',')}`,
            )
            .then(r => r.artists || [])
            .catch(() => [] as Array<{ id: string; genres: string[] }>),
          ),
        ),
      ])

      const features = featureResults.flat().filter(Boolean)
      const genreMap: Record<string, string[]> = {}
      artistResults.flat().forEach(a => { genreMap[a.id] = a.genres || [] })

      // ── 5. Build analysis with complete data ──
      const analysis = buildAnalysis(
        playlistId, playlistName, coverUrl, palette,
        tracks, features, genreMap,
      )

      setCache(cacheKey, analysis)
      setState({ status: 'success', data: analysis, error: null, partial: null })
      return analysis

    } catch (err: any) {
      // Playlist no longer exists on Spotify → let the caller self-heal (remove it).
      if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
        opts?.onGone?.()
        setState(s => ({ ...s, status: 'error', error: 'This playlist no longer exists on Spotify.' }))
        return null
      }
      setState(s => ({ ...s, status: 'error', error: err.message ?? 'Analysis failed.' }))
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle', data: null, error: null, partial: null })
  }, [])

  return { ...state, analyze, reset }
}
