import React, { useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Colors, Radius } from '@/constants/theme'
import { useArtwork, type ArtKind } from '@/hooks/useArtwork'
import { Icon } from './Icon'

const GLYPH = { artist: 'person', track: 'musical-note', album: 'disc' } as const

/**
 * Design system — a small cover for list rows: an artist photo (round) or a song /
 * album cover (rounded square). The slot is always there, so rows don't shift when
 * the picture arrives. Follows the Settings › artwork switch (useArtwork).
 *
 * Caching: the cover's address is saved for good once found (useArtwork), and the
 * picture itself is kept in memory and on disk (`memory-disk`), so a list you've
 * seen before shows its covers immediately, without fetching or fading.
 */
export const ArtThumb = React.memo(function ArtThumb({ kind, name, artist, size = 30 }: {
  kind: ArtKind; name: string; artist?: string; size?: number
}) {
  const url = useArtwork(kind, name, artist)
  // Saved covers show on the first frame, no fade: only a cover that arrives while
  // you're looking (a first-time lookup) fades in.
  const atMount = useRef(url)
  const fade = url !== atMount.current ? 160 : 0
  const shape = { width: size, height: size, borderRadius: kind === 'artist' ? size / 2 : Radius.sm }
  return (
    <View style={[styles.slot, shape]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {url
        ? <Image source={{ uri: url }} style={shape} contentFit="cover" transition={fade} recyclingKey={url} cachePolicy="memory-disk" />
        : <Icon name={GLYPH[kind]} size={Math.round(size * 0.45)} color={Colors.textMuted} />}
    </View>
  )
})

const styles = StyleSheet.create({
  slot: { backgroundColor: Colors.glass, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
})
