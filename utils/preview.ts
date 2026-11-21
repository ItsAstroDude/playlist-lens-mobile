/**
 * 30-second previews for any song we know by name (+ Spotify URI when we have it),
 * via the backend's /api/preview (Deezer → Spotify embed → iTunes). Session cache;
 * the backend caches for 30 minutes on top. Used by story mode's music.
 */
import { api } from '@/utils/api'

const cache = new Map<string, string | null>()

export interface PreviewSong { name: string; artist?: string; uri?: string | null }

export async function previewUrl(t: PreviewSong): Promise<string | null> {
  const id = t.uri?.startsWith('spotify:track:') ? t.uri.slice('spotify:track:'.length) : ''
  const key = id || `${t.artist ?? ''}|${t.name}`
  if (cache.has(key)) return cache.get(key) ?? null
  try {
    const qs = `title=${encodeURIComponent(t.name)}&artist=${encodeURIComponent(t.artist ?? '')}&track_id=${encodeURIComponent(id)}`
    const res = await api.get<{ preview_url: string | null }>(`/api/preview?${qs}`)
    cache.set(key, res.preview_url)
    return res.preview_url
  } catch {
    return null      // not cached: a transient failure can retry next time
  }
}
