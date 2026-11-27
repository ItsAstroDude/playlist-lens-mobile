import { useCallback, useMemo } from 'react'
import { router } from 'expo-router'
import { haptic } from '@/constants/animation'
import { hasPlays, artistHref, songHref } from '@/utils/itemStats'

/**
 * Links from a playing song to its page and its artist's page (2.0.43), only when the
 * play database has plays of them. `go` runs `before` (close the player) and navigates.
 */
export function usePageLinks(track: string | null | undefined, artist: string | null | undefined, active: boolean, before?: () => void) {
  const has = useMemo(() => {
    if (!active || !track || !artist) return { song: false, artist: false }
    try {
      return { song: hasPlays({ kind: 'track', track, artist }), artist: hasPlays({ kind: 'artist', artist }) }
    } catch { return { song: false, artist: false } }   // no play database yet
  }, [active, track, artist])
  const go = useCallback((href: ReturnType<typeof artistHref> | ReturnType<typeof songHref>) => {
    haptic.light(); before?.(); router.push(href)
  }, [before])
  const openSong = has.song && track && artist ? () => go(songHref(track, artist)) : undefined
  const openArtist = has.artist && artist ? () => go(artistHref(artist)) : undefined
  return { openSong, openArtist }
}
