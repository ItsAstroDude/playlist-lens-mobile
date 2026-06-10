import { useState, useEffect } from 'react'
import { storage } from '@/utils/cache'
import { artworkEnabled } from '@/utils/settings'

/**
 * Artwork lookup via the iTunes Search API — no auth, no backend, on-device.
 * Spotify's API can't give us images for export-only data, but iTunes matches
 * most music by name. Results are cached (memory + MMKV).
 *
 * We fetch several candidates and pick the one whose ARTIST actually matches —
 * taking iTunes' first hit blindly was assigning covers/tributes to the wrong
 * artist (e.g. Tyler, The Creator / Kendrick). Artist images fall back to a
 * representative song's cover.
 */
export type ArtKind = 'artist' | 'track' | 'album'

interface ItunesHit {
  artistName?: string
  trackName?:  string
  collectionName?: string
  artworkUrl100?: string
  artworkUrl60?:  string
}

const mem   = new Map<string, string | null>()
const ovMem = new Map<string, string>()
const REPORTS_KEY = 'art_reports'

export interface ArtCandidate {
  id:       string
  url:      string
  title:    string
  subtitle: string
}

function keyFor(kind: ArtKind, name: string, artist?: string) {
  return `art:${kind}:${name}:${artist ?? ''}`.toLowerCase()
}

function overrideKey(kind: ArtKind, name: string, artist?: string) {
  return `artov:${kind}:${name}:${artist ?? ''}`.toLowerCase()
}

function readOverride(ov: string): string | null {
  if (ovMem.has(ov)) return ovMem.get(ov)!
  const s = storage.getString(ov)
  if (s !== undefined) { ovMem.set(ov, s); return s }
  return null
}

function upscale(url: string): string {
  // iTunes returns 100x100; bump to a crisp 600x600.
  return url.replace(/\/\d+x\d+bb\./, '/600x600bb.')
}

/** Normalize a name for fuzzy comparison: lowercase, strip accents + punctuation. */
export function norm(s: string | undefined | null): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // drop diacritics
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function artistMatches(hit: ItunesHit, want: string): boolean {
  const a = norm(hit.artistName)
  const w = norm(want)
  if (!a || !w) return false
  return a === w || a.includes(w) || w.includes(a)
}

/**
 * Pure candidate-picker (exported for tests). Given iTunes results, choose the
 * artwork URL that best matches what we asked for, preferring an artist match.
 */
export function pickArtwork(
  results: ItunesHit[],
  kind: ArtKind,
  name: string,
  artist?: string,
): string | null {
  if (!results?.length) return null

  // Whose artist must match? For an artist lookup it's the name itself;
  // for track/album it's the supplied artist.
  const wantArtist = kind === 'artist' ? name : artist
  const pool = wantArtist
    ? results.filter(r => artistMatches(r, wantArtist))
    : results
  let candidates = pool.length ? pool : results

  // For tracks, among artist-matches prefer the one whose title matches too.
  if (kind === 'track' && pool.length) {
    const wantTitle = norm(name)
    const exact = pool.find(r => norm(r.trackName) === wantTitle)
    const partial = pool.find(r => norm(r.trackName).includes(wantTitle) || wantTitle.includes(norm(r.trackName)))
    if (exact) candidates = [exact]
    else if (partial) candidates = [partial]
  }

  const hit = candidates[0]
  const art = hit?.artworkUrl100 ?? hit?.artworkUrl60 ?? null
  return art ? upscale(art) : null
}

async function fetchArt(kind: ArtKind, name: string, artist?: string): Promise<string | null> {
  const entity = kind === 'album' ? 'album' : 'song'
  const term   = kind === 'artist' ? name : `${name} ${artist ?? ''}`.trim()
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&limit=8`
  try {
    const res  = await fetch(url)
    const json = await res.json()
    return pickArtwork(json?.results ?? [], kind, name, artist)
  } catch {
    return null
  }
}

export function useArtwork(kind: ArtKind | null, name?: string, artist?: string): string | null {
  const enabled = artworkEnabled()
  const k  = enabled && kind && name ? keyFor(kind, name, artist) : null
  const ov = enabled && kind && name ? overrideKey(kind, name, artist) : null
  const [url, setUrl] = useState<string | null>(() => {
    if (!k) return null
    if (ov) { const o = readOverride(ov); if (o != null) return o } // user pick wins
    if (mem.has(k)) return mem.get(k)!
    const cached = storage.getString(k)
    if (cached !== undefined) { mem.set(k, cached); return cached }
    return null
  })

  useEffect(() => {
    if (!k || !kind || !name) { setUrl(null); return }
    if (ov) { const o = readOverride(ov); if (o != null) { setUrl(o); return } }
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

/**
 * Fetch a list of cover candidates from iTunes so the user can pick the right
 * one themselves. `term` overrides the auto-built query (re-search box).
 */
export async function fetchArtworkCandidates(
  kind: ArtKind, name: string, artist?: string, term?: string,
): Promise<ArtCandidate[]> {
  const entity = kind === 'album' ? 'album' : 'song'
  const q = (term && term.trim()) || (kind === 'artist' ? name : `${name} ${artist ?? ''}`.trim())
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=${entity}&limit=20`
  try {
    const res  = await fetch(url)
    const json = await res.json()
    const seen = new Set<string>()
    const out: ArtCandidate[] = []
    for (const r of json?.results ?? []) {
      const raw = r.artworkUrl100 ?? r.artworkUrl60
      if (!raw) continue
      const big = upscale(raw)
      if (seen.has(big)) continue
      seen.add(big)
      out.push({
        id:       String(r.trackId ?? r.collectionId ?? big),
        url:      big,
        title:    r.trackName ?? r.collectionName ?? r.artistName ?? '—',
        subtitle: r.artistName ?? '',
      })
    }
    return out
  } catch {
    return []
  }
}

/**
 * Pin a cover the user chose (from candidates or their own upload). Stored as an
 * authoritative override (survives cache clears + report re-fetches) and primed
 * into the main cache so every surface shows it immediately.
 */
export function setArtworkOverride(kind: ArtKind, name: string, artist: string | undefined, url: string): void {
  const ov = overrideKey(kind, name, artist)
  ovMem.set(ov, url); storage.set(ov, url)
  const k = keyFor(kind, name, artist)
  mem.set(k, url); storage.set(k, url)
}

/**
 * User flagged the wrong cover. Drop the cached entry (so the improved matcher
 * re-resolves it next time) and log the report locally — a future backend drop
 * can collect these to build a manual override list.
 */
export function reportWrongArtwork(kind: ArtKind, name: string, artist: string | undefined, wrongUrl: string | null): void {
  const k = keyFor(kind, name, artist)
  mem.delete(k)
  storage.remove(k)
  try {
    const raw = storage.getString(REPORTS_KEY)
    const list = raw ? JSON.parse(raw) : []
    list.push({ kind, name, artist: artist ?? null, wrongUrl, at: new Date().toISOString() })
    storage.set(REPORTS_KEY, JSON.stringify(list.slice(-200))) // cap
  } catch { /* non-fatal */ }
}

export interface ArtReport { kind: ArtKind; name: string; artist: string | null; wrongUrl: string | null; at: string }

/** Read the locally-stored wrong-cover reports (newest first). No backend yet — device-only. */
export function loadArtReports(): ArtReport[] {
  try {
    const raw = storage.getString(REPORTS_KEY)
    const list = raw ? (JSON.parse(raw) as ArtReport[]) : []
    return list.slice().reverse()
  } catch {
    return []
  }
}

export function clearArtReports(): void {
  storage.remove(REPORTS_KEY)
}
