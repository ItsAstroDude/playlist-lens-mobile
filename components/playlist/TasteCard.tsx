import React, { useCallback } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { ArtThumb } from '@/components/ui/ArtThumb'
import { Icon } from '@/components/ui/Icon'
import { aggregate, readCachedAnalyses } from '@/hooks/useTasteProfile'
import { useTastePreview } from '@/utils/tastePreview'

/**
 * Lenses' taste card (2.0.48). It used to be a fixed ad for the taste screen ("Aggregate
 * stats · share · compare friends"); now it's a glance at your taste itself: the faces
 * of your top artists across your lenses, how far it reaches, your top genres.
 */
export const TasteCard = React.memo(function TasteCard({ onPress }: { onPress: () => void }) {
  const build = useCallback(() => {
    const a = readCachedAnalyses()
    return a.length ? aggregate(a) : null
  }, [])
  const p = useTastePreview(build)

  const label = p
    ? `Your taste: ${p.lenses} lenses, ${p.artists.toLocaleString()} artists${p.topGenres.length ? `, mostly ${p.topGenres.slice(0, 2).join(' and ')}` : ''}`
    : 'Your taste profile'
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens your taste profile">
      <View style={styles.specular} />
      {p && p.topArtists.length ? (
        <View style={[styles.faces, { width: 34 + (p.topArtists.length - 1) * 22 }]} importantForAccessibility="no-hide-descendants">
          {p.topArtists.map((name, i) => (
            <View key={name} style={[styles.face, { left: i * 22, zIndex: 3 - i }]}>
              <ArtThumb kind="artist" name={name} size={34} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.iconWrap}><Icon name="aperture" size={20} color={Colors.greenPrimary} /></View>
      )}
      <View style={styles.text}>
        {p ? (
          <>
            <Text style={styles.title} numberOfLines={1}>
              Your taste <Text style={styles.count}>· {p.lenses} {p.lenses === 1 ? 'lens' : 'lenses'} · {p.artists.toLocaleString()} artists</Text>
            </Text>
            <Text style={styles.genres} numberOfLines={1}>
              {p.topGenres.length ? p.topGenres.join(' · ') : p.topArtists.slice(0, 2).join(' · ')}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Your taste profile</Text>
            <Text style={styles.sub} numberOfLines={1}>Open a few lenses and it builds itself</Text>
          </>
        )}
      </View>
      <Icon name="chevron-forward" size={16} color={Colors.greenPrimary} />
    </Pressable>
  )
})

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md + 2,
    backgroundColor: alpha(Colors.greenPrimary, 0.07),
    borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.28),
    borderRadius: Radius.lg, overflow: 'hidden',
  },
  pressed:  { opacity: 0.85, transform: [{ scale: 0.99 }] },
  specular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  faces:    { height: 34 },
  face:     { position: 'absolute', top: 0, borderRadius: 19, borderWidth: 2, borderColor: Colors.background, margin: -2 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(Colors.greenPrimary, 0.12) },
  text:     { flex: 1, minWidth: 0, gap: 3 },
  title:    { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  count:    { fontFamily: FontFamily.mono, color: Colors.textMuted },
  genres:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.greenPrimary },
  sub:      { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
})
