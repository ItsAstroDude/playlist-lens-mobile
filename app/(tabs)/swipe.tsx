import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSharedValue } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, alpha } from '@/constants/theme'
import { TopFade } from '@/components/ui/TopFade'
import { useNowPlayingGutter } from '@/hooks/useNowPlayingGutter'
import { haptic } from '@/constants/animation'
import { api, ApiError } from '@/utils/api'
import { deleteCache, CacheKeys } from '@/utils/cache'
import { setTabBarHidden } from '@/utils/tabBar'
import { getScopeStatus, setScopeStatus, onScopeStatus } from '@/utils/scopeStatus'
import { usePlaylists, usePlaylistTracks } from '@/hooks/useSpotify'
import { useAuth } from '@/hooks/useAuth'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { SwipeDeck } from '@/components/swipe/SwipeDeck'
import type { SpotifyPlaylist, SpotifyTrack } from '@/types'

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
    setTabBarHidden(phase === 'swipe')
    return () => setTabBarHidden(false)
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

  const doSaveAsNew = async () => {
    if (!playlist) return
    setConfirm(null)
    setBusy('Creating your new playlist…')
    setWriteError(null)
    try {
      const uris = kept.map(d => d.track.uri!).filter(Boolean)
      const res = await api.post<{ name: string; added: number; skipped_local: number }>(
        '/api/playlist/create',
        {
          name: `${playlist.name} (refreshed)`,
          uris,
          description: `Refreshed with playlist.lens — kept ${uris.length} of ${decisions.length} tracks`,
        },
      )
      deleteCache(CacheKeys.playlists)
      setBusy(null)
      setDone({ kind: 'created', name: res.name, added: res.added, skippedLocal: res.skipped_local })
      setPhase('done')
      haptic.success()
    } catch (e) { handleWriteError(e) }
  }

  const doTrim = async () => {
    if (!playlist) return
    setConfirm(null)
    setWriteError(null)
    setBusy('Backing up the original…')
    try {
      const backup = await api.post<{ name: string }>(`/api/playlist/${playlist.id}/duplicate`, {})
      setBusy('Trimming the playlist…')
      const cutUris = cut.map(d => d.track.uri!).filter(Boolean)
      const res = await api.post<{ removed: number }>(`/api/playlist/${playlist.id}/remove`, { uris: cutUris })
      deleteCache(CacheKeys.playlistAnalysis(playlist.id))
      deleteCache(CacheKeys.playlists)
      setBusy(null)
      setDone({ kind: 'trimmed', backupName: backup.name, removed: res.removed })
      setPhase('done')
      haptic.success()
    } catch (e) { handleWriteError(e) }
  }

  // ── Shared chrome ──
  const Header = (
    <>
      <View style={styles.header}>
        <Text style={styles.logo}>playlist<Text style={styles.dot}>.</Text>lens</Text>
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>swipe</Text>
        <Text style={styles.sub}>
          {phase === 'swipe' && playlist
            ? `${playlist.name} · ${Math.min(index + 1, swipeable.length)} of ${swipeable.length}`
            : 'Refresh a playlist with swipes'}
        </Text>
      </View>
    </>
  )

  return (
    <View style={styles.container}>
      <View style={styles.ambientViolet} pointerEvents="none" />
      <View style={styles.ambientPink}   pointerEvents="none" />
      <LinearGradient colors={[Colors.auroraTop, Colors.auroraBot]} style={styles.aurora} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {Header}

        {/* ════ PICK ════ */}
        {phase === 'pick' && (
          <View style={styles.pickWrap}>
            {scopes === 'missing' && (
              <TouchableOpacity style={styles.reconnectCard} onPress={() => !authLoading && login()} activeOpacity={0.8}>
                <Ionicons name="sync" size={15} color={Colors.greenPrimary} />
                <Text style={styles.reconnectText}>
                  {authLoading ? 'Opening Spotify…' : 'Reconnect Spotify to save swipes back to your account'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
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
                <Text style={styles.pickHint}>Pick one of your playlists to clean up:</Text>
              }
              ListEmptyComponent={
                plStatus === 'loading' || plStatus === 'idle'
                  ? <ActivityIndicator color={Colors.greenPrimary} style={{ marginTop: Spacing['3xl'] }} />
                  : <Text style={styles.emptyText}>No playlists you own yet — make one in Spotify first.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickRow} onPress={() => startSession(item)} activeOpacity={0.7}>
                  {item.images?.[0]?.url ? (
                    <Image source={{ uri: item.images[0].url }} style={styles.pickArt} contentFit="cover" />
                  ) : (
                    <View style={[styles.pickArt, styles.pickArtFallback]}>
                      <Text style={styles.pickArtGlyph}>♪</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.pickMeta}>
                      {item.tracks?.total ?? 0} tracks{(item.tracks?.total ?? 0) > 500 ? ' · first 500 swiped' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={Colors.textDim} />
                </TouchableOpacity>
              )}
            />
            <TopFade scrollY={scrollY} />
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
            <TouchableOpacity
              style={styles.exitBtn}
              onPress={() => { haptic.light(); decisions.length ? setExitConfirm(true) : exitSession() }}
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color={Colors.textMuted} />
              <Text style={styles.exitText}>exit session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ════ SUMMARY ════ */}
        {phase === 'summary' && playlist && (
          <View style={styles.center}>
            <Text style={styles.summaryTitle}>That's the deck.</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryChip}>
                <Text style={[styles.summaryVal, { color: Colors.greenPrimary }]}>{kept.length}</Text>
                <Text style={styles.summaryLbl}>kept</Text>
              </View>
              <View style={styles.summaryChip}>
                <Text style={[styles.summaryVal, { color: Colors.error }]}>{cut.length}</Text>
                <Text style={styles.summaryLbl}>cut</Text>
              </View>
            </View>

            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color={Colors.greenPrimary} />
                <Text style={styles.busyText}>{busy}</Text>
              </View>
            ) : scopes === 'missing' ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => !authLoading && login()} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>
                  {authLoading ? 'Opening Spotify…' : 'Reconnect Spotify to save'}
                </Text>
              </TouchableOpacity>
            ) : cut.length === 0 ? (
              <Text style={styles.allKeptText}>You kept everything — nothing to change ✦</Text>
            ) : (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => { haptic.medium(); setConfirm('create') }} activeOpacity={0.85}>
                  <Text style={styles.primaryBtnText}>Save kept as new playlist</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => { haptic.medium(); setConfirm('trim') }} activeOpacity={0.8}>
                  <Text style={styles.secondaryBtnText}>Trim original (backup first)</Text>
                </TouchableOpacity>
              </>
            )}

            {writeError && <Text style={styles.errorText}>{writeError}</Text>}

            <TouchableOpacity onPress={() => { haptic.light(); exitSession() }} style={styles.linkBtn}>
              <Text style={styles.linkText}>start over</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ════ DONE ════ */}
        {phase === 'done' && done && (
          <View style={styles.center}>
            <Text style={styles.doneGlyph}>✦</Text>
            <Text style={styles.summaryTitle}>
              {done.kind === 'created' ? 'Playlist created' : 'Playlist trimmed'}
            </Text>
            <Text style={styles.doneText}>
              {done.kind === 'created'
                ? `"${done.name}" — ${done.added} tracks.` +
                  (done.skippedLocal ? `\n${done.skippedLocal} local file${done.skippedLocal > 1 ? 's' : ''} couldn't be copied.` : '')
                : `Removed ${done.removed} track${done.removed === 1 ? '' : 's'}.\nBackup saved as "${done.backupName}".`}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { haptic.light(); exitSession() }} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Mandatory pre-write confirms */}
      <ConfirmModal
        visible={confirm === 'create'}
        glyph="♥"
        title="Save as new playlist?"
        message={`Creates "${playlist?.name ?? ''} (refreshed)" with the ${kept.length} tracks you kept. The original stays exactly as it is.`}
        confirmLabel="Create"
        cancelLabel="Back"
        onConfirm={doSaveAsNew}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        visible={confirm === 'trim'}
        glyph="✂"
        title="Trim the original?"
        message={`First a full private backup of "${playlist?.name ?? ''}" is saved to your account, then the ${cut.length} cut track${cut.length === 1 ? '' : 's'} are removed from the original.`}
        confirmLabel="Back up & trim"
        cancelLabel="Back"
        onConfirm={doTrim}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        visible={exitConfirm}
        glyph="✕"
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
  container: { flex: 1, backgroundColor: Colors.background },
  ambientViolet: { position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.violetGlow },
  ambientPink:   { position: 'absolute', bottom: -100, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: Colors.pinkGlow },
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  safe: { flex: 1, zIndex: 1 },

  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  logo: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, letterSpacing: -1 },
  dot: { color: Colors.greenPrimary },
  titleBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: 3 },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1 },
  sub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },

  // pick
  reconnectCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg, borderWidth: 1,
    borderColor: alpha(Colors.greenPrimary, 0.35), backgroundColor: Colors.greenSubtle,
  },
  reconnectText: { flex: 1, fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.text },
  pickWrap: { flex: 1 },
  pickList: { paddingHorizontal: Spacing.lg, paddingBottom: 140 },
  pickHint: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  emptyText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing['3xl'] },
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
  exitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.lg,
  },
  exitText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },

  // summary / done
  summaryTitle: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1 },
  summaryRow: { flexDirection: 'row', gap: Spacing.md },
  summaryChip: {
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing['2xl'],
    alignItems: 'center', minWidth: 110,
  },
  summaryVal: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], letterSpacing: -1 },
  summaryLbl: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
  busyText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary },
  allKeptText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  primaryBtn: {
    backgroundColor: Colors.greenPrimary, borderRadius: Radius.full,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing['3xl'],
    alignItems: 'center', minWidth: 240, marginTop: Spacing.sm,
  },
  primaryBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.background },
  secondaryBtn: {
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.glassBorder,
    backgroundColor: Colors.glass,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing['3xl'],
    alignItems: 'center', minWidth: 240,
  },
  secondaryBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.textSecondary },
  errorText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.error, textAlign: 'center', maxWidth: 280 },
  linkBtn: { paddingVertical: Spacing.xs },
  linkText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textDim, textDecorationLine: 'underline' },
  doneGlyph: { fontFamily: FontFamily.syneBold, fontSize: 44, color: Colors.greenPrimary },
  doneText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
})
