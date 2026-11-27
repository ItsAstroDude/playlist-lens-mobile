import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TabHeader, Card, ListRow, Chip, Stat, Button, EmptyState } from '@/components/ui'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSharedValue } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { haptic } from '@/constants/animation'
import { enqueue } from '@/utils/outbox'
import { api, ApiError } from '@/utils/api'
import { deleteCache, CacheKeys } from '@/utils/cache'
import { hideTabBar } from '@/utils/tabBar'
import { getScopeStatus, setScopeStatus, onScopeStatus } from '@/utils/scopeStatus'
import { usePlaylists, usePlaylistTracks } from '@/hooks/useSpotify'
import { useAuth } from '@/hooks/useAuth'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { SwipeDeck } from '@/components/swipe/SwipeDeck'
import type { SpotifyPlaylist, SpotifyTrack } from '@/types'
import { Icon } from '@/components/ui/Icon'

// ─── Swipe-refresh (v1.3 "Lively") ───────────────────────────────────────────
// Tinder-style playlist cleanup. NON-DESTRUCTIVE by design: the summary offers
// "save kept as new playlist" (primary — original untouched) or "trim original"
// (a full private backup is created FIRST), each behind an explicit confirm.

type Phase = 'pick' | 'swipe' | 'summary' | 'done'
interface Decision { track: SpotifyTrack; keep: boolean }
type DoneInfo =
  | { kind: 'created'; name: string; added: number; skippedLocal: number }
  | { kind: 'trimmed'; backupName: string; removed: number }

