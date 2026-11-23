import { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking } from 'react-native'
import { haptic } from '@/constants/animation'
import { usePalette } from '@/hooks/usePalette'
import { activeThemeMode } from '@/constants/theme'
import { loadTrackIndex } from '@/hooks/useWrapped'
import type { TrackStat } from '@/utils/wrapped'
import { pokeNowPlaying, type NowPlaying } from '@/hooks/useNowPlaying'
import {
  resumePlayback, pausePlayback, skipNext, skipPrevious,
  classifyPlaybackError, transportErrorMessage, setPlaybackScopeMissing,
} from '@/utils/playback'
import { showToast } from '@/utils/dialog'

// The full per-track index is MBs of JSON — parse it once per session, on first
// open (NOT at startup). A fresh import during the same session shows up after
// the next app launch; acceptable for a stats peek.
let _index: TrackStat[] | null | undefined
function getIndex(): TrackStat[] | null {
  if (_index === undefined) _index = loadTrackIndex()
  return _index
}

export interface SongStats {
  imported: boolean
  stat: TrackStat | null
  rank: number | null
}

function findStats(uri: string | null, name: string, artists: string[]): SongStats {
  const index = getIndex()
  if (!index) return { imported: false, stat: null, rank: null }
  let i = uri ? index.findIndex(t => t.uri === uri) : -1
  if (i < 0) {
    const n = name.trim().toLowerCase()
    const a = (artists[0] ?? '').trim().toLowerCase()
    i = index.findIndex(t => t.name.trim().toLowerCase() === n && t.artist.trim().toLowerCase() === a)
  }
  return i >= 0 ? { imported: true, stat: index[i], rank: i + 1 } : { imported: true, stat: null, rank: null }
}

export function fmtClock(ms: number): string {
  const s = Math.max(Math.floor(ms / 1000), 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Everything a Now Playing view needs for the song playing right now: the live clock,
 * optimistic transport, your lifetime stats for it and the cover's colours. Shared by
 * the Now Playing sheet (normal + cover-screen layouts) and the half-folded tabletop view.
 *
 * `active` gates the per-second clock and the stats lookup (closed views do no work);
 * `withStats: false` skips the lookup altogether (the island: it parses MBs of history).
 */
export function useNowPlayingModel(np: NowPlaying | null, active: boolean, withStats = true) {
  const item = np?.item ?? null

  // Personal stats — resolved once per track while the view is up.
  const stats = useMemo(
    () => (item && active && withStats ? findStats(item.uri, item.name, item.artists) : null),
    [item?.uri, item?.name, active, withStats],
  )

  // Live mm:ss — ticks locally between polls (np.receivedAt anchors the clock).
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active || !np?.is_playing) return
    const t = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [active, np?.is_playing])

  const dur = item?.duration_ms ?? 0
  const liveMs = np
    ? Math.min((np.progress_ms ?? 0) + (np.is_playing ? Date.now() - np.receivedAt : 0), dur)
    : 0

  // Transport (v1.6) — optimistic play/pause + skip, re-synced by a poke. `override`
  // wins until the next poll lands (effect clears it when the server state changes).
  const [override, setOverride] = useState<boolean | null>(null)
  const [busy, setBusy]         = useState(false)
  const playing = override ?? (np?.is_playing ?? false)
  useEffect(() => { setOverride(null) }, [np?.is_playing, item?.uri])

  const control = useCallback(async (fn: () => Promise<void>, optimistic?: boolean) => {
    if (busy) return
    haptic.light()
    if (optimistic !== undefined) setOverride(optimistic)
    setBusy(true)
    try { await fn() } catch (err) {
      // Snap the optimistic state back now (don't wait for the poll) and say why.
      setOverride(null)
      haptic.warning()
      const kind = classifyPlaybackError(err)
      if (kind === 'scope') setPlaybackScopeMissing(true)
      showToast(transportErrorMessage(kind), 'alert-circle-outline')
    }
    setTimeout(() => { pokeNowPlaying(); setBusy(false) }, 500)
  }, [busy])
  const onPlayPause = () => (playing ? control(pausePlayback, false) : control(resumePlayback, true))
  const onNext = () => control(skipNext)
  const onPrev = () => control(skipPrevious)

  const onOpenSpotify = useCallback(async () => {
    if (!item?.uri) return
    haptic.light()
    const webUrl = item.id ? `https://open.spotify.com/track/${item.id}` : null
    try {
      await Linking.openURL(item.uri)        // spotify: scheme → the app
    } catch {
      if (webUrl) Linking.openURL(webUrl).catch(() => {})
    }
  }, [item?.uri, item?.id])

  const art = item?.album?.images?.[0]?.url ?? null
  const { palettes, extract } = usePalette()
  const palKey = item?.id ? `np-${item.id}` : null
  useEffect(() => { if (palKey && art) extract(palKey, art) }, [palKey, art])
  const pal = palKey ? palettes[palKey] : undefined
  // The aurora in the cover's colours (dark theme only).
  const auroraColors: [string, string, string, string] | null = pal && activeThemeMode() === 'dark'
    ? [pal.primary, pal.secondary, pal.detail, pal.background] : null
  const initial = (item?.name ?? '?').trim().charAt(0).toUpperCase()

  return {
    item, stats, dur, liveMs, playing, busy, art, pal, auroraColors, initial,
    onPlayPause, onNext, onPrev, onOpenSpotify,
  }
}
