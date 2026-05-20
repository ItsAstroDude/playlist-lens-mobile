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
  playlist:  SpotifyPlaylist
  palette:   PlaylistPalette | null
  index:     number
  onPress:   (playlist: SpotifyPlaylist) => void
}

export function PlaylistCard({ playlist, palette, index, onPress }: PlaylistCardProps) {
  const coverUrl = playlist.images?.[0]?.url

  // ── Staggered entrance ──
  const translateY = useSharedValue(24)
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

  // ── Press scale + glow ──
  const scale      = useSharedValue(1)
  const shadowAnim = useSharedValue(0.25)

  const pressStyle = useAnimatedStyle(() => ({
    transform:     [{ scale: scale.value }],
    shadowOpacity: shadowAnim.value,
    elevation:     shadowAnim.value * 24,
  }))

  const handlePressIn = () => {
    scale.value      = withSpring(0.95, Spring.snappy)
    shadowAnim.value = withSpring(0.55, Spring.snappy)
  }
  const handlePressOut = () => {
    scale.value      = withSpring(1, Spring.snappy)
    shadowAnim.value = withSpring(0.25, Spring.snappy)
  }
  const handlePress = () => {
    haptic.medium()
    onPress(playlist)
  }

  // ── Dynamic palette styling ──
  const glowColor   = palette?.primary || Colors.green
  const borderColor = palette ? `${palette.primary}55` : Colors.border
  const bgTint      = palette ? `${palette.primary}0A` : Colors.card

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
            shadowColor: glowColor,
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

          {/* Track count badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{playlist.tracks.total}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text style={styles.owner} numberOfLines={1}>
            {playlist.owner.display_name}
          </Text>
        </View>

        {/* Palette accent line at the bottom */}
        {palette && (
          <View
            style={[
              styles.accentLine,
              { backgroundColor: palette.primary },
            ]}
          />
        )}
      </AnimatedPressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width:  CARD_W,
    marginBottom: COLUMN_GAP,
  },

  card: {
    borderRadius:  Radius.lg,
    borderWidth:   1,
    overflow:      'hidden',
    shadowOffset:  { width: 0, height: 4 },
    shadowRadius:  12,
  },

  // ── Image ──
  imageWrap: {
    position: 'relative',
  },
  image: {
    width:  '100%',
    aspectRatio: 1,
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
    opacity:  0.5,
  },

  // ── Badge ──
  badge: {
    position:        'absolute',
    bottom:          Spacing.xs,
    right:           Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
    borderRadius:    Radius.sm,
  },
  badgeText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.xs,
    color:      Colors.text,
  },

  // ── Info ──
  info: {
    padding:       Spacing.sm,
    paddingBottom:  Spacing.md,
    gap:           2,
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

  // ── Accent line ──
  accentLine: {
    height: 2,
    width:  '100%',
  },
})
