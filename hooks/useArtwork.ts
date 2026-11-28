import { useState, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'
import { storage, SecureKeys } from '@/utils/cache'
import { artworkEnabled } from '@/utils/settings'
import { BACKEND_URL } from '@/utils/api'
import { db } from '@/utils/playDb'

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
  // Artists get a ":v2" namespace so pre-"Faces & Facets" caches (which held an
  // album cover) are bypassed and re-resolved via the new Spotify-portrait lookup.
  // User overrides live under a separate key, so a pinned cover still wins.
  const v = kind === 'artist' ? ':v2' : ''
  return `art:${kind}${v}:${name}:${artist ?? ''}`.toLowerCase()
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

/**
 * Real artist portrait via the backend Spotify proxy (v1.3.1 "Faces & Facets").
 * iTunes only has song covers, so artist lookups used to show an album cover.
 * Spotify has actual artist photos. Plain fetch (not apiFetch) on purpose — a
 * transient 401 here should just fall back to iTunes, never trigger a logout.
 */
async function fetchSpotifyArtistImage(name: string): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(SecureKeys.accessToken)
    if (!token) return null
    const res = await fetch(`${BACKEND_URL}/api/artist-image?name=${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json && typeof json.image === 'string' ? json.image : null
  } catch {
    return null
  }
}

// iTunes Search allows roughly 20 requests a minute. Since 2.0.9 every top list shows
// artwork (~30 rows at once), so automatic lookups are spaced out — they fill in over a
// minute the first time and come from the cache ever after. User-started searches
// (fetchArtworkCandidates) don't wait, but still count.
const ITUNES_GAP_MS = 3100
let itunesNext = 0
/** A user-started search: goes now, and pushes the automatic queue back a gap. */
function itunesNow(): void { itunesNext = Date.now() + ITUNES_GAP_MS }
// Automatic lookups take turns. A turn is only spent if a row on screen still wants it:
// scrolling 30 rows away used to leave ~90 s of queue ahead of the rows you can see.
let itunesQueue: Promise<unknown> = Promise.resolve()
function itunesTurn(wanted: () => boolean): Promise<boolean> {
  const turn = itunesQueue.then(async () => {
    if (!wanted()) return false
    const wait = itunesNext - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    itunesNext = Date.now() + ITUNES_GAP_MS
    return true
  })
  itunesQueue = turn.catch(() => {})
  return turn
}

// How many mounted rows show each key (useArtwork): 0 = nobody is looking any more.
const watching = new Map<string, number>()
const watched = (k: string) => (watching.get(k) ?? 0) > 0

// One lookup per item at a time, however many rows ask for it.
const inflight = new Map<string, Promise<string | null>>()

// "No picture exists for this" is an answer too: saved for a while, so items iTunes
// can't match aren't looked up on every launch (holding up the queue for ones it can).
// Network errors and rate limits are NOT saved — those retry on the next launch.
const MISS_PREFIX = 'artmiss2:'   // v2 (2.0.16): misses from before the Spotify covers get retried
const MISS_TTL_MS = 14 * 86_400_000
function knownMiss(k: string): boolean {
  const at = storage.getNumber(MISS_PREFIX + k)
  return at !== undefined && Date.now() - at < MISS_TTL_MS
}

// ─── Spotify covers (2.0.16) ──────────────────────────────────────────────────
// iTunes doesn't carry a lot of what people play (indie / Vocaloid / SoundCloud-born
// releases), so those rows stayed blank. Every play we hold has its Spotify URI, and
// Spotify's public oEmbed endpoint returns that song's cover — exact, no login, no
// backend. Songs, albums (via one of their songs) and artists without a portrait (via
// one of their songs) try it before iTunes.

/** A Spotify track URI from the play database for this song / album / artist. */
function uriFor(kind: ArtKind, name: string, artist?: string): string | null {
  try {
    const d = db()
    const r = kind === 'track'
      ? d.getFirstSync<{ uri: string }>(`SELECT uri FROM plays WHERE artist IS ? AND track = ? AND uri LIKE 'spotify:track:%' LIMIT 1`, [artist ?? null, name])
        ?? d.getFirstSync<{ uri: string }>(`SELECT uri FROM plays WHERE track = ? AND uri LIKE 'spotify:track:%' LIMIT 1`, [name])
      : kind === 'album'
        ? d.getFirstSync<{ uri: string }>(`SELECT uri FROM plays WHERE album = ? AND uri LIKE 'spotify:track:%'${artist ? ' AND artist = ?' : ''} LIMIT 1`, artist ? [name, artist] : [name])
        : d.getFirstSync<{ uri: string }>(`SELECT uri FROM plays WHERE artist = ? AND uri LIKE 'spotify:track:%' LIMIT 1`, [name])
    return r?.uri ?? null
  } catch {
    return null
  }
}

/** The cover of a Spotify track (URI), or null. `final` = Spotify answered. */
async function spotifyCover(uri: string): Promise<{ url: string | null; final: boolean }> {
  const id = uri.slice('spotify:track:'.length)
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`)
    if (!res.ok) return { url: null, final: res.status === 404 }
    const json = await res.json()
    const url = typeof json?.thumbnail_url === 'string' ? json.thumbnail_url : null
    return { url, final: true }
  } catch {
    return { url: null, final: false }
  }
}

