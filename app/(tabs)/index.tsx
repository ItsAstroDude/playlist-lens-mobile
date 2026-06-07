import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
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

const SKELETON_COUNT = 4

export default function PlaylistsTab() {
  const { status, data, error, fetch } = usePlaylists()
  const { palettes, extract }          = usePalette()

  const [refreshing, setRefreshing]     = useState(false)
  const [coldStart, setColdStart]       = useState(false)
  const [selectedPlaylist, setSelected] = useState<SpotifyPlaylist | null>(null)

  // ── Header entrance ──
  const headerY       = useSharedValue(12)
  const headerOpacity = useSharedValue(0)

  useEffect(() => {
    headerY.value       = withDelay(80, withSpring(0, Spring.entrance))
    headerOpacity.value = withDelay(80, withTiming(1, { duration: 380 }))
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

  // ── Extract palette as playlists load ──
  useEffect(() => {
    if (data) {
      data.forEach(pl => {
        const url = pl.images?.[0]?.url
        if (url && !palettes[pl.id]) extract(pl.id, url)
      })
    }
  }, [data])

  const handleCardPress = useCallback((playlist: SpotifyPlaylist) => {
    setSelected(playlist)
  }, [])

  const renderItem = useCallback(({ item, index }: { item: SpotifyPlaylist; index: number }) => (
    <PlaylistCard
      playlist={item}
      palette={palettes[item.id] || null}
      index={index}
      onPress={handleCardPress}
    />
  ), [palettes, handleCardPress])

  const keyExtractor = useCallback((item: SpotifyPlaylist) => item.id, [])

  const renderSkeletons = () => (
    <View style={styles.skeletonList}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <PlaylistCardSkeleton key={i} />
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
        <Text style={styles.emptySubtext}>Create a playlist on Spotify and come back.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>

      {/* ── Violet ambient glow — top-left ── */}
      <View style={styles.ambientViolet} pointerEvents="none" />

      {/* ── Pink ambient glow — bottom-right ── */}
      <View style={styles.ambientPink} pointerEvents="none" />

      {/* ── Subtle green aurora at top ── */}
      <LinearGradient
        colors={[Colors.auroraTop, Colors.auroraBot]}
        style={styles.aurora}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── Header ── */}
        <Animated.View style={[styles.header, headerStyle]}>
          <View>
            <Text style={styles.logo}>
              playlist<Text style={styles.dot}>.</Text>lens
            </Text>
          </View>
          <View style={styles.headerRight}>
            {data && data.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{data.length}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={styles.gearBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.gearIcon}>⚙</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Section title ── */}
        <Animated.View style={[styles.sectionHeader, headerStyle]}>
          <Text style={styles.sectionTitle}>Your Lenses</Text>
          <Text style={styles.sectionSub}>Sonic profiles from your library.</Text>
        </Animated.View>

        {/* ── Playlist list ── */}
        <FlashList
          data={data || []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={1}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.greenPrimary}
              colors={[Colors.greenPrimary]}
              progressBackgroundColor={Colors.card}
            />
          }
        />

        {/* ── Detail sheet ── */}
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

  // Ambient blobs
  ambientViolet: {
    position:     'absolute',
    top:          -80,
    left:         -80,
    width:        320,
    height:       320,
    borderRadius: 160,
    backgroundColor: Colors.violetGlow,
  },
  ambientPink: {
    position:     'absolute',
    bottom:       -100,
    right:        -80,
    width:        280,
    height:       280,
    borderRadius: 140,
    backgroundColor: Colors.pinkGlow,
  },

  // Green aurora at top
  aurora: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    height:   220,
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
    paddingTop:        Spacing.sm,
    paddingBottom:     Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
  },
  logo: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize.xl,
    color:         Colors.text,
    letterSpacing: -1,
  },
  dot: {
    color: Colors.greenPrimary,
  },
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
  gearBtn: {
    width:          32,
    height:         32,
    alignItems:     'center',
    justifyContent: 'center',
  },
  gearIcon: {
    fontSize: 16,
    color:    Colors.textMuted,
  },

  // Section title below header
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom:     Spacing.lg,
    gap:               3,
  },
  sectionTitle: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize['2xl'],
    color:         Colors.text,
    letterSpacing: -1,
    lineHeight:    FontSize['2xl'] * 1.1,
  },
  sectionSub: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },

  // List content padding — clears the floating pill navbar
  listContent: {
    paddingBottom: 130,
  },

  // Skeleton list (single column, matching new card layout)
  skeletonList: {
    gap:               Spacing.md,
    paddingHorizontal: Spacing.lg,
  },

  // Empty
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
