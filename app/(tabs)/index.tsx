import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, TextInput, Keyboard, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
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
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { deleteCache, CacheKeys } from '@/utils/cache'
import { usePlaylists } from '@/hooks/useSpotify'
import { usePalette } from '@/hooks/usePalette'
import { PlaylistCard, GRID_W, GRID_GAP } from '@/components/playlist/PlaylistCard'
import { PlaylistCardSkeleton } from '@/components/ui/Skeleton'
import { ColdStartOverlay, RetryBanner } from '@/components/ui/ServerState'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { HomeTopStrip } from '@/components/nowplaying/NowPlayingStrip'
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist'
import { PlaylistActionsSheet } from '@/components/playlist/PlaylistActionsSheet'
import { loadOrder, saveOrder, applyOrder, pinToTop } from '@/utils/playlistOrder'
import { setTabBarHidden } from '@/utils/tabBar'
import { getLensLayout, setLensLayout, type LensLayout } from '@/utils/settings'
import { showToast } from '@/utils/dialog'
import { filterPlaylists } from '@/utils/playlistSearch'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import type { SpotifyPlaylist } from '@/types'
import { Icon } from '@/components/ui/Icon'
import { TabHeader, IconButton } from '@/components/ui'
import { useLoadTime, useRenderStart } from '@/utils/perf'

const SKELETON_COUNT = 4