/** The cover, plus whether that's a real answer (`final`) or a failed lookup. */
async function fetchArt(kind: ArtKind, name: string, artist?: string, wanted: () => boolean = () => true): Promise<{ url: string | null; final: boolean; dropped?: boolean }> {
  // Artists: prefer a real Spotify portrait; then one of their songs' covers.
  if (kind === 'artist') {
    const portrait = await fetchSpotifyArtistImage(name)
    if (portrait) return { url: portrait, final: true }
  }
  const uri = uriFor(kind, name, artist)
  if (uri) {
    const sp = await spotifyCover(uri)
    if (sp.url) return sp
  }
  const entity = kind === 'album' ? 'album' : 'song'
  const term   = kind === 'artist' ? name : `${name} ${artist ?? ''}`.trim()
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&limit=8`
  try {
    if (!(await itunesTurn(wanted))) return { url: null, final: false, dropped: true }
    const res  = await fetch(url)
    if (!res.ok) return { url: null, final: false }          // rate-limited / server trouble
    const json = await res.json()
    return { url: pickArtwork(json?.results ?? [], kind, name, artist), final: true }
  } catch {
    return { url: null, final: false }                       // offline
  }
}

/** Test hook: forget this session's lookups (as if the app restarted). */
export function _resetArtworkSession(): void { mem.clear(); ovMem.clear(); inflight.clear(); watching.clear(); itunesNext = 0; itunesQueue = Promise.resolve() }

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
    if (knownMiss(k)) { mem.set(k, null); return null }
    return null
  })

  useEffect(() => {
    if (!k || !kind || !name) { setUrl(null); return }
    if (ov) { const o = readOverride(ov); if (o != null) { setUrl(o); return } }
    if (mem.has(k)) { setUrl(mem.get(k)!); return }
    if (knownMiss(k)) { mem.set(k, null); setUrl(null); return }
    let cancelled = false
    watching.set(k, (watching.get(k) ?? 0) + 1)
    let p = inflight.get(k)
    if (!p) {
      p = fetchArt(kind, name, artist, () => watched(k)).then(({ url: u, final, dropped }) => {
        if (dropped) return null                             // nobody looked: ask again next time it shows
        mem.set(k, u)                                        // this session: don't ask again
        if (u) storage.set(k, u)                             // found: kept for good
        else if (final) storage.set(MISS_PREFIX + k, Date.now())
        return u
      }).finally(() => inflight.delete(k))
      inflight.set(k, p)
    }
    p.then(u => { if (!cancelled) setUrl(u) })
    return () => {
      cancelled = true
      const n = (watching.get(k) ?? 1) - 1
      if (n > 0) watching.set(k, n); else watching.delete(k)
    }
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
    itunesNow()
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

// ─── Diagnostics (Labs › Covers check) ────────────────────────────────────────

/** How many covers are saved, remembered as "no picture", or pinned by hand. */
export function artworkCounts(): { cached: number; misses: number; overrides: number } {
  let cached = 0, misses = 0, overrides = 0
  try {
    for (const k of storage.getAllKeys()) {
      if (k.startsWith('art:')) cached++
      else if (k.startsWith(MISS_PREFIX)) misses++
      else if (k.startsWith('artov:')) overrides++
    }
  } catch { /* best effort */ }
  return { cached, misses, overrides }
}

/** Forget every remembered "no picture" so those covers are looked up again. */
export function forgetArtworkMisses(): number {
  let n = 0
  try {
    for (const k of storage.getAllKeys()) if (k.startsWith(MISS_PREFIX)) { storage.remove(k); n++ }
  } catch { /* best effort */ }
  for (const [k, v] of mem) if (v === null) mem.delete(k)
  return n
}

export interface ArtProbe { step: string; ok: boolean; detail: string }

async function timed(step: string, run: () => Promise<{ ok: boolean; detail: string }>): Promise<ArtProbe> {
  const t0 = Date.now()
  try {
    const r = await run()
    return { step, ok: r.ok, detail: `${r.detail} · ${Date.now() - t0} ms` }
  } catch (e) {
    return { step, ok: false, detail: `${e instanceof Error ? e.message : String(e)} · ${Date.now() - t0} ms` }
  }
}

/** Run each step of the cover lookup once, on this phone, and report what happened. */
export async function probeArtwork(): Promise<ArtProbe[]> {
  const out: ArtProbe[] = []
  out.push({ step: 'Artwork setting', ok: artworkEnabled(), detail: artworkEnabled() ? 'on' : 'OFF: covers are switched off in Settings' })

  let sample: { track: string; artist: string | null; uri: string } | null = null
  try {
    sample = db().getFirstSync<{ track: string; artist: string | null; uri: string }>(
      `SELECT track, artist, uri FROM plays WHERE uri LIKE 'spotify:track:%' AND track IS NOT NULL ORDER BY t DESC LIMIT 1`) ?? null
  } catch { /* no db */ }
  out.push({ step: 'Play database', ok: !!sample, detail: sample ? `latest: ${sample.track} · ${sample.artist ?? '?'}` : 'no plays with a Spotify ID' })

  out.push(await timed('Spotify cover', async () => {
    if (!sample) return { ok: false, detail: 'skipped (no sample song)' }
    const id = sample.uri.slice('spotify:track:'.length)
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`)
    const json = res.ok ? await res.json() : null
    return { ok: res.ok && typeof json?.thumbnail_url === 'string', detail: `HTTP ${res.status}${json?.thumbnail_url ? ', has cover' : ''}` }
  }))

  out.push(await timed('iTunes search', async () => {
    const term = sample ? `${sample.track} ${sample.artist ?? ''}`.trim() : 'Radiohead'
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=3`)
    const json = res.ok ? await res.json() : null
    return { ok: res.ok, detail: `HTTP ${res.status}${json ? `, ${json.resultCount ?? 0} results` : ''}` }
  }))

  out.push(await timed('Artist photos (your server)', async () => {
    const token = await SecureStore.getItemAsync(SecureKeys.accessToken)
    if (!token) return { ok: false, detail: 'not signed in' }
    const res = await fetch(`${BACKEND_URL}/api/artist-image?name=${encodeURIComponent(sample?.artist ?? 'Radiohead')}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return { ok: res.ok, detail: `HTTP ${res.status}` }
  }))

  out.push(await timed('Full lookup (sample song)', async () => {
    if (!sample) return { ok: false, detail: 'skipped (no sample song)' }
    const r = await fetchArt('track', sample.track, sample.artist ?? undefined)
    return { ok: !!r.url, detail: r.url ? 'found a cover' : r.final ? 'no cover exists' : 'lookup failed (network?)' }
  }))

  const c = artworkCounts()
  out.push({ step: 'Saved on this phone', ok: true, detail: `${c.cached} covers · ${c.misses} remembered as "no picture" · ${c.overrides} pinned` })
  return out
}
