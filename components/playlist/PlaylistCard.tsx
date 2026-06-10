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
import { vibeColor } from '@/utils/color'
import type { SpotifyPlaylist, PlaylistPalette, PlaylistAnalysis } from '@/types'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_H   = 188
const SIDE_PAD = Spacing.lg
// Grid layout: two square cards per row. Cells are SCREEN_W/2 wide, so each card
// hugs its outer edge (via alignSelf per column) to keep margins symmetric.
const GRID_GAP = Spacing.md
const GRID_W   = (SCREEN_W - SIDE_PAD * 2 - GRID_GAP) / 2

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface PlaylistCardProps {
  playlist:      SpotifyPlaylist
  palette:       PlaylistPalette | null
  index:         number
  onPress:       (playlist: SpotifyPlaylist) => void
  onLongPress?:  (playlist: SpotifyPlaylist) => void
  /** 'full' (default) = full-width 188dp card · 'grid' = square 2-column card */
  layout?:       'full' | 'grid'
}

export function PlaylistCard({ playlist, palette, index, onPress, onLongPress, layout = 'full' }: PlaylistCardProps) {
  const grid = layout === 'grid'
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
  const handleLongPress = () => {
    if (!onLongPress) return
    haptic.heavy()
    onLongPress(playlist)
  }

  // ── Dynamic palette ──
  const glowColor   = palette?.primary ?? Colors.greenPrimary
  const borderColor = palette ? `${palette.primary}40` : Colors.glassBorder

  // In grid mode the FlashList cell is half the screen; pin left-column cards to
  // the cell's right edge and right-column cards to the left so outer margins
  // stay SIDE_PAD and the inner gap stays GRID_GAP.
  const gridPos = grid
    ? (index % 2 === 0
        ? { alignSelf: 'flex-end'   as const, marginRight: GRID_GAP / 2 }
        : { alignSelf: 'flex-start' as const, marginLeft:  GRID_GAP / 2 })
    : null

  return (
    <Animated.View style={[grid ? styles.wrapperGrid : styles.wrapper, gridPos, entranceStyle]}>
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
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

        {/* Vibe badge — only if cached. Colour reflects the vibe, not the cover,
            and rides on a dark scrim so it stays legible over bright artwork. */}
        {cachedVibe && (
          <View style={[styles.vibeBadge, { borderColor: `${vibeColor(cachedVibe)}55` }]}>
            <Text style={[styles.vibeText, { color: vibeColor(cachedVibe) }]}>
              {cachedVibe}
            </Text>
          </View>
        )}

        {/* Bottom info — grid cards drop the owner to fit the narrow width */}
        <View style={styles.bottomInfo}>
          <Text style={grid ? styles.nameGrid : styles.name} numberOfLines={1}>
            {playlist.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{playlist.tracks.total} tracks</Text>
            {!grid && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{playlist.owner.display_name}</Text>
              </>
            )}
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
  wrapperGrid: {
    width:        GRID_W,
    height:       GRID_W,   // square — cover art is square
    marginBottom: Spacing.md,
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
    backgroundColor:   'rgba(0,0,0,0.62)',
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
  nameGrid: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize.base,
    color:         Colors.text,
    letterSpacing: -0.3,
    lineHeight:    FontSize.base * 1.2,
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
