import { useState, useCallback } from 'react'
import { api } from '@/utils/api'
import { getCache, setCache, CacheKeys } from '@/utils/cache'
import type {
  SpotifyPlaylist,
  SpotifyTrack,
  SpotifyAudioFeatures,
  ApiState,
} from '@/types'

// ─── Playlists ────────────────────────────────────────────────────────────────
export function usePlaylists() {
  const [state, setState] = useState<ApiState<SpotifyPlaylist[]>>({
    status: 'idle', data: null, error: null, partial: null,
  })

  const fetch = useCallback(async (opts?: { onColdStart?: () => void }) => {
    // Try cache first
    const cached = getCache<SpotifyPlaylist[]>(CacheKeys.playlists)
    if (cached) {
      setState({ status: 'success', data: cached, error: null, partial: null })
      return cached
    }

    setState(s => ({ ...s, status: 'loading' }))
    try {
      const res = await api.get<{ items: SpotifyPlaylist[] }>(
        '/api/playlists',
        { onColdStart: opts?.onColdStart }
      )
      const items = res.items || []
      setCache(CacheKeys.playlists, items)
      setState({ status: 'success', data: items, error: null, partial: null })
      return items
    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', error: err.message }))
      return null
    }
  }, [])

  // Drop a playlist that no longer exists on Spotify (404) — from state + cache.
  const removePlaylist = useCallback((id: string) => {
    setState(s => {
      if (!s.data) return s
      const next = s.data.filter(p => p.id !== id)
      setCache(CacheKeys.playlists, next)
      return { ...s, data: next }
    })
  }, [])

  return { ...state, fetch, removePlaylist }
}

// ─── Tracks ───────────────────────────────────────────────────────────────────
export function usePlaylistTracks() {
  const [state, setState] = useState<ApiState<SpotifyTrack[]>>({
    status: 'idle', data: null, error: null, partial: null,
  })

  const fetch = useCallback(async (
    plId: string,
    opts?: { onColdStart?: () => void; onRetry?: (n: number) => void }
  ) => {
    const cacheKey = CacheKeys.playlistTracks(plId)
    const cached = getCache<SpotifyTrack[]>(cacheKey)
    if (cached) {
      setState({ status: 'success', data: cached, error: null, partial: null })
      return cached
    }

    setState(s => ({ ...s, status: 'loading' }))
    try {
      const res = await api.get<{ items: Array<{ track: SpotifyTrack }> }>(
        `/api/playlist/${plId}/tracks`,
        { onColdStart: opts?.onColdStart, onRetry: opts?.onRetry }
      )
      const tracks = res.items.map(i => i.track).filter(Boolean)
      setCache(cacheKey, tracks)
      setState({ status: 'success', data: tracks, error: null, partial: null })
      return tracks
    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', error: err.message }))
      return null
    }
  }, [])

  return { ...state, fetch }
}

// ─── Audio Features ───────────────────────────────────────────────────────────
export function useAudioFeatures() {
  const fetch = useCallback(async (
    trackIds: string[],
    opts?: { onColdStart?: () => void }
  ): Promise<SpotifyAudioFeatures[] | null> => {
    try {
      const ids = trackIds.slice(0, 100).join(',')
      const res = await api.get<{ audio_features: SpotifyAudioFeatures[] }>(
        `/api/audio-features?ids=${ids}`,
        { onColdStart: opts?.onColdStart }
      )
      return (res.audio_features || []).filter(Boolean)
    } catch {
      return null
    }
  }, [])

  return { fetch }
}

// ─── Artists + Genres ─────────────────────────────────────────────────────────
export function useArtists() {
  const fetch = useCallback(async (
    artistIds: string[]
  ): Promise<Record<string, string[]> | null> => {
    try {
      const ids = artistIds.slice(0, 50).join(',')
      const res = await api.get<{ artists: Array<{ id: string; genres: string[] }> }>(
        `/api/artists?ids=${ids}`
      )
      const map: Record<string, string[]> = {}
      res.artists.forEach(a => { map[a.id] = a.genres || [] })
      return map
    } catch {
      return null
    }
  }, [])

  return { fetch }
}