export default function SwipeTab() {
  const [phase, setPhase]         = useState<Phase>('pick')
  const [playlist, setPlaylist]   = useState<SpotifyPlaylist | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [index, setIndex]         = useState(0)
  const [confirm, setConfirm]     = useState<'create' | 'trim' | null>(null)
  const [busy, setBusy]           = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [done, setDone]           = useState<DoneInfo | null>(null)
  const [exitConfirm, setExitConfirm] = useState(false)

  const { data: playlists, status: plStatus, fetch: fetchPlaylists } = usePlaylists()
  const { data: tracks, status: trStatus, fetch: fetchTracks } = usePlaylistTracks()
  const { login, getMe, isLoading: authLoading } = useAuth()
  const [meId, setMeId] = useState<string | null>(null)

  const [scopes, setScopes] = useState(getScopeStatus())
  useEffect(() => onScopeStatus(setScopes), [])

  const gutter = useNowPlayingGutter()
  const scrollY = useSharedValue(0)

  useEffect(() => {
    fetchPlaylists()
    getMe().then(me => setMeId(me?.id ?? null))
  }, [])

  // Full-immersion session: the floating tab bar (and the now-playing pill that
  // follows it) slide away while swiping, and come back for every other phase.
  useEffect(() => {
    hideTabBar('swipe', phase === 'swipe')
    return () => hideTabBar('swipe', false)
  }, [phase])

  // Only owned (or collaborative) playlists are editable on Spotify.
  const editable = useMemo(
    () => (playlists ?? []).filter(p => p.collaborative || !meId || p.owner?.id === meId),
    [playlists, meId],
  )

  const swipeable = useMemo(
    () => (tracks ?? []).filter(t => t && t.id && t.uri),
    [tracks],
  )

  // ── Session flow ──
  const startSession = useCallback(async (p: SpotifyPlaylist) => {
    haptic.medium()
    setPlaylist(p)
    setDecisions([])
    setIndex(0)
    setWriteError(null)
    setDone(null)
    setPhase('swipe')
    const got = await fetchTracks(p.id)
    if (!got?.length) setPhase('pick')   // fetch failed or empty — stay safe
  }, [fetchTracks])

  const onDecide = useCallback((keep: boolean) => {
    const t = swipeable[index]
    if (!t) return
    setDecisions(d => [...d, { track: t, keep }])
    if (index + 1 >= swipeable.length) setPhase('summary')
    else setIndex(i => i + 1)
  }, [swipeable, index])

  const onUndo = useCallback(() => {
    setDecisions(d => d.slice(0, -1))
    setIndex(i => Math.max(i - 1, 0))
  }, [])

  const exitSession = useCallback(() => {
    setPhase('pick')
    setPlaylist(null)
    setDecisions([])
    setIndex(0)
  }, [])

  const kept = decisions.filter(d => d.keep)
  const cut  = decisions.filter(d => !d.keep)

  // ── Writes (the only destructive-adjacent code in the app — confirm-gated) ──
  const handleWriteError = (e: unknown) => {
    setBusy(null)
    if (e instanceof ApiError && e.status === 403) {
      setScopeStatus('missing')   // pre-v1.3 token → summary shows the reconnect button
    } else {
      setWriteError(e instanceof Error ? e.message : 'Something went wrong. Nothing was changed.')
    }
  }

  // Instant (2.0.36): both show as done at once and go to Spotify in the background
  // through the outbox (utils/outbox), which retries until they land — no waiting on
  // the server, which may be asleep.
  const doSaveAsNew = () => {
    if (!playlist) return
    setConfirm(null)
    setWriteError(null)
    const uris = kept.map(d => d.track.uri!).filter(Boolean)
    const name = `${playlist.name} (refreshed)`.slice(0, 100)
    enqueue({ kind: 'create', name, uris, description: `Refreshed with playlist.lens — kept ${uris.length} of ${decisions.length} tracks` })
    setDone({ kind: 'created', name, added: uris.filter(u => u.startsWith('spotify:track:')).length, skippedLocal: uris.filter(u => !u.startsWith('spotify:track:')).length })
    setPhase('done')
    haptic.success()
  }

  const doTrim = () => {
    if (!playlist) return
    setConfirm(null)
    setWriteError(null)
    const cutUris = cut.map(d => d.track.uri!).filter(Boolean)
    // Named here (the server's own pattern) so the done screen can say it straight away.
    const backupName = `playlist.lens backup — ${playlist.name} — ${new Date().toISOString().slice(0, 10)}`.slice(0, 100)
    enqueue({ kind: 'trim', playlistId: playlist.id, backupName, cutUris })
    setDone({ kind: 'trimmed', backupName, removed: cutUris.length })
    setPhase('done')
    haptic.success()
  }

  // ── Shared chrome ──
  const Header = (
    <TabHeader
      title="swipe"
      subtitle={phase === 'swipe' && playlist
        ? `${playlist.name} · ${Math.min(index + 1, swipeable.length)} of ${swipeable.length}`
        : 'Refresh a playlist with swipes'}
    />
  )

  return (
    <View style={styles.container}>

      <SafeAreaView style={styles.safe} edges={['top']}>
        {Header}

        {/* ════ PICK ════ */}
        {phase === 'pick' && (
          <View style={styles.pickWrap}>
            {scopes === 'missing' && (
              <Card tone="accent" style={styles.reconnectCard}>
                <ListRow icon="sync" label={authLoading ? 'Opening Spotify…' : 'Reconnect Spotify'}
                  hint="Needed to save swipes back to your account" onPress={() => !authLoading && login()} last />
              </Card>
            )}
            <View style={styles.pickWrap}>
            <FlatList
              data={editable}
              keyExtractor={p => p.id}
              contentContainerStyle={[styles.pickList, { paddingBottom: 140 + gutter }]}
              showsVerticalScrollIndicator={false}
              onScroll={e => { scrollY.value = e.nativeEvent.contentOffset.y }}
              scrollEventThrottle={16}
              ListHeaderComponent={
                <Text style={[Type.overline, styles.pickHint]}>pick a playlist to clean up</Text>
              }
              ListEmptyComponent={
                plStatus === 'loading' || plStatus === 'idle'
                  ? <ActivityIndicator color={Colors.greenPrimary} style={{ marginTop: Spacing['3xl'] }} />
                  : <EmptyState icon="layers-outline" title="No playlists to swipe" body="Swipe works on playlists you own or collaborate on — make one in Spotify first." />
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickRow} onPress={() => startSession(item)} activeOpacity={0.7}>
                  {item.images?.[0]?.url ? (
                    <Image source={{ uri: item.images[0].url }} style={styles.pickArt} contentFit="cover" />
                  ) : (
                    <View style={[styles.pickArt, styles.pickArtFallback]}>
                      <Icon name="musical-notes" style={styles.pickArtGlyph} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.pickMeta}>
                      {item.tracks?.total ?? 0} tracks{(item.tracks?.total ?? 0) > 500 ? ' · first 500 swiped' : ''}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={15} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            />
            </View>
          </View>
        )}

        {/* ════ SWIPE ════ */}
        {phase === 'swipe' && (
          <View style={styles.sessionWrap}>
            {trStatus === 'loading' || !swipeable.length ? (
              <View style={styles.center}>
                <ActivityIndicator color={Colors.greenPrimary} />
                <Text style={styles.loadingText}>loading tracks…</Text>
              </View>
            ) : (
              <SwipeDeck
                track={swipeable[index]}
                nextTrack={swipeable[index + 1] ?? null}
                onDecide={onDecide}
                onUndo={onUndo}
                canUndo={decisions.length > 0}
              />
            )}
            <View style={styles.exitBtn}>
              <Chip label="Exit session" icon="close" onPress={() => { decisions.length ? setExitConfirm(true) : exitSession() }} />
            </View>
          </View>
        )}

        {/* ════ SUMMARY ════ */}
        {phase === 'summary' && playlist && (
          <View style={styles.center}>
            <Text style={styles.summaryTitle}>That's the deck.</Text>
            <Card padded style={styles.summaryCard}>
              <Stat value={kept.length.toLocaleString()} label="kept" style={{ flex: 1 }} />
              <Stat value={cut.length.toLocaleString()} label="cut" style={{ flex: 1 }} />
            </Card>

            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color={Colors.greenPrimary} />
                <Text style={styles.busyText}>{busy}</Text>
              </View>
            ) : scopes === 'missing' ? (
              <Button label={authLoading ? 'Opening Spotify…' : 'Reconnect Spotify to save'} icon="sync" onPress={() => !authLoading && login()} style={styles.wide} />
            ) : cut.length === 0 ? (
              <Text style={styles.allKeptText}>You kept everything — nothing to change</Text>
            ) : (
              <>
                <Button label="Save kept as a new playlist" icon="add-circle-outline" onPress={() => setConfirm('create')} style={styles.wide} />
                <Button label="Trim the original (backup first)" icon="cut" variant="secondary" onPress={() => setConfirm('trim')} style={styles.wide} />
              </>
            )}

            {writeError && <Text style={styles.errorText}>{writeError}</Text>}

            <Button label="Start over" variant="ghost" size="sm" onPress={exitSession} style={styles.linkBtn} />
          </View>
        )}

        {/* ════ DONE ════ */}
        {phase === 'done' && done && (
          <View style={styles.center}>
            <Icon name="sparkles" style={styles.doneGlyph} />
            <Text style={styles.summaryTitle}>
              {done.kind === 'created' ? 'Playlist created' : 'Playlist trimmed'}
            </Text>
            <Text style={styles.doneText}>
              {done.kind === 'created'
                ? `"${done.name}" — ${done.added} tracks.` +
                  (done.skippedLocal ? `\n${done.skippedLocal} local file${done.skippedLocal > 1 ? 's' : ''} couldn't be copied.` : '')
                : `Removed ${done.removed} track${done.removed === 1 ? '' : 's'}.\nBackup saved as "${done.backupName}".`}
            </Text>
            <Button label="Done" onPress={exitSession} style={styles.wide} />
          </View>
        )}
      </SafeAreaView>

      {/* Mandatory pre-write confirms */}
      <ConfirmModal
        visible={confirm === 'create'}
        glyph="heart"
        title="Save as new playlist?"
        message={`Creates "${playlist?.name ?? ''} (refreshed)" with the ${kept.length} tracks you kept. The original stays exactly as it is.`}
        confirmLabel="Create"
        cancelLabel="Back"
        onConfirm={doSaveAsNew}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        visible={confirm === 'trim'}
        glyph="cut"
        title="Trim the original?"
        message={`First a full private backup of "${playlist?.name ?? ''}" is saved to your account, then the ${cut.length} cut track${cut.length === 1 ? '' : 's'} are removed from the original.`}
        confirmLabel="Back up & trim"
        cancelLabel="Back"
        onConfirm={doTrim}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        visible={exitConfirm}
        glyph="exit-outline"
        title="Leave this session?"
        message="Your swipes so far will be discarded — nothing has been saved to Spotify."
        confirmLabel="Leave"
        cancelLabel="Keep swiping"
        onConfirm={() => { setExitConfirm(false); exitSession() }}
        onCancel={() => setExitConfirm(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  summaryCard: { flexDirection: 'row', gap: Spacing.md, alignSelf: 'stretch', marginHorizontal: Spacing.lg },
  wide:        { alignSelf: 'stretch', marginHorizontal: Spacing.lg },

  container: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1, zIndex: 1 },


  // pick
  reconnectCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  pickWrap: { flex: 1 },
  pickList: { paddingHorizontal: Spacing.lg, paddingBottom: 140 },
  pickHint: { marginBottom: Spacing.md, paddingLeft: Spacing.xs },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.glassBorder,
    backgroundColor: Colors.glass, marginBottom: Spacing.sm,
  },
  pickArt: { width: 46, height: 46, borderRadius: Radius.sm },
  pickArtFallback: { backgroundColor: Colors.greenSubtle, alignItems: 'center', justifyContent: 'center' },
  pickArtGlyph: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.lg, color: Colors.greenPrimary },
  pickName: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  pickMeta: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },

  // swipe
  sessionWrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingBottom: 80, paddingHorizontal: Spacing.xl },
  loadingText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },
  exitBtn: { alignSelf: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.lg },

  // summary / done
  summaryTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
  busyText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  allKeptText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  errorText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.error, textAlign: 'center', maxWidth: 280 },
  linkBtn: { paddingVertical: Spacing.xs },
  doneGlyph: { fontFamily: FontFamily.syneBold, fontSize: 44, color: Colors.greenPrimary },
  doneText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
})
