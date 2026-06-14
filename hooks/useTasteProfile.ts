import { useState, useCallback, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'
import { api } from '@/utils/api'
import { storage, CacheKeys } from '@/utils/cache'
import { buildAnalysis, computeVibe, computeVibeFromGenres, isPlaylistAnalysis } from '@/utils/analyze'
import type {
  SpotifyPlaylist, SpotifyTrack, SpotifyAudioFeatures,
  PlaylistAnalysis, TasteProfile, ArtistCount, GenreCount, AudioProfile,
} from '@/types'

const SHARE_CODE_KEY = 'taste_share_code'
const CACHE_TTL      = 24 * 60 * 60 * 1000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(nums: number[]) {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

function readCachedAnalyses(): PlaylistAnalysis[] {
  try {
    const allKeys = storage.getAllKeys()
    const out: PlaylistAnalysis[] = []
    for (const key of allKeys) {
      if (!key.startsWith('analysis:')) continue
      const raw = storage.getString(key)
      if (!raw) continue
      try {
        const { data, ts } = JSON.parse(raw)
        if (data && Date.now() - ts < CACHE_TTL) {
          // Self-heal: anything in `analysis:*` that isn't a real analysis (the
          // v1.3 raw-tracks poisoning) crashed aggregate() → taste gray-screen.
          if (isPlaylistAnalysis(data)) out.push(data)
          else storage.remove(key)
        }
      } catch {}
    }
    return out
  } catch {
    return []
  }
}

export function aggregate(analyses: PlaylistAnalysis[]): TasteProfile {
  const artistTally: Record<string, { name: string; count: number }> = {}
  const genreTally:  Record<string, number> = {}
  let trackCount = 0

  for (const a of analyses) {
    trackCount += a.tracks.length
    for (const art of a.topArtists) {
      if (!artistTally[art.id]) artistTally[art.id] = { name: art.name, count: 0 }
      artistTally[art.id].count += art.count
    }
    for (const g of a.topGenres) {
      genreTally[g.genre] = (genreTally[g.genre] || 0) + g.count
    }
  }

  // Distinct artists across every playlist's top-artist lists — a real number
  // for the "artists" stat, not the capped length of the list below.
  const artistCount = Object.keys(artistTally).length

  const topArtists: ArtistCount[] = Object.entries(artistTally)
    .map(([id, { name, count }]) => ({ id, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  const topGenres: GenreCount[] = Object.entries(genreTally)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16)

  const withAudio = analyses.filter(a => a.audioFeatures !== null)
  let af: AudioProfile | null = null
  if (withAudio.length > 0) {
    af = {
      danceability:     avg(withAudio.map(a => a.audioFeatures!.danceability)),
      energy:           avg(withAudio.map(a => a.audioFeatures!.energy)),
      valence:          avg(withAudio.map(a => a.audioFeatures!.valence)),
      acousticness:     avg(withAudio.map(a => a.audioFeatures!.acousticness)),
      instrumentalness: avg(withAudio.map(a => a.audioFeatures!.instrumentalness)),
      liveness:         avg(withAudio.map(a => a.audioFeatures!.liveness)),
      avgTempo:         avg(withAudio.map(a => a.audioFeatures!.avgTempo)),
    }
  }

  const vibe = af
    ? computeVibe(af)
    : computeVibeFromGenres(topGenres)

  return {
    version:       1,
    name:          '',
    trackCount,
    playlistCount: analyses.length,
    artistCount,
    vibe,
    topArtists,
    topGenres,
    af,
    generatedAt:   new Date().toISOString(),
  }
}

// Standalone analysis (no React state) for batch scan-all
async function analyzeRaw(
  playlistId:   string,
  playlistName: string,
  coverUrl:     string,
): Promise<PlaylistAnalysis | null> {
  const cacheKey = CacheKeys.playlistAnalysis(playlistId)

  // Cache hit
  const cached = storage.getString(cacheKey)
  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached)
      if (data && Date.now() - ts < CACHE_TTL) return data as PlaylistAnalysis
    } catch {}
  }

  try {
    const tracksRes = await api.get<{ items: Array<{ track: SpotifyTrack }> }>(
      `/api/playlist/${playlistId}/tracks`,
    )
    const tracks = tracksRes.items.map(i => i.track).filter(Boolean)
    if (tracks.length === 0) return null

    const artistFreq: Record<string, number> = {}
    for (const t of tracks) {
      for (const a of t.artists) {
        artistFreq[a.id] = (artistFreq[a.id] || 0) + 1
      }
    }
    const topArtistIds = Object.entries(artistFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(0, 50)

    const [artistRes, featureRes] = await Promise.all([
      api.get<{ artists: Array<{ id: string; genres: string[] }> }>(
        `/api/artists?ids=${topArtistIds.join(',')}`,
      ).catch(() => ({ artists: [] as Array<{ id: string; genres: string[] }> })),
      api.get<{ audio_features: SpotifyAudioFeatures[] }>(
        `/api/audio-features?ids=${tracks.slice(0, 100).map(t => t.id).join(',')}`,
      ).catch(() => ({ audio_features: [] as SpotifyAudioFeatures[] })),
    ])

    const genreMap: Record<string, string[]> = {}
    artistRes.artists.forEach(a => { genreMap[a.id] = a.genres || [] })
    const features = (featureRes.audio_features || []).filter(Boolean)

    const analysis = buildAnalysis(playlistId, playlistName, coverUrl, null, tracks, features, genreMap)
    storage.set(cacheKey, JSON.stringify({ data: analysis, ts: Date.now() }))
    return analysis
  } catch {
    return null
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'scanning' | 'saving' | 'loading-friend' | 'error'

export function useTasteProfile() {
  const [profile,       setProfile]       = useState<TasteProfile | null>(null)
  const [shareCode,     setShareCode]     = useState<string | null>(null)
  const [friendProfile, setFriendProfile] = useState<TasteProfile | null>(null)
  const [status,        setStatus]        = useState<Status>('idle')
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)
  const [scanProgress,  setScanProgress]  = useState({ done: 0, total: 0 })

  // Restore share code from secure storage on mount
  useEffect(() => {
    SecureStore.getItemAsync(SHARE_CODE_KEY).then(code => {
      if (code) setShareCode(code)
    }).catch(() => {})
  }, [])

  // Build profile from whatever analyses are already cached in MMKV
  const buildFromCache = useCallback(() => {
    const analyses = readCachedAnalyses()
    if (analyses.length === 0) {
      setProfile(null)
      return null
    }
    const built = aggregate(analyses)
    setProfile(built)
    return built
  }, [])

  // Scan uncached playlists then rebuild the aggregate profile
  const scanAll = useCallback(async (playlists: SpotifyPlaylist[]) => {
    setStatus('scanning')
    setErrorMsg(null)

    const toScan = playlists.filter(pl => {
      const raw = storage.getString(CacheKeys.playlistAnalysis(pl.id))
      if (!raw) return true
      try {
        const { ts } = JSON.parse(raw)
        return Date.now() - ts >= CACHE_TTL
      } catch { return true }
    })

    setScanProgress({ done: 0, total: toScan.length })

    let done = 0
    for (const pl of toScan) {
      await analyzeRaw(pl.id, pl.name, pl.images?.[0]?.url ?? '')
      done++
      setScanProgress({ done, total: toScan.length })
    }

    const analyses = readCachedAnalyses()
    const built    = aggregate(analyses)
    setProfile(built)
    setStatus('idle')
    return built
  }, [])

  // Save profile to backend → receive a shareable code
  const saveProfile = useCallback(async (built: TasteProfile) => {
    setStatus('saving')
    setErrorMsg(null)
    try {
      const res  = await api.post<{ code: string }>('/api/profile/save', built)
      const code = res.code
      await SecureStore.setItemAsync(SHARE_CODE_KEY, code)
      setShareCode(code)
      setStatus('idle')
      return code
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Failed to save profile.')
      setStatus('error')
      return null
    }
  }, [])

  // Load a friend's taste profile by share code
  const loadFriend = useCallback(async (code: string) => {
    setStatus('loading-friend')
    setFriendProfile(null)
    setErrorMsg(null)
    try {
      const res = await api.get<TasteProfile>(`/api/profile/load/${code.trim()}`)
      setFriendProfile(res)
      setStatus('idle')
      return res
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Profile not found. Check the code and try again.')
      setStatus('error')
      return null
    }
  }, [])

  return {
    profile,
    shareCode,
    friendProfile,
    status,
    errorMsg,
    scanProgress,
    buildFromCache,
    scanAll,
    saveProfile,
    loadFriend,
    setFriendProfile,
  }
}
