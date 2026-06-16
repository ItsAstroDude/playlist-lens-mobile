import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, Image, Pressable, Modal, FlatList, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { usePlaylists, usePlaylistTracks } from '@/hooks/useSpotify'
import { AddToQueueButton } from './AddToQueueButton'
import { addManyToCart, type QueueItem } from '@/utils/queueCart'
import type { SpotifyPlaylist, SpotifyTrack } from '@/types'

const toItem = (t: SpotifyTrack): QueueItem | null =>
  t.uri && t.uri.startsWith('spotify:track:')
    ? { uri: t.uri, name: t.name, artist: t.artists.map(a => a.name).join(', '), image: t.album?.images?.[0]?.url }
    : null

/**
 * "From your playlists" (v1.5) — a horizontal strip of the user's playlists; tap one
 * to open its tracks and ＋ them (or ＋ all) into the queue cart. Lives on the Queue
 * tab between the cart and the rediscovery shelves.
 */
export function PlaylistSongPicker() {
  const { data: playlists, fetch, status } = usePlaylists()
  const [chosen, setChosen] = useState<SpotifyPlaylist | null>(null)

  useEffect(() => { if (!playlists?.length) fetch() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const list = playlists ?? []

  return (
    <View style={styles.card}>
      <View style={styles.cardSpecular} />
      <Text style={styles.title}>From your playlists</Text>
      <Text style={styles.sub}>Pull songs straight out of a playlist into your queue</Text>

      {list.length ? (
        <FlatList
          horizontal
          data={list}
          keyExtractor={p => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          renderItem={({ item }) => {
            const thumb = item.images?.[0]?.url
            return (
              <Pressable style={styles.plCard} onPress={() => { haptic.light(); setChosen(item) }}>
                {thumb
                  ? <Image source={{ uri: thumb }} style={styles.plThumb} />
                  : <View style={[styles.plThumb, styles.plThumbEmpty]}><Text style={styles.plThumbGlyph}>♪</Text></View>}
                <Text style={styles.plName} numberOfLines={2}>{item.name}</Text>
              </Pressable>
            )
          }}
        />
      ) : (
        <Text style={styles.empty}>{status === 'loading' ? 'Loading your playlists…' : 'No playlists found.'}</Text>
      )}

      {chosen && <TrackPickerModal playlist={chosen} onClose={() => setChosen(null)} />}
    </View>
  )
}

function TrackPickerModal({ playlist, onClose }: { playlist: SpotifyPlaylist; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const { data: tracks, fetch, status } = usePlaylistTracks()
  useEffect(() => { fetch(playlist.id) }, [playlist.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const items = ((tracks ?? []).map(toItem).filter(Boolean) as QueueItem[])
  const addAll = () => { const n = addManyToCart(items); n ? haptic.success() : haptic.light() }

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle} numberOfLines={1}>{playlist.name}</Text>
          {items.length > 0 && (
            <TouchableOpacity style={styles.addAll} onPress={addAll} hitSlop={6}>
              <Text style={styles.addAllText}>＋ all</Text>
            </TouchableOpacity>
          )}
        </View>

        {status === 'loading' ? (
          <View style={styles.loading}><ActivityIndicator color={Colors.greenPrimary} /></View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={it => it.uri}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.row}>
                {item.image
                  ? <Image source={{ uri: item.image }} style={styles.cover} />
                  : <View style={[styles.cover, styles.coverEmpty]}><Text style={styles.coverGlyph}>♪</Text></View>}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
                </View>
                <AddToQueueButton item={item} />
              </View>
            )}
            ListEmptyComponent={<Text style={[styles.empty, { paddingHorizontal: Spacing.lg }]}>No playable tracks here.</Text>}
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, marginBottom: Spacing.md },
  cardSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize.md, color: Colors.text, letterSpacing: -0.3 },
  sub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  strip: { gap: Spacing.sm, paddingTop: Spacing.md },
  plCard: { width: 92 },
  plThumb: { width: 92, height: 92, borderRadius: Radius.md, backgroundColor: Colors.glass },
  plThumbEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  plThumbGlyph: { fontFamily: FontFamily.mono, fontSize: FontSize.lg, color: Colors.textMuted },
  plName: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: FontSize.xs * 1.3 },
  empty: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.sm },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: Colors.sheet, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderTopWidth: 1, borderColor: Colors.glassBorder, maxHeight: '78%', paddingTop: Spacing.sm },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, alignSelf: 'center', marginBottom: Spacing.md },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  modalTitle: { flex: 1, fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  addAll: { borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.4), borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.md, backgroundColor: alpha(Colors.greenPrimary, 0.1) },
  addAllText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.greenPrimary },
  loading: { paddingVertical: Spacing['3xl'], alignItems: 'center' },
  modalList: { paddingBottom: 20, paddingHorizontal: Spacing.lg },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  cover: { width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.glass },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  coverGlyph: { fontFamily: FontFamily.mono, fontSize: FontSize.md, color: Colors.textMuted },
  name: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  artist: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
})
