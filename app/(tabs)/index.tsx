import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DetailSheet } from '@/components/sheet/DetailSheet'
import { FlashList } from '@shopify/flash-list'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme'
import { Spring } from '@/constants/animation'
import { deleteCache, CacheKeys } from '@/utils/cache'
import { usePlaylists } from '@/hooks/useSpotify'
import { usePalette } from '@/hooks/usePalette'
import { PlaylistCard } from '@/components/playlist/PlaylistCard'
import { PlaylistCardSkeleton } from '@/components/ui/Skeleton'
import { ColdStartOverlay, RetryBanner } from '@/components/ui/ServerState'
import type { SpotifyPlaylist } from '@/types'

const NUM_COLUMNS     = 2
const SKELETON_COUNT  = 6

export default function PlaylistsTab() {
  const { status, data, error, fetch } = usePlaylists()
  const { palettes, extract }          = usePalette()

  const [refreshing, setRefreshing]       = useState(false)
  const [coldStart, setColdStart]         = useState(false)
  const [selectedPlaylist, setSelected]   = useState<SpotifyPlaylist | null>(null)

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

  // ── Extract palette colors as playlists come in ──
  useEffect(() => {
    if (data) {
      data.forEach(pl => {
        const url = pl.images?.[0]?.url
        if (url && !palettes[pl.id]) {
          extract(pl.id, url)
        }
      })
    }
  }, [data])

  // ── Card press — opens detail sheet ──
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

  // ── Skeleton grid while loading ──
  const renderSkeletons = () => (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <View key={i} style={i % 2 === 0 ? styles.cellLeft : styles.cellRight}>
          <PlaylistCardSkeleton />
        </View>
      ))}
    </View>
  )

  // ── List header ──
  const ListHeader = () => (
    <>
      <ColdStartOverlay visible={coldStart} />
    </>
  )

  // ── Empty state ──
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
        <Text style={styles.emptySubtext}>
          Create a playlist on Spotify and come back!
        </Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <Text style={styles.logo}>
          playlist<Text style={styles.dot}>.</Text>lens
        </Text>
        {data && data.length > 0 && (
          <Text style={styles.count}>{data.length} playlists</Text>
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

      {/* Detail sheet — rendered outside the list so it overlays everything */}
      <DetailSheet
        playlist={selectedPlaylist}
        palette={selectedPlaylist ? palettes[selectedPlaylist.id] ?? null : null}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.background,
  },

  // ── Header ──
  header: {
    flexDirection:     'row',
    alignItems:        'baseline',
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
  count: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },

  // ── List ──
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom:     120, // room for tab bar
  },

  // ── Grid cell alignment ──
  cellLeft: {
    flex:          1,
    paddingRight:  Spacing.md / 2,
  },
  cellRight: {
    flex:         1,
    paddingLeft:  Spacing.md / 2,
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
