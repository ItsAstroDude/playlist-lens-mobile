import React, { useEffect, useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Colors } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { useMotionReduced } from '@/components/motion'
import { CameraRing } from './CameraRing'
import { toDp, panelScale, stadium } from './outline'
import { useRingProgress, type RingTrack } from './useRingProgress'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { usePalette } from '@/hooks/usePalette'
import { getCameraOutline } from '@/utils/settings'
import { emitOpenNowPlaying } from '@/utils/overlayEvents'
import { useLiveWindow } from '@/utils/liveWindow'

/**
 * Flip cover screen, over the whole app: the ring round the cameras shows the song's
 * progress in its cover's colours (it stands in for the now-playing pill there), and
 * a tap round the cameras opens Now Playing. Nothing is drawn when nothing plays.
 */
export function CoverRing() {
  const { width: W } = useLiveWindow()
  const reduced = useMotionReduced()
  const outline = useMemo(() => toDp(getCameraOutline(), panelScale(W)), [W])

  const { np } = useNowPlaying()
  const item = np?.item ?? null
  const track: RingTrack | null = item && item.duration_ms
    ? { id: item.id, playing: np!.is_playing, progressMs: np!.progress_ms ?? 0, durationMs: item.duration_ms, receivedAt: np!.receivedAt }
    : null
  const progress = useRingProgress(track, reduced)

  const art = item?.album?.images?.[0]?.url ?? null
  const { palettes, extract } = usePalette()
  const palKey = item?.id ? `np-${item.id}` : null
  useEffect(() => { if (palKey && art) extract(palKey, art) }, [palKey, art])
  const pal = palKey ? palettes[palKey] : undefined
  const colors: [string, string] = pal ? [pal.detail, pal.primary] : [Colors.greenPrimary, Colors.greenPrimary]

  if (!track) return null
  const hit = stadium(outline, 14)
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <CameraRing outline={outline} progress={progress} playing={track.playing} colors={colors} />
      <Pressable onPress={() => { haptic.light(); emitOpenNowPlaying() }}
        accessibilityRole="button" accessibilityLabel={`Now playing: ${item?.name ?? ''}. Open`}
        style={{ position: 'absolute', left: hit.left, top: hit.top, width: hit.width, height: hit.height, borderRadius: hit.R }} />
    </View>
  )
}
