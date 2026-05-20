import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { DetailSheet } from '@/components/sheet/DetailSheet'
import { FlashList } from '@shopify/flash-list'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring } from '@/constants/animation'
import { deleteCache, CacheKeys } from '@/utils/cache'
import { usePlaylists } from '@/hooks/useSpotify'
import { usePalette } from '@/hooks/usePalette'
import { PlaylistCard } from '@/components/playlist/PlaylistCard'
import { PlaylistCardSkeleton } from '@/components/ui/Skeleton'
import { ColdStartOverlay, RetryBanner } from '@/components/ui/ServerState'
import type { SpotifyPlaylist } from '@/types'

const NUM_COLUMNS    = 2
const SKELETON_COUNT = 6

export default function PlaylistsTab() {
  const { status, data, error, fetch } = usePlaylists()
  const { palettes, extract }          = usePalette()

  const [refreshing, setRefreshing]     = useState(false)
  const [coldStart, setColdStart]       = useState(false)
  const [selectedPlaylist, setSelected] = useState<SpotifyPlaylist | null>(null)

  // ── Header entrance animation ──
  const headerY       = useSharedValue(12)
  const headerOpacity = useSharedValue(0)

  useEffect(() => {
    headerY.value       = withDelay(100, withSpring(0, Spring.entrance))
    headerOpacity.value = withDelay(100, withTiming(1, { duration: 400 }))
  }, [])

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerY.value }],
    opacity:   headerOpacity.value,
  }))

  // ── Initial fetch ──
  useEffect(() => {
    fetch({ onColdStart: () => setColdStart(true) }).finally(() => setColdStart(false))
  }, [])

  // ── Pull to refresh ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    deleteCache(CacheKeys.playlists)
    await fetch({ onColdStart: () => setColdStart(true) })
    setColdStart(false)
    setRefreshing(false)
  }, [fetch])

  // ── Extract palette colors as playlists load ──
  useEffect(() => {
    if (data) {
      data.forEach(pl => {
        const url = pl.images?.[0]?.url
        if (url && !palettes[pl.id]) extract(pl.id, url)
      })
    }
  }, [data])

  // ── Card press ──
  const handleCardPress = useCallback((playlist: SpotifyPlaylist) => {
    setSelected(playlist)
  }, [])

  // ── Render helpers ──
  const renderItem = useCallback(({ item, index }: { item: SpotifyPlaylist; index: number }) => (
    <View style={index % 2 === 0 ? styles.cellLeft : styles.cellRight}>
      <PlaylistCard
        playlist={item}
        palette={palettes[item.id] || null}
        index={index}
        onPress={handleCardPress}
      />
    </View>
  ), [palettes, handleCardPress])

  const keyExtractor = useCallback((item: SpotifyPlaylist) => item.id, [])

  // ── Skeletons ──
  const renderSkeletons = () => (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <View key={i} style={i % 2 === 0 ? styles.cellLeft : styles.cellRight}>
          <PlaylistCardSkeleton />
        </View>
      ))}
    </View>
  )

  const ListHeader = () => <ColdStartOverlay visible={coldStart} />

  const ListEmpty = () => {
    if (status === 'loading' || status === 'idle') return renderSkeletons()
    if (status === 'error') {
      return (
        <RetryBanner
          message={error || 'Failed to load playlists.'}
          onRetry={() => fetch({ onColdStart: () => setColdStart(true) })}
        />
      )
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No playlists found.</Text>
        <Text style={styles.emptySubtext}>Create a playlist on Spotify and come back!</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>

      {/* ── Ambient aurora — the "light source" behind the glass ── */}
      <LinearGradient
        colors={[Colors.auroraTop, Colors.auroraBot]}
        style={styles.aurora}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <Text style={styles.logo}>
            playlist<Text style={styles.dot}>.</Text>lens
          </Text>
          {data && data.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{data.length} playlists</Text>
            </View>
          )}
        </Animated.View>

        {/* Grid */}
        <FlashList
          data={data || []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.green}
              colors={[Colors.green]}
              progressBackgroundColor={Colors.card}
            />
          }
        />

        {/* Detail sheet — outside the list so it overlays everything */}
        <DetailSheet
          playlist={selectedPlaylist}
          palette={selectedPlaylist ? palettes[selectedPlaylist.id] ?? null : null}
          onClose={() => setSelected(null)}
        />

      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.background,
  },

  // Ambient gradient — covers the top 30% of screen with a faint green aurora
  aurora: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    height:   300,
    zIndex:   0,
  },

  safe: {
    flex:   1,
    zIndex: 1,
  },

  // ── Header ──
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.md,
    paddingBottom:     Spacing.lg,
  },
  logo: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize['2xl'],
    color:         Colors.text,
    letterSpacing: -1,
  },
  dot: {
    color: Colors.green,
  },

  // Glass pill badge for the playlist count
  countBadge: {
    backgroundColor:   Colors.glass,
    borderWidth:       1,
    borderColor:       Colors.glassBorder,
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   3,
  },
  countText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },

  // ── List ──
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom:     120,
  },

  // ── Grid cells ──
  cellLeft: {
    flex:        1,
    paddingRight: Spacing.md / 2,
  },
  cellRight: {
    flex:       1,
    paddingLeft: Spacing.md / 2,
  },

  // ── Skeleton grid ──
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     Spacing['5xl'],
    gap:            Spacing.sm,
  },
  emptyText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.md,
    color:      Colors.textSecondary,
  },
  emptySubtext: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.textMuted,
    textAlign:  'center',
  },
})

