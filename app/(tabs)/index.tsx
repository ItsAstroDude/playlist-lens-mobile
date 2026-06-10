import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, Alert, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
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
import { Spring, haptic } from '@/constants/animation'
import { deleteCache, CacheKeys } from '@/utils/cache'
import { usePlaylists } from '@/hooks/useSpotify'
import { usePalette } from '@/hooks/usePalette'
import { PlaylistCard } from '@/components/playlist/PlaylistCard'
import { PlaylistCardSkeleton } from '@/components/ui/Skeleton'
import { ColdStartOverlay, RetryBanner } from '@/components/ui/ServerState'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { RotatingStrip } from '@/components/ui/RotatingStrip'
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist'
import { PlaylistActionsSheet } from '@/components/playlist/PlaylistActionsSheet'
import { loadOrder, saveOrder, applyOrder, pinToTop } from '@/utils/playlistOrder'
import { setTabBarHidden } from '@/utils/tabBar'
import { getLensLayout, setLensLayout, type LensLayout } from '@/utils/settings'
import type { SpotifyPlaylist } from '@/types'

const SKELETON_COUNT = 4

export default function PlaylistsTab() {
  const { status, data, error, fetch, removePlaylist } = usePlaylists()
  const { palettes, extract }          = usePalette()

  const [refreshing, setRefreshing]     = useState(false)
  const [coldStart, setColdStart]       = useState(false)
  const [selectedPlaylist, setSelected] = useState<SpotifyPlaylist | null>(null)

  // ── Custom ordering + reorder mode + long-press actions ──
  const [order, setOrder]               = useState<string[]>(() => loadOrder())
  const [reorderMode, setReorderMode]   = useState(false)
  const [actionsTarget, setActions]     = useState<SpotifyPlaylist | null>(null)

  // ── Lens layout (full cards ↔ 2-col grid) — persisted, applies instantly ──
  const [layout, setLayout] = useState<LensLayout>(getLensLayout)
  const toggleLayout = useCallback(() => {
    haptic.light()
    setLayout(prev => {
      const next = prev === 'full' ? 'grid' : 'full'
      setLensLayout(next)
      return next
    })
  }, [])

  const orderedData = useMemo(() => applyOrder(data ?? [], order), [data, order])

  const persistOrder = useCallback((ids: string[]) => { setOrder(ids); saveOrder(ids) }, [])

  const openActions   = useCallback((pl: SpotifyPlaylist) => setActions(pl), [])
  const handlePin     = useCallback((id: string) => persistOrder(pinToTop(orderedData.map(p => p.id), id)), [orderedData, persistOrder])
  const handleReanalyze = useCallback((id: string) => {
    deleteCache(CacheKeys.playlistAnalysis(id))
    const pl = (data ?? []).find(p => p.id === id)
    if (pl) setSelected(pl) // reopen → recomputes from fresh data
  }, [data])
  const handleGone = useCallback((id: string) => {
    setSelected(null)
    removePlaylist(id)
    haptic.warning()
    Alert.alert('Removed', 'That playlist no longer exists on Spotify — taken off your list.')
  }, [removePlaylist])

  // ── Auto-hide the floating navbar on scroll-down, reveal on scroll-up / at top ──
  const lastY = useRef(0)
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (reorderMode) return
    const y  = e.nativeEvent.contentOffset.y
    const dy = y - lastY.current
    if (y < 40)       setTabBarHidden(false)
    else if (dy > 10) setTabBarHidden(true)
    else if (dy < -10) setTabBarHidden(false)
    lastY.current = y
  }, [reorderMode])

  // Reorder mode hides the navbar entirely (it has its own Done button + the bar
  // would otherwise create a dead-drop zone at the bottom). Restore on exit/unmount.
  useEffect(() => {
    setTabBarHidden(reorderMode)
    return () => setTabBarHidden(false)
  }, [reorderMode])

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
      onLongPress={openActions}
      layout={layout}
    />
  ), [palettes, handleCardPress, openActions, layout])

  // Reorder mode — same card, but long-press starts a drag instead of opening actions.
  const renderDraggable = useCallback(({ item, drag, isActive }: RenderItemParams<SpotifyPlaylist>) => (
    <ScaleDecorator activeScale={1.04}>
      <PlaylistCard
        playlist={item}
        palette={palettes[item.id] || null}
        index={0}
        onPress={() => drag()}
        onLongPress={() => drag()}
      />
    </ScaleDecorator>
  ), [palettes])

  const keyExtractor = useCallback((item: SpotifyPlaylist) => item.id, [])

  const renderSkeletons = () => (
    <View style={styles.skeletonList}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <PlaylistCardSkeleton key={i} />
      ))}
    </View>
  )

  const openTaste = useCallback(() => { haptic.light(); router.push('/taste') }, [])

  // Memoized as an ELEMENT (not an inline component) so FlashList doesn't see a
  // new header type every render — that was remounting RotatingStrip and making
  // the quotes jump/skip on refresh. Only re-derives when cold-start flips.
  const listHeader = useMemo(() => (
    <>
      {coldStart ? <ColdStartOverlay visible /> : <RotatingStrip />}
      <TouchableOpacity style={styles.tastePill} onPress={openTaste} activeOpacity={0.85}>
        <View style={styles.tastePillSpecular} />
        <Text style={styles.tastePillIcon}>◎</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.tastePillText}>Your taste profile</Text>
          <Text style={styles.tastePillSub}>Aggregate stats · share · compare friends</Text>
        </View>
        <Text style={styles.tastePillArrow}>→</Text>
      </TouchableOpacity>
    </>
  ), [coldStart, openTaste])

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

      {/* ── Living ambient background (drifting glows + aurora) ── */}
      <AmbientBackground />

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

        {/* ── Section title (doubles as the reorder bar) ── */}
        <Animated.View style={[styles.sectionHeader, headerStyle]}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{reorderMode ? 'Reorder' : 'Your Lenses'}</Text>
            {reorderMode ? (
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => { haptic.success(); setReorderMode(false) }}
                activeOpacity={0.8}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.layoutBtn}
                onPress={toggleLayout}
                activeOpacity={0.7}
              >
                {/* shows the layout you'd switch TO */}
                <Text style={styles.layoutBtnIcon}>{layout === 'full' ? '▦' : '▤'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.sectionSub}>
            {reorderMode ? 'Long-press a lens and drag to arrange.' : 'Sonic profiles from your library.'}
          </Text>
        </Animated.View>

        {/* ── Playlist list ── */}
        {reorderMode ? (
          <DraggableFlatList
            data={orderedData}
            renderItem={renderDraggable}
            keyExtractor={keyExtractor}
            onDragEnd={({ data: next }) => persistOrder(next.map(p => p.id))}
            onDragBegin={() => haptic.medium()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            activationDistance={12}
          />
        ) : (
          <FlashList
            key={layout}   // numColumns changes need a clean remount
            data={orderedData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={layout === 'grid' ? 2 : 1}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={listHeader}
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
        )}

        {/* ── Detail sheet ── */}
        <DetailSheet
          playlist={selectedPlaylist}
          palette={selectedPlaylist ? palettes[selectedPlaylist.id] ?? null : null}
          onClose={() => setSelected(null)}
          onGone={handleGone}
        />

        {/* ── Long-press quick actions ── */}
        <PlaylistActionsSheet
          playlist={actionsTarget}
          onClose={() => setActions(null)}
          onPin={handlePin}
          onReanalyze={handleReanalyze}
          onReorder={() => setReorderMode(true)}
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

  // "Your taste" pill — lives in the top strip, opens the pushed taste screen
  tastePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.md,
    marginHorizontal:  Spacing.lg,
    marginBottom:      Spacing.md,
    paddingVertical:   Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor:   'rgba(83,224,118,0.07)',
    borderWidth:       1,
    borderColor:       'rgba(83,224,118,0.28)',
    borderRadius:      Radius.lg,
    overflow:          'hidden',
  },
  tastePillSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  tastePillIcon:  { fontSize: 20, color: Colors.greenPrimary },
  tastePillText:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  tastePillSub:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  tastePillArrow: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.lg, color: Colors.greenPrimary },

  // Section title below header
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom:     Spacing.lg,
    gap:               3,
  },
  sectionTitleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  doneBtn: {
    backgroundColor:   Colors.greenPrimary,
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.xs + 1,
  },
  layoutBtn: {
    width:           32,
    height:          32,
    borderRadius:    Radius.sm,
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },
  layoutBtnIcon: {
    fontSize: 15,
    color:    Colors.textMuted,
  },
  doneBtnText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
    color:      Colors.background,
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
