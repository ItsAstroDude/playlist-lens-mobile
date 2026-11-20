import React from 'react'
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
 */
export const ArtThumb = React.memo(function ArtThumb({ kind, name, artist, size = 30 }: {
  kind: ArtKind; name: string; artist?: string; size?: number
}) {
  const url = useArtwork(kind, name, artist)
  const shape = { width: size, height: size, borderRadius: kind === 'artist' ? size / 2 : Radius.sm }
  return (
    <View style={[styles.slot, shape]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {url
        ? <Image source={{ uri: url }} style={shape} contentFit="cover" transition={160} recyclingKey={url} />
        : <Icon name={GLYPH[kind]} size={Math.round(size * 0.45)} color={Colors.textMuted} />}
    </View>
  )
})

const styles = StyleSheet.create({
  slot: { backgroundColor: Colors.glass, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
})
