import React, { useEffect, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, STAGGER_DELAY_MS, haptic } from '@/constants/animation'
import { getCache, CacheKeys } from '@/utils/cache'
import type { SpotifyPlaylist, PlaylistPalette, PlaylistAnalysis } from '@/types'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_H   = 188
const SIDE_PAD = Spacing.lg

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface PlaylistCardProps {
  playlist: SpotifyPlaylist
  palette:  PlaylistPalette | null
  index:    number
  onPress:  (playlist: SpotifyPlaylist) => void
}

export function PlaylistCard({ playlist, palette, index, onPress }: PlaylistCardProps) {
  const coverUrl = playlist.images?.[0]?.url

  // ── Check cache for a previously computed vibe label ──
  const cachedVibe = useMemo(() => {
    const cached = getCache<PlaylistAnalysis>(CacheKeys.playlistAnalysis(playlist.id))
    return cached?.vibe ?? null
  }, [playlist.id])

  // ── Staggered entrance ──
  const translateY = useSharedValue(32)
  const opacity    = useSharedValue(0)

  useEffect(() => {
    const delay = Math.min(index * STAGGER_DELAY_MS, 400)
    translateY.value = withDelay(delay, withSpring(0, Spring.entrance))
    opacity.value    = withDelay(delay, withTiming(1, { duration: 380 }))
  }, [])

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }))

  // ── Press scale ──
  const scale      = useSharedValue(1)
  const shadowAnim = useSharedValue(0.25)

  const pressStyle = useAnimatedStyle(() => ({
    transform:     [{ scale: scale.value }],
    shadowOpacity: shadowAnim.value,
  }))

  const handlePressIn  = () => {
    scale.value      = withSpring(0.97, Spring.snappy)
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

  // ── Dynamic palette ──
  const glowColor   = palette?.primary ?? Colors.greenPrimary
  const borderColor = palette ? `${palette.primary}40` : Colors.glassBorder

  return (
    <Animated.View style={[styles.wrapper, entranceStyle]}>
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[pressStyle, styles.card, { borderColor, shadowColor: glowColor }]}
      >
        {/* Cover art fills the card */}
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={300}
            recyclingKey={playlist.id}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.coverFallback]} />
        )}

        {/* Dark gradient: transparent top → near-black bottom */}
        <LinearGradient
          colors={['rgba(19,19,21,0.05)', 'rgba(19,19,21,0.92)']}
          locations={[0.3, 1.0]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Glass specular top border */}
        <View style={styles.specular} pointerEvents="none" />

        {/* Vibe badge — only if cached */}
        {cachedVibe && (
          <View style={[styles.vibeBadge, palette && { borderColor: `${palette.primary}50` }]}>
            <Text style={[styles.vibeText, palette && { color: palette.primary }]}>
              {cachedVibe}
            </Text>
          </View>
        )}

        {/* Bottom info */}
        <View style={styles.bottomInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {playlist.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{playlist.tracks.total} tracks</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{playlist.owner.display_name}</Text>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width:        SCREEN_W - SIDE_PAD * 2,
    height:       CARD_H,
    marginBottom: Spacing.md,
    alignSelf:    'center',
  },

  card: {
    flex:         1,
    borderRadius: Radius.xl,
    borderWidth:  1,
    overflow:     'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
  },

  coverFallback: {
    backgroundColor: Colors.card,
  },

  // 1px specular highlight across the very top of the card
  specular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: Colors.glassHighlight,
  },

  // Vibe badge — glass pill at top-left
  vibeBadge: {
    position:          'absolute',
    top:               Spacing.md,
    left:              Spacing.md,
    backgroundColor:   'rgba(0,0,0,0.45)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.18)',
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   3,
  },
  vibeText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.greenPrimary,
    letterSpacing: 0.5,
  },

  // Bottom info overlay
  bottomInfo: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    padding:  Spacing.md,
    gap:      3,
  },
  name: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize.lg,
    color:         Colors.text,
    letterSpacing: -0.5,
    lineHeight:    FontSize.lg * 1.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
  },
  metaText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },
  metaDot: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textDim,
  },
})
