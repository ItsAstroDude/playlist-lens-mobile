import { useState, useCallback, useRef } from 'react'
import { getColors } from 'react-native-image-colors'
import { getCache, setCache, CacheKeys } from '@/utils/cache'
import { Colors } from '@/constants/theme'
import type { PlaylistPalette } from '@/types'

// ─── Fallback palette when extraction fails ───────────────────────────────────
const FALLBACK: PlaylistPalette = {
  primary:    Colors.green,
  secondary:  '#0a4023',
  background: Colors.background,
  detail:     Colors.green,
}

export function usePalette() {
  const [palettes, setPalettes] = useState<Record<string, PlaylistPalette>>({})
  // Ref-based dedup: avoids stale closure from useCallback([palettes])
  // so concurrent extractions don't all miss the in-memory check.
  const resolvedRef = useRef<Record<string, PlaylistPalette>>({})

  const extract = useCallback(async (
    playlistId: string,
    imageUrl: string
  ): Promise<PlaylistPalette> => {
    // Return from ref cache first — always current, no stale closure
    if (resolvedRef.current[playlistId]) return resolvedRef.current[playlistId]

    // Try MMKV cache
    const cached = getCache<PlaylistPalette>(CacheKeys.playlistPalette(playlistId))
    if (cached) {
      resolvedRef.current[playlistId] = cached
      setPalettes(prev => ({ ...prev, [playlistId]: cached }))
      return cached
    }

    if (!imageUrl) {
      resolvedRef.current[playlistId] = FALLBACK
      setPalettes(prev => ({ ...prev, [playlistId]: FALLBACK }))
      return FALLBACK
    }

    try {
      const result = await getColors(imageUrl, {
        fallback: Colors.green,
        cache: true,
        key: playlistId,
      })

      let palette: PlaylistPalette

      if (result.platform === 'android') {
        palette = {
          primary:    result.dominant     || Colors.green,
          secondary:  result.average      || '#0a4023',
          background: result.darkVibrant  || Colors.background,
          detail:     result.lightVibrant || Colors.green,
        }
      } else if (result.platform === 'ios') {
        palette = {
          primary:    result.primary    || Colors.green,
          secondary:  result.secondary  || '#0a4023',
          background: result.background || Colors.background,
          detail:     result.detail     || Colors.green,
        }
      } else {
        palette = FALLBACK
      }

      resolvedRef.current[playlistId] = palette
      setCache(CacheKeys.playlistPalette(playlistId), palette)
      setPalettes(prev => ({ ...prev, [playlistId]: palette }))
      return palette

    } catch {
      resolvedRef.current[playlistId] = FALLBACK
      setPalettes(prev => ({ ...prev, [playlistId]: FALLBACK }))
      return FALLBACK
    }
  }, []) // stable — ref handles dedup, no dep on palettes state

  return { palettes, extract }
}
