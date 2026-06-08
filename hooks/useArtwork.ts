import { useState, useEffect } from 'react'
import { storage } from '@/utils/cache'

/**
 * Artwork lookup via the iTunes Search API — no auth, no backend, on-device.
 * Spotify's API can't give us images for export-only data, but iTunes matches
 * most music by name. Results are cached (memory + MMKV). Artist images fall
 * back to a representative song's cover.
 */
export type ArtKind = 'artist' | 'track' | 'album'

const mem = new Map<string, string | null>()

function keyFor(kind: ArtKind, name: string, artist?: string) {
  return `art:${kind}:${name}:${artist ?? ''}`.toLowerCase()
}

function upscale(url: string): string {
  // iTunes returns 100x100; bump to a crisp 600x600.
  return url.replace(/\/\d+x\d+bb\./, '/600x600bb.')
}

async function fetchArt(kind: ArtKind, name: string, artist?: string): Promise<string | null> {
  const entity = kind === 'album' ? 'album' : 'song'
  const term   = kind === 'artist' ? name : `${name} ${artist ?? ''}`.trim()
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&limit=1`
  try {
    const res  = await fetch(url)
    const json = await res.json()
    const hit  = json?.results?.[0]
    const art  = hit?.artworkUrl100 ?? hit?.artworkUrl60 ?? null
    return art ? upscale(art) : null
  } catch {
    return null
  }
}

export function useArtwork(kind: ArtKind | null, name?: string, artist?: string): string | null {
  const k = kind && name ? keyFor(kind, name, artist) : null
  const [url, setUrl] = useState<string | null>(() => {
    if (!k) return null
    if (mem.has(k)) return mem.get(k)!
    const cached = storage.getString(k)
    if (cached !== undefined) { mem.set(k, cached); return cached }
    return null
  })

  useEffect(() => {
    if (!k || !kind || !name) { setUrl(null); return }
    if (mem.has(k)) { setUrl(mem.get(k)!); return }
    let cancelled = false
    fetchArt(kind, name, artist).then(u => {
      mem.set(k, u)
      if (u) storage.set(k, u)
      if (!cancelled) setUrl(u)
    })
    return () => { cancelled = true }
  }, [k])

  return url
}