export default function PlaylistsTab() {
  const t0 = useRenderStart()
  const { status, data, error, fetch, removePlaylist } = usePlaylists()
  useLoadTime('lenses', t0, status === 'success' && !!data, { firstContent: true })
  const { palettes, extract }          = usePalette()

  const [refreshing, setRefreshing]     = useState(false)
  const [coldStart, setColdStart]       = useState(false)
  const [selectedPlaylist, setSelected] = useState<SpotifyPlaylist | null>(null)
  const gutter = useNowPlayingGutter()

  // ── Custom ordering + reorder mode + long-press actions ──
  const [order, setOrder]               = useState<string[]>(() => loadOrder())
  const [reorderMode, setReorderMode]   = useState(false)
  const [actionsTarget, setActions]     = useState<SpotifyPlaylist | null>(null)

  // ── Lens layout (full cards ↔ 2-col grid) — persisted, applies instantly ──
  const [layout, setLayout] = useState<LensLayout>(getLensLayout)
  const toggleLayout = useCallback(() => {
    setLayout(prev => {
      const next = prev === 'full' ? 'grid' : 'full'
      setLensLayout(next)
      return next
    })
  }, [])

  const orderedData = useMemo(() => applyOrder(data ?? [], order), [data, order])

  // ── Search — find a lens by name or owner (hidden until the search button) ──
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery]           = useState('')
  const visibleData = useMemo(() => filterPlaylists(orderedData, query), [orderedData, query])
  const searching = query.trim().length > 0
  const toggleSearch = useCallback(() => {
    setSearchOpen(open => {
      if (open) { setQuery(''); Keyboard.dismiss() }
      return !open
    })
  }, [])

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
    showToast('That playlist is gone from Spotify — removed from your lenses', 'trash-outline', 3600)
  }, [removePlaylist])

  // ── Auto-hide the floating navbar on scroll-down, reveal on scroll-up / at top ──
  const lastY = useRef(0)
  const scrollY = useSharedValue(0)
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y  = e.nativeEvent.contentOffset.y
    scrollY.value = y
    if (reorderMode) return
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

  // ── Initial fetch ──
  useEffect(() => {
    fetch({ onColdStart: () => setColdStart(true) }).finally(() => setColdStart(false))
  }, [])

  // ── Pull to refresh ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    const fresh = await fetch({ onColdStart: () => setColdStart(true), force: true })
    setColdStart(false)
    setRefreshing(false)
    if (fresh) haptic.light()
    // Keep showing the saved list on failure — but say so rather than failing silently.
    else if (data?.length) { haptic.warning(); showToast('Couldn’t refresh — showing your saved playlists', 'cloud-offline-outline') }
  }, [fetch, data])

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

  // Placeholders match the active layout, so the list doesn't jump shape on load.
  const renderSkeletons = () => layout === 'grid' ? (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: SKELETON_COUNT * 2 }).map((_, i) => (
        <PlaylistCardSkeleton key={i} height={GRID_W} style={{ width: GRID_W }} />
      ))}
    </View>
  ) : (
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
      {coldStart ? <ColdStartOverlay visible /> : <HomeTopStrip />}
      <TouchableOpacity
        style={styles.tastePill}
        onPress={openTaste}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Your taste profile"
        accessibilityHint="Aggregate stats, sharing and friend comparisons"
      >
        <View style={styles.tastePillSpecular} />
        <Icon name="aperture" style={styles.tastePillIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.tastePillText}>Your taste profile</Text>
          <Text style={styles.tastePillSub}>Aggregate stats · share · compare friends</Text>
        </View>
        <Icon name="arrow-forward" style={styles.tastePillArrow} />
      </TouchableOpacity>
    </>
  ), [coldStart, openTaste])

  const ListEmpty = () => {
    if (searching && orderedData.length > 0) {
      return (
        <View style={styles.emptyWrap}>
          <Icon name="search-outline" style={styles.emptyGlyph} />
          <Text style={styles.emptyText}>No lenses match “{query.trim()}”</Text>
          <Text style={styles.emptySubtext}>Try a shorter word, or search by who made it.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setQuery('')} activeOpacity={0.8} accessibilityRole="button">
            <Text style={styles.emptyBtnText}>Clear search</Text>
          </TouchableOpacity>
        </View>
      )
    }
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
        <Icon name="aperture-outline" style={styles.emptyGlyph} />
        <Text style={styles.emptyText}>No playlists yet</Text>
        <Text style={styles.emptySubtext}>Create or follow a playlist on Spotify, then check again.</Text>
        <TouchableOpacity
          style={styles.emptyBtn} onPress={onRefresh} activeOpacity={0.8} disabled={refreshing}
          accessibilityRole="button" accessibilityLabel="Check again for playlists"
        >
          <Text style={styles.emptyBtnText}>{refreshing ? 'Checking…' : <><Icon name="refresh" inline style={styles.emptyBtnText} />  Check again</>}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>

      {/* ── Living ambient background (drifting glows + aurora) ── */}
      <AmbientBackground />

      <SafeAreaView style={styles.safe} edges={['top']}>

        <TabHeader
          title={reorderMode ? 'reorder' : 'lenses'}
          subtitle={
            searchOpen && !reorderMode ? undefined
            : reorderMode ? 'Long-press a lens and drag to arrange.'
            : data && data.length > 0
              ? `${data.length.toLocaleString()} ${data.length === 1 ? 'playlist' : 'playlists'} · sonic profiles from your library.`
              : 'Sonic profiles from your library.'
          }
          titleRight={reorderMode ? (
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => { haptic.success(); setReorderMode(false) }}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          ) : (
            <>
              <IconButton icon={searchOpen ? 'close' : 'search'} label={searchOpen ? 'Close search' : 'Search your lenses'} active={searchOpen} onPress={toggleSearch} />
              {/* shows the layout you'd switch TO */}
              <IconButton icon={layout === 'full' ? 'grid-outline' : 'list-outline'} label={layout === 'full' ? 'Switch to grid view' : 'Switch to list view'} onPress={toggleLayout} />
            </>
          )}
        >
          {searchOpen && !reorderMode ? (
            <View style={styles.searchBox}>
              <Icon name="search" size={15} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search lenses or owners…"
                placeholderTextColor={Colors.textMuted}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="never"
                accessibilityLabel="Search your lenses"
              />
              {searching && (
                <Text style={styles.searchCount} accessibilityLiveRegion="polite">
                  {visibleData.length}/{orderedData.length}
                </Text>
              )}
              {searching && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Icon name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </TabHeader>

        {/* ── Playlist list ── */}
        <View style={styles.listWrap}>
        {reorderMode ? (
          <DraggableFlatList
            data={orderedData}
            renderItem={renderDraggable}
            keyExtractor={keyExtractor}
            onDragEnd={({ data: next }) => persistOrder(next.map(p => p.id))}
            onDragBegin={() => haptic.medium()}
            contentContainerStyle={[styles.listContent, { paddingBottom: 130 + gutter }]}
            showsVerticalScrollIndicator={false}
            activationDistance={12}
          />
        ) : (
          <FlashList
            key={layout}   // numColumns changes need a clean remount
            data={visibleData}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={layout === 'grid' ? 2 : 1}
            contentContainerStyle={[styles.listContent, { paddingBottom: 130 + gutter }]}
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
        </View>

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
          onReorder={() => { setSearchOpen(false); setQuery(''); setReorderMode(true) }}
          onCompare={(id) => router.push(`/compare?from=${id}`)}
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

  safe: {
    flex:   1,
    zIndex: 1,
  },

  // ── Header ──
  // "Your taste" pill — lives in the top strip, opens the pushed taste screen
  tastePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.md,
    marginHorizontal:  Spacing.lg,
    marginBottom:      Spacing.md,
    paddingVertical:   Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor:   alpha(Colors.greenPrimary, 0.07),
    borderWidth:       1,
    borderColor:       alpha(Colors.greenPrimary, 0.28),
    borderRadius:      Radius.lg,
    overflow:          'hidden',
  },
  tastePillSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  tastePillIcon:  { fontSize: 20, color: Colors.greenPrimary },
  tastePillText:  { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  tastePillSub:   { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  tastePillArrow: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.lg, color: Colors.greenPrimary },

  // Section title below header
  doneBtn: {
    backgroundColor:   Colors.greenPrimary,
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.xs + 1,
  },
  searchBox: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.sm,
    marginTop:         Spacing.sm,
    paddingHorizontal: Spacing.md,
    height:            40,
    borderRadius:      Radius.full,
    backgroundColor:   Colors.glass,
    borderWidth:       1,
    borderColor:       Colors.glassBorder,
  },
  searchInput: {
    flex:            1,
    fontFamily:      FontFamily.mono,
    fontSize:        FontSize.base,
    color:           Colors.text,
    paddingVertical: 0,
  },
  searchCount: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  doneBtnText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
    color:      Colors.background,
  },

  // List content padding — clears the floating pill navbar
  listWrap: { flex: 1 },
  listContent: {
    paddingBottom: 130,
  },

  // Skeleton list (single column, matching new card layout)
  skeletonList: {
    gap:               Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  skeletonGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    gap:               GRID_GAP,
    paddingHorizontal: Spacing.lg,
  },

  // Empty
  emptyWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     Spacing['5xl'],
    gap:            Spacing.sm,
  },
  emptyGlyph: { fontSize: 34, color: Colors.greenPrimary, marginBottom: Spacing.xs },
  emptyBtn: {
    marginTop:         Spacing.md,
    paddingVertical:   Spacing.sm + 2,
    paddingHorizontal: Spacing.xl,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       alpha(Colors.greenPrimary, 0.4),
    backgroundColor:   alpha(Colors.greenPrimary, 0.1),
  },
  emptyBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.greenPrimary },
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
    paddingHorizontal: Spacing['2xl'],
  },
})
