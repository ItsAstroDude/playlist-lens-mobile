import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Image, TouchableOpacity } from 'react-native'
import { confirmDialog, showToast } from '@/utils/dialog'
import { TabHeader } from '@/components/ui'
import { addAllMessage, cartFull } from '@/utils/queueCart'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
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

// ─── A track row (used in the cart + suggestion shelves) ───────────────────────
function TrackRow({ item, reason, trailing }: { item: QueueItem; reason?: string; trailing: React.ReactNode }) {
  return (
    <View style={styles.row}>
      {item.image
        ? <Image source={{ uri: item.image }} style={styles.cover} />
        : <View style={[styles.cover, styles.coverEmpty]}><Icon name="musical-note" style={styles.coverGlyph} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.artist} numberOfLines={1}>{reason ?? item.artist}</Text>
      </View>
      {trailing}
    </View>
  )
}

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
          <View style={styles.card}>
            <View style={styles.cardSpecular} />
            <View style={styles.cardHead}>
              <Text style={styles.sectionLabel}>YOUR QUEUE</Text>
              {count > 0 && (
                <TouchableOpacity onPress={confirmClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear queue">
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {count === 0 ? (
              <Text style={styles.emptyHint}>
                Empty for now. Tap the <Icon name="add-circle" inline size={FontSize.sm + 2} color={Colors.greenPrimary} /> on any track — in a suggestion below, or on your Wrapped top tracks — to build a queue.
              </Text>
            ) : (
              <>
                {items.map(it => (
                  <TrackRow
                    key={it.uri}
                    item={it}
                    trailing={
                      <Pressable
                        onPress={() => { haptic.light(); remove(it.uri) }} hitSlop={8} style={styles.remove}
                        accessibilityRole="button" accessibilityLabel={`Remove ${it.name} from queue`}
                      >
                        <Icon name="close" style={styles.removeGlyph} />
                      </Pressable>
                    }
                  />
                ))}
                <Pressable style={styles.startBtn} onPress={() => { haptic.medium(); emitOpenStartQueue() }} accessibilityRole="button">
                  <Text style={styles.startText}><Icon name="play" inline style={styles.startText} />  Start queue · {count}</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ── From your playlists ── */}
          <PlaylistSongPicker />

          {/* ── Rediscover ── */}
          {shelves.length > 0 ? (
            shelves.map(shelf => (
              <View key={shelf.id} style={styles.card}>
                <View style={styles.cardSpecular} />
                <View style={styles.cardHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.shelfTitle} numberOfLines={1}>{shelf.title}</Text>
                    <Text style={styles.shelfSub} numberOfLines={2}>{shelf.subtitle}</Text>
                  </View>
                  <View style={styles.shelfActions}>
                    <TouchableOpacity style={styles.playNow} onPress={() => playNow(shelf)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Play ${shelf.title} now`}>
                      <Text style={styles.playNowText}><Icon name="play" inline style={styles.playNowText} /> Play</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.queueAll} onPress={() => queueAll(shelf)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Add all of ${shelf.title} to queue`}>
                      <Text style={styles.queueAllText}><Icon name="add" inline style={styles.queueAllText} /> all</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {shelf.tracks.slice(0, SHELF_PREVIEW).map(s => (
                  <TrackRow key={s.uri} item={asItem(s)} reason={s.reason} trailing={<AddToQueueButton item={asItem(s)} />} />
                ))}
                {shelf.tracks.length > SHELF_PREVIEW && (
                  <Text style={styles.moreNote}>+{shelf.tracks.length - SHELF_PREVIEW} more in “add all”</Text>
                )}
              </View>
            ))
          ) : (
            <View style={styles.card}>
              <View style={styles.cardSpecular} />
              <Text style={styles.shelfTitle}>Rediscover your library</Text>
              <Text style={styles.emptyHint}>
                Import your listening history in <Text style={{ color: Colors.text }}>Wrapped</Text> to unlock smart suggestions — fading favorites, second chances, and a time machine to past seasons.
              </Text>
              <Pressable style={styles.importBtn} onPress={() => { haptic.light(); router.navigate('/wrapped') }}>
                <Text style={styles.importText}>Go to Wrapped  <Icon name="arrow-forward" inline style={styles.importText} /></Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
        <TopFade scrollY={scrollY} />
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1, zIndex: 1 },


  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 130 },

  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  cardSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  clearText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },

  emptyHint: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: FontSize.sm * 1.6 },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  cover: { width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.glass },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  coverGlyph: { fontFamily: FontFamily.mono, fontSize: FontSize.md, color: Colors.textMuted },
  name: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  artist: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  remove: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(Colors.text, 0.06) },
  removeGlyph: { fontFamily: FontFamily.mono, fontSize: 12, color: Colors.textMuted, marginTop: -1 },

  startBtn: { backgroundColor: Colors.greenPrimary, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  startText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.background, letterSpacing: 0.3 },

  shelfTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text, letterSpacing: -0.3 },
  shelfSub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, lineHeight: FontSize.xs * 1.5 },
  shelfActions: { gap: 6, alignItems: 'flex-end' },
  playNow: { borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: Colors.greenPrimary },
  playNowText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.background },
  queueAll: { borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.4), borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: alpha(Colors.greenPrimary, 0.1) },
  queueAllText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.greenPrimary },
  moreNote: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'center', marginTop: 2 },

  importBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.4), borderRadius: Radius.full, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, marginTop: Spacing.xs },
  importText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.greenPrimary },
})
