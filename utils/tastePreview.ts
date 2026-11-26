/**
 * The Lenses taste card (2.0.48): a few facts from your taste profile, saved small so the
 * card shows them on the first frame (the full profile means parsing every analysed
 * playlist). Saved whenever the taste screen builds the profile, and refreshed quietly
 * after Lenses has settled when your analyses have changed.
 */
import { useEffect, useState } from 'react'
import { InteractionManager } from 'react-native'
import { storage } from '@/utils/cache'
import type { TasteProfile } from '@/types'

export interface TastePreview {
  lenses:  number
  artists: number
  tracks:  number
  /** Top artists across your lenses, most songs first. */
  topArtists: string[]
  topGenres:  string[]
  vibe: string | null
  /** Which analyses it was built from (count + newest), to know when it's stale. */
  sig: string
}

const KEY = 'taste.preview.v1'
const subs = new Set<(p: TastePreview | null) => void>()

export function previewOf(p: TasteProfile, sig = ''): TastePreview {
  return {
    lenses: p.playlistCount,
    artists: p.artistCount ?? p.topArtists.length,
    tracks: p.trackCount,
    topArtists: p.topArtists.slice(0, 3).map(a => a.name),
    topGenres: p.topGenres.slice(0, 3).map(g => g.genre),
    vibe: p.vibe,
    sig,
  }
}

export function readTastePreview(): TastePreview | null {
  try {
    const v = JSON.parse(storage.getString(KEY) ?? 'null')
    return v && typeof v.lenses === 'number' && Array.isArray(v.topArtists) ? v as TastePreview : null
  } catch { return null }
}

/** Which analyses exist (names only; no parsing). Changes when a lens is analysed or dropped. */
export function analysesSignature(keys: string[]): string {
  const ids = keys.filter(k => k.startsWith('analysis:')).sort()
  let h = 0
  for (const k of ids) for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0
  return `${ids.length}:${h}`
}

export function saveTastePreview(p: TasteProfile | null): void {
  let sig = ''
  try { sig = analysesSignature(storage.getAllKeys()) } catch { /* keep it empty */ }
  const v = p && p.playlistCount > 0 ? previewOf(p, sig) : null
  try { if (v) storage.set(KEY, JSON.stringify(v)); else storage.remove(KEY) } catch { /* best effort */ }
  subs.forEach(cb => cb(v))
}

/**
 * The saved preview straight away; after the screen has settled, rebuilt from your
 * analyses if they've changed since (`build` = the taste profile's aggregate).
 */
export function useTastePreview(build: () => TasteProfile | null): TastePreview | null {
  const [v, setV] = useState<TastePreview | null>(readTastePreview)
  useEffect(() => {
    subs.add(setV)
    const task = InteractionManager.runAfterInteractions(() => {
      let sig = ''
      try { sig = analysesSignature(storage.getAllKeys()) } catch { return }
      if (readTastePreview()?.sig === sig) return
      try { saveTastePreview(build()) } catch { /* keep what's shown */ }
    })
    return () => { subs.delete(setV); task.cancel() }
  }, [])
  return v
}
