import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Colors, Spacing, Type, alpha } from '@/constants/theme'
import { Icon } from '@/components/ui/Icon'

/**
 * Design system — a track in a list: 40px cover, title, one line under it (artist,
 * or why it's suggested), and a trailing control (＋ / ✕ / drag handle).
 * Used by the queue, rediscovery shelves, the start-queue sheet and the song picker.
 */
export function TrackRow({ title, sub, image, trailing, accessibilityLabel }: {
  title:     string
  sub?:      string
  image?:    string | null
  trailing?: React.ReactNode
  accessibilityLabel?: string
}) {
  return (
    <View style={styles.row}>
      <View accessible accessibilityLabel={accessibilityLabel ?? [title, sub].filter(Boolean).join(', ')} style={styles.main}>
        {image
          ? <Image source={{ uri: image }} style={styles.cover} contentFit="cover" transition={120} cachePolicy="memory-disk" />
          : <View style={[styles.cover, styles.coverEmpty]}><Icon name="musical-note" size={16} color={Colors.textMuted} /></View>}
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
      </View>
      {trailing}
    </View>
  )
}

const styles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 6 },
  main:       { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cover:      { width: 40, height: 40, borderRadius: 8 },
  coverEmpty: { backgroundColor: alpha(Colors.text, 0.06), alignItems: 'center', justifyContent: 'center' },
  text:       { flex: 1, minWidth: 0, gap: 2 },
  title:      { ...Type.label, fontSize: 12 },
  sub:        Type.caption,
})
