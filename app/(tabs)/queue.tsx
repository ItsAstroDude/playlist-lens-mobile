import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Image, TouchableOpacity } from 'react-native'
import { confirmDialog, showToast } from '@/utils/dialog'
import { TabHeader, Card, Chip, Button, EmptyState, TrackRow } from '@/components/ui'
import { addAllMessage, cartFull } from '@/utils/queueCart'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { TopFade } from '@/components/ui/TopFade'
import { AddToQueueButton } from '@/components/queue/AddToQueueButton'
import { PlaylistSongPicker } from '@/components/queue/PlaylistSongPicker'
import { useQueueCart } from '@/hooks/useQueueCart'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { emitOpenStartQueue } from '@/utils/overlayEvents'
import { loadRediscovery, type Shelf, type Suggestion } from '@/utils/rediscovery'
import type { QueueItem } from '@/utils/queueCart'
import { Icon } from '@/components/ui/Icon'

const asItem = (s: Suggestion): QueueItem => ({ uri: s.uri, name: s.name, artist: s.artist, image: s.image })

const SHELF_PREVIEW = 6   // rows shown per shelf; "Queue all" grabs the rest

export default function QueueTab() {
  const { items, count, remove, clear, addMany } = useQueueCart()
  const [shelves, setShelves] = useState<Shelf[]>([])
  const gutter = useNowPlayingGutter()
  const scrollY = useSharedValue(0)

  // Recompute suggestions whenever the tab gains focus (import / auto-pull may have
  // changed the data since last time).
  useFocusEffect(useCallback(() => { setShelves(loadRediscovery()) }, []))


  const queueAll = useCallback((shelf: Shelf) => {
    const added = addMany(shelf.tracks.map(asItem))
    added ? haptic.success() : haptic.light()
    showToast(addAllMessage(added, shelf.tracks.length, cartFull()), added ? 'checkmark-circle' : 'information-circle-outline')
  }, [addMany])

  const playNow = useCallback((shelf: Shelf) => {
    haptic.medium()
    emitOpenStartQueue(shelf.tracks.map(asItem))   // ad-hoc start, leaves the cart alone
  }, [])

  const confirmClear = useCallback(() => {
    if (count === 0) return
    haptic.light()
    confirmDialog({
      glyph: 'trash-outline', destructive: true, confirmLabel: 'Clear',
      title: 'Clear the queue?',
      message: `Remove all ${count} ${count === 1 ? 'track' : 'tracks'} from your queue?`,
      onConfirm: clear,
    })
  }, [count, clear])

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <TabHeader title="queue" subtitle="Hand-pick tracks or rediscover old favorites, then play them on Spotify" />

        <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 130 + gutter }]}
          showsVerticalScrollIndicator={false}
          onScroll={e => { scrollY.value = e.nativeEvent.contentOffset.y }}
          scrollEventThrottle={16}
        >

          {/* ── Your queue ── */}
          <Card padded>
            <View style={styles.cardHead}>
              <Text style={Type.overline}>your queue{count ? ` · ${count}` : ''}</Text>
              {count > 0 && <Chip label="Clear" icon="trash-outline" onPress={confirmClear} />}
            </View>

            {count === 0 ? (
              <Text style={styles.hint}>
                Empty for now. Tap the <Icon name="add-circle" inline size={FontSize.sm + 2} color={Colors.greenPrimary} /> on any track — in a suggestion below, or on your Wrapped top tracks — to build a queue.
              </Text>
            ) : (
              <>
                {items.map(it => (
                  <TrackRow
                    key={it.uri}
                    title={it.name} sub={it.artist} image={it.image}
                    trailing={
                      <Pressable
                        onPress={() => { haptic.light(); remove(it.uri) }} hitSlop={8} style={styles.remove}
                        accessibilityRole="button" accessibilityLabel={`Remove ${it.name} from queue`}
                      >
                        <Icon name="close" size={14} color={Colors.textMuted} />
                      </Pressable>
                    }
                  />
                ))}
                <Button label={`Start queue · ${count}`} icon="play" onPress={() => emitOpenStartQueue()} style={styles.start} />
              </>
            )}
          </Card>

          {/* ── From your playlists ── */}
          <PlaylistSongPicker />

          {/* ── Rediscover ── */}
          {shelves.length > 0 ? (
            shelves.map(shelf => (
              <Card key={shelf.id} padded>
                <Text style={Type.heading} numberOfLines={1}>{shelf.title}</Text>
                <Text style={[Type.caption, styles.shelfSub]} numberOfLines={2}>{shelf.subtitle}</Text>
                <View style={styles.shelfActions}>
                  <Chip label="Play now" icon="play" onPress={() => playNow(shelf)} />
                  <Chip label={`Add all ${shelf.tracks.length}`} icon="add" onPress={() => queueAll(shelf)} />
                </View>
                {shelf.tracks.slice(0, SHELF_PREVIEW).map(sg => (
                  <TrackRow key={sg.uri} title={sg.name} sub={sg.reason ?? sg.artist} image={sg.image} trailing={<AddToQueueButton item={asItem(sg)} />} />
                ))}
                {shelf.tracks.length > SHELF_PREVIEW && (
                  <Text style={[Type.caption, styles.more]}>+{shelf.tracks.length - SHELF_PREVIEW} more with “Add all”</Text>
                )}
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState
                icon="sparkles-outline"
                title="Rediscover your library"
                body="Import your listening history in Wrapped to unlock smart suggestions — fading favorites, second chances and a time machine to past seasons."
                actionLabel="Go to Wrapped"
                onAction={() => router.navigate('/wrapped')}
              />
            </Card>
          )}

        </ScrollView>
        <TopFade scrollY={scrollY} />
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  hint:         { ...Type.caption, fontSize: 11, lineHeight: 17, marginTop: Spacing.sm },
  start:        { marginTop: Spacing.md },
  shelfSub:     { marginTop: 2 },
  shelfActions: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.md },
  more:         { textAlign: 'center', marginTop: Spacing.sm },

  container: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1, zIndex: 1 },


  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 130, gap: Spacing.md },

  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },


  remove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(Colors.text, 0.06) },



})
