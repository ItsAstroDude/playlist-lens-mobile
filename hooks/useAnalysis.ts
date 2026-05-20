import { useState, useCallback } from 'react'
import { api } from '@/utils/api'
import { getCache, setCache, CacheKeys } from '@/utils/cache'
import { buildAnalysis } from '@/utils/analyze'
import type {
  SpotifyTrack,
  SpotifyAudioFeatures,
  PlaylistAnalysis,
  PlaylistPalette,
  ApiState,
} from '@/types'

export function useAnalysis() {
  const [state, setState] = useState<ApiState<PlaylistAnalysis>>({
    status: 'idle', data: null, error: null, partial: null,
  })

  const analyze = useCallback(async (
    playlistId:   string,
    playlistName: string,
    coverUrl:     string,
    palette:      PlaylistPalette | null,
    opts?:        { onColdStart?: () => void },
  ) => {
    // MMKV cache hit — instant
    const cacheKey = CacheKeys.playlistAnalysis(playlistId)
    const cached   = getCache<PlaylistAnalysis>(cacheKey)
    if (cached) {
      setState({ status: 'success', data: cached, error: null, partial: null })
      return cached
    }

    setState({ status: 'loading', data: null, error: null, partial: null })

    try {
      // 1. Fetch all tracks (backend handles pagination up to 500)
      const tracksRes = await api.get<{ items: Array<{ track: SpotifyTrack }> }>(
        `/api/playlist/${playlistId}/tracks`,
        { onColdStart: opts?.onColdStart },
      )
      const tracks = tracksRes.items.map(i => i.track).filter(Boolean)

      // 2. Parallel: audio features (max 100) + artist genres (max 50)
      const trackIds  = [...new Set(tracks.map(t => t.id).filter(Boolean))].slice(0, 100)
      const artistIds = [...new Set(tracks.flatMap(t => t.artists.map(a => a.id)))].slice(0, 50)

      const [featuresRes, artistsRes] = await Promise.all([
        trackIds.length > 0
          ? api.get<{ audio_features: SpotifyAudioFeatures[] }>(
              `/api/audio-features?ids=${trackIds.join(',')}`,
            )
          : Promise.resolve({ audio_features: [] as SpotifyAudioFeatures[] }),
        artistIds.length > 0
          ? api.get<{ artists: Array<{ id: string; genres: string[] }> }>(
              `/api/artists?ids=${artistIds.join(',')}`,
            )
          : Promise.resolve({ artists: [] as Array<{ id: string; genres: string[] }> }),
      ])

      const features = (featuresRes.audio_features || []).filter(Boolean)
      const genreMap: Record<string, string[]> = {}
      ;(artistsRes.artists || []).forEach(a => { genreMap[a.id] = a.genres || [] })

      const analysis = buildAnalysis(
        playlistId, playlistName, coverUrl, palette,
        tracks, features, genreMap,
      )

      setCache(cacheKey, analysis)
      setState({ status: 'success', data: analysis, error: null, partial: null })
      return analysis

    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', error: err.message ?? 'Analysis failed.' }))
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle', data: null, error: null, partial: null })
  }, [])

  return { ...state, analyze, reset }
}
