import React, { useEffect, useMemo, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native'
import { isCoverWindow } from '@/hooks/useCoverScreen'
import { BENTO_GAP, BENTO_PAD, bentoSizes } from '@/utils/bento'
import { Image } from 'expo-image'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { Colors, Spacing, Type, alpha } from '@/constants/theme'
import { Spring, STAGGER_DELAY_MS, haptic } from '@/constants/animation'
import { getCache, CacheKeys } from '@/utils/cache'
import { vibeColor } from '@/utils/color'
import { reduceMotionEnabled } from '@/utils/settings'
import type { SpotifyPlaylist, PlaylistPalette, PlaylistAnalysis } from '@/types'
import { useLiveWindow } from '@/utils/liveWindow'

const { width: SCREEN_W } = Dimensions.get('window')
const SIDE_PAD = Spacing.lg
// 2.0 Liquid: playlists are frosted-glass tiles with the cover inset and the words
// underneath (grid) or beside it (list) — no text printed over the artwork.
export const GRID_GAP = Spacing.md
/** Grid tile width for a window this wide. GRID_W = at launch (skeletons). */
export const gridWidth = (windowW: number) => (windowW - SIDE_PAD * 2 - GRID_GAP) / 2
export const GRID_W   = gridWidth(SCREEN_W)
const TILE_PAD  = 8
const ROW_COVER = 92
/** Corner radius of the inset cover (the open transition starts from it). */
export const COVER_RADIUS = 20

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface PlaylistCardProps {
  playlist:      SpotifyPlaylist
  palette:       PlaylistPalette | null
  index:         number
  /** `rect` = the cover's frame in window coordinates (for the open transition). */
  onPress:       (playlist: SpotifyPlaylist, rect?: { x: number; y: number; w: number; h: number }) => void
  onLongPress?:  (playlist: SpotifyPlaylist) => void
  /** 'full' (default) = glass row, cover left · 'grid' = glass tile, cover on top ·
   *  'tile' = bare cover + name, three across (the cover screen's bento) */
  layout?:       'full' | 'grid' | 'tile'
}

export function PlaylistCard({ playlist, palette, index, onPress, onLongPress, layout = 'full' }: PlaylistCardProps) {
  const grid = layout === 'grid'
  const coverUrl = playlist.images?.[0]?.url
  // Sized from the live window, not the one at launch: the Flip's cover screen is a
  // different width (and much shorter, so rows get a smaller cover there).
  const { width: W, height: H } = useLiveWindow()
  const compact = isCoverWindow(W, H)
  const rowCover = compact ? 68 : ROW_COVER

  const cachedVibe = useMemo(() => {
    const cached = getCache<PlaylistAnalysis>(CacheKeys.playlistAnalysis(playlist.id))
    return cached?.vibe ?? null
  }, [playlist.id])

  // ── Entrance: rise + scale in, staggered (skipped under Reduce motion) ──
  const still = reduceMotionEnabled()
  const enter = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    if (still) return
    enter.value = withDelay(Math.min(index * STAGGER_DELAY_MS, 400), withSpring(1, Spring.entrance))
  }, [])
  const entranceStyle = useAnimatedStyle(() => ({
    opacity:   Math.min(1, enter.value * 1.4),
    transform: [{ translateY: (1 - enter.value) * 28 }, { scale: 0.96 + 0.04 * enter.value }],
  }))

  // ── Press: the tile sinks a little and springs back ──
  const scale = useSharedValue(1)
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const probe = useRef<View>(null)
  const handlePress = () => {
    haptic.medium()
    const node = probe.current
    if (!node) { onPress(playlist); return }
    node.measureInWindow((x, y, w, h) => onPress(playlist, w > 0 ? { x, y, w, h } : undefined))
  }
  const handleLongPress = () => {
    if (!onLongPress) return
    haptic.heavy()
    onLongPress(playlist)
  }

  // Cover screen: a bare cover and its name, lined up with the bento above it.
  if (layout === 'tile') {
    // Sized by the cell the list gives it (not the window: after Samsung's resize the
    // reported window can be stale): side paddings that make three equal tiles with
    // BENTO_PAD outside and BENTO_GAP between, lined up with the bento above.
    const col = index % 3
    const inner = (BENTO_PAD + BENTO_GAP) / 3, outer = BENTO_GAP - inner
    const pad = col === 0 ? { paddingLeft: BENTO_PAD, paddingRight: outer }
      : col === 1 ? { paddingLeft: inner, paddingRight: inner }
      : { paddingLeft: outer, paddingRight: BENTO_PAD }
    return (
      <Animated.View style={[{ width: '100%', marginBottom: Spacing.md }, pad, entranceStyle]}>
        <AnimatedPressable
          onPressIn={() => { scale.value = withSpring(0.96, Spring.snappy) }}
          onPressOut={() => { scale.value = withSpring(1, Spring.snappy) }}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={300}
          style={pressStyle}
          accessibilityRole="button"
          accessibilityLabel={`${playlist.name}, ${playlist.tracks.total} tracks`}
          accessibilityHint={onLongPress ? 'Opens the lens. Long-press for more actions.' : 'Opens the lens.'}
        >
          <View style={[styles.coverTile, { width: '100%', aspectRatio: 1 }]}>
            {coverUrl
              ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} recyclingKey={playlist.id} />
              : <View style={[StyleSheet.absoluteFill, styles.coverFallback]} />}
            <View ref={probe} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
          </View>
          <Text style={styles.nameTile} numberOfLines={1}>{playlist.name}</Text>
        </AnimatedPressable>
      </Animated.View>
    )
  }

  // The tile's edge picks up the cover's own colour.
  const edge = palette ? alpha(palette.primary, 0.35) : Colors.glassBorder
  // Two across: each fills its cell, with the side gutter outside and half the gap inside
  // (sized by the cell, not the window, which can be stale after Samsung's resize).
  const gridPos = grid
    ? (index % 2 === 0
        ? { paddingLeft: SIDE_PAD, paddingRight: GRID_GAP / 2 }
        : { paddingLeft: GRID_GAP / 2, paddingRight: SIDE_PAD })
    : null

  const cover = (
    <View style={grid ? styles.coverGrid : [styles.coverRow, { width: rowCover, height: rowCover }]}>
      {coverUrl
        ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} recyclingKey={playlist.id} />
        : <View style={[StyleSheet.absoluteFill, styles.coverFallback]} />}
      {/* invisible probe: the cover's frame, where the open transition starts */}
      <View ref={probe} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
    </View>
  )
  const meta = (
    <View style={grid ? styles.metaGrid : styles.metaRow}>
      <Text style={grid ? styles.nameGrid : styles.name} numberOfLines={grid ? 1 : 2}>{playlist.name}</Text>
      <Text style={styles.sub} numberOfLines={1}>
        {playlist.tracks.total} tracks{grid ? '' : ` · ${playlist.owner.display_name}`}
      </Text>
      {cachedVibe && (
        <View style={[styles.vibe, { borderColor: alpha(vibeColor(cachedVibe), 0.45), backgroundColor: alpha(vibeColor(cachedVibe), 0.12) }]}>
          <View style={[styles.vibeDot, { backgroundColor: vibeColor(cachedVibe) }]} />
          <Text style={[styles.vibeText, { color: vibeColor(cachedVibe) }]} numberOfLines={1}>{cachedVibe}</Text>
        </View>
      )}
    </View>
  )

  return (
    <Animated.View style={[grid ? styles.wrapperGrid : styles.wrapper, compact && { marginBottom: Spacing.sm }, gridPos, entranceStyle]}>
      <AnimatedPressable
        onPressIn={() => { scale.value = withSpring(0.96, Spring.snappy) }}
        onPressOut={() => { scale.value = withSpring(1, Spring.snappy) }}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={[pressStyle, styles.tile, grid ? styles.tileGrid : styles.tileRow, { borderColor: edge }]}
        accessibilityRole="button"
        accessibilityLabel={`${playlist.name}, ${playlist.tracks.total} tracks${cachedVibe ? `, ${cachedVibe}` : ''}`}
        accessibilityHint={onLongPress ? 'Opens the lens. Long-press for more actions.' : 'Opens the lens.'}
      >
        {cover}
        {meta}
      </AnimatedPressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Full width of the list, less the side gutters (not the window's width: see gridPos).
  wrapper:     { alignSelf: 'stretch', marginHorizontal: SIDE_PAD, marginBottom: Spacing.md },
  wrapperGrid: { width: '100%', marginBottom: Spacing.md },

  tile: {
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderRadius:    COVER_RADIUS + TILE_PAD,
    padding:         TILE_PAD,
  },
  tileRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tileGrid: { gap: Spacing.sm },

  coverRow:      { width: ROW_COVER, height: ROW_COVER, borderRadius: COVER_RADIUS, overflow: 'hidden' },
  coverGrid:     { width: '100%', aspectRatio: 1, borderRadius: COVER_RADIUS, overflow: 'hidden' },
  coverFallback: { backgroundColor: Colors.card },
  coverTile:     { borderRadius: COVER_RADIUS, overflow: 'hidden' },
  nameTile:      { ...Type.caption, fontSize: 11, color: Colors.text, marginTop: 6, paddingHorizontal: 2 },

  metaRow:  { flex: 1, minWidth: 0, gap: 3, paddingRight: Spacing.sm },
  metaGrid: { gap: 2, paddingHorizontal: 4, paddingBottom: 4 },
  name:     { ...Type.heading, fontSize: 17, lineHeight: 21 },
  nameGrid: { ...Type.heading, fontSize: 15, lineHeight: 19, letterSpacing: -0.3 },
  sub:      { ...Type.caption, fontSize: 11 },

  vibe:     { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  vibeDot:  { width: 6, height: 6, borderRadius: 3 },
  vibeText: { ...Type.caption, fontSize: 10, letterSpacing: 0.3 },
})
