import React, { useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, STAGGER_DELAY_MS, haptic } from '@/constants/animation'
import type { SpotifyPlaylist, PlaylistPalette } from '@/types'

const { width: SCREEN_W } = Dimensions.get('window')
const COLUMN_GAP = Spacing.md
const SIDE_PAD   = Spacing.lg
const CARD_W     = (SCREEN_W - SIDE_PAD * 2 - COLUMN_GAP) / 2

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface PlaylistCardProps {
  playlist: SpotifyPlaylist
  palette:  PlaylistPalette | null
  index:    number
  onPress:  (playlist: SpotifyPlaylist) => void
}

export function PlaylistCard({ playlist, palette, index, onPress }: PlaylistCardProps) {
  const coverUrl = playlist.images?.[0]?.url

  // ── Staggered entrance ──
  const translateY = useSharedValue(28)
  const opacity    = useSharedValue(0)

  useEffect(() => {
    const delay = Math.min(index * STAGGER_DELAY_MS, 360)
    translateY.value = withDelay(delay, withSpring(0, Spring.entrance))
    opacity.value    = withDelay(delay, withTiming(1, { duration: 400 }))
  }, [])

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }))

  // ── Press scale + glow pulse ──
  const scale      = useSharedValue(1)
  const shadowAnim = useSharedValue(0.3)

  const pressStyle = useAnimatedStyle(() => ({
    transform:     [{ scale: scale.value }],
    shadowOpacity: shadowAnim.value,
    elevation:     shadowAnim.value * 28,
  }))

  const handlePressIn  = () => {
    scale.value      = withSpring(0.95, Spring.snappy)
    shadowAnim.value = withSpring(0.65, Spring.snappy)
  }
  const handlePressOut = () => {
    scale.value      = withSpring(1, Spring.snappy)
    shadowAnim.value = withSpring(0.3, Spring.snappy)
  }
  const handlePress = () => {
    haptic.medium()
    onPress(playlist)
  }

  // ── Dynamic palette ──
  const glowColor   = palette?.primary ?? Colors.green
  // Glass border is always the base "white glass edge"; palette tints are on the bg.
  const borderColor = palette ? `${palette.primary}50` : Colors.glassBorder
  const bgTint      = palette ? `${palette.primary}0E` : Colors.glass

  return (
    <Animated.View style={[styles.wrapper, entranceStyle]}>
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          pressStyle,
          styles.card,
          {
            borderColor,
            backgroundColor: bgTint,
            shadowColor:     glowColor,
          },
        ]}
      >
        {/* Cover art */}
        <View style={styles.imageWrap}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.image}
              contentFit="cover"
              transition={300}
              recyclingKey={playlist.id}
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.placeholderEmoji}>🎵</Text>
            </View>
          )}

          {/* Track count badge — glassy pill */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{playlist.tracks.total}</Text>
          </View>
        </View>

        {/* Glass specular line — simulates the reflective top edge of glass */}
        <View style={styles.specularLine} />

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text style={styles.owner} numberOfLines={1}>
            {playlist.owner.display_name}
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width:        CARD_W,
    marginBottom: COLUMN_GAP,
  },

  card: {
    borderRadius: Radius.lg,
    borderWidth:  1,
    overflow:     'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
  },

  // ── Image ──
  imageWrap: {
    position: 'relative',
  },
  image: {
    width:           '100%',
    aspectRatio:     1,
    borderTopLeftRadius:  Radius.lg - 1,
    borderTopRightRadius: Radius.lg - 1,
  },
  imagePlaceholder: {
    backgroundColor: Colors.card,
    alignItems:      'center',
    justifyContent:  'center',
  },
  placeholderEmoji: {
    fontSize: 32,
    opacity:  0.4,
  },

  // ── Glass specular highlight ──
  // This 1px line at the top of the info area sells the glass illusion —
  // it looks like light catching the edge of a frosted glass panel.
  specularLine: {
    height:          1,
    backgroundColor: Colors.glassHighlight,
  },

  // ── Badge ──
  badge: {
    position:          'absolute',
    bottom:            Spacing.xs,
    right:             Spacing.xs,
    backgroundColor:   'rgba(0,0,0,0.50)',
    borderWidth:       1,
    borderColor:       Colors.glassBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
    borderRadius:      Radius.sm,
  },
  badgeText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.xs,
    color:      Colors.text,
  },

  // ── Info ──
  info: {
    padding:       Spacing.sm,
    paddingBottom: Spacing.md,
    gap:           3,
  },
  name: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.base,
    color:         Colors.text,
    letterSpacing: -0.3,
  },
  owner: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },
})
