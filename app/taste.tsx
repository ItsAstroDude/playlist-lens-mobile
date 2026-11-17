import React, { useEffect, useCallback, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Keyboard, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay,
  withTiming, withRepeat, Easing, FadeIn,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { Screen, ScreenHeader, Section, Card, Button, EmptyState as DSEmptyState } from '@/components/ui'
import { Spring, haptic } from '@/constants/animation'
import { useTasteProfile } from '@/hooks/useTasteProfile'
import { TopFade } from '@/components/ui/TopFade'
import { usePlaylists } from '@/hooks/useSpotify'
import { RadarChart } from '@/components/ui/RadarChart'
import { WrappedItemSheet, type WrappedSelection } from '@/components/wrapped/WrappedItemSheet'
import { withMemorialMark } from '@/utils/tribute'
import { vibeColor } from '@/utils/color'
import type { TasteProfile } from '@/types'
import { Icon } from '@/components/ui/Icon'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeCompatibility(mine: TasteProfile, theirs: TasteProfile): number {
  const myGenres    = new Set(mine.topGenres.slice(0, 10).map(g => g.genre))
  const theirGenres = theirs.topGenres.slice(0, 10).map(g => g.genre)
  const overlap     = theirGenres.filter(g => myGenres.has(g)).length
  const genreScore  = overlap / Math.max(myGenres.size, 1)

  if (mine.af && theirs.af) {
    const dims: Array<keyof typeof mine.af> = ['energy', 'valence', 'danceability', 'acousticness']
    const dist = dims.reduce((sum, k) => {
      return sum + Math.abs((mine.af![k] as number) - (theirs.af![k] as number))
    }, 0) / dims.length
    return Math.round((genreScore * 0.5 + (1 - dist) * 0.5) * 100)
  }
  return Math.round(genreScore * 100)
}

function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean
}

// ─── Vibe pill ────────────────────────────────────────────────────────────────
function VibePill({ vibe }: { vibe: string }) {
  const color = vibeColor(vibe)
  const pulse = useSharedValue(1)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.35, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true)
  }, [])
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))
  return (
    <View style={[v_styles.pill, { backgroundColor: `${color}14`, borderColor: `${color}40` }]}>
      <Animated.View style={[v_styles.dot, dotStyle, { backgroundColor: color }]} />
      <Text style={[v_styles.text, { color }]}>{vibe}</Text>
    </View>
  )
}
const v_styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'center', borderWidth: 1, borderRadius: Radius.full, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: FontFamily.mono, fontSize: FontSize.sm },
})

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={s_styles.pill}>
      <Text style={s_styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      <Text style={s_styles.label}>{label}</Text>
    </View>
  )
}
const s_styles = StyleSheet.create({
  pill:  { flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, alignItems: 'center', gap: 2 },
  value: { fontFamily: FontFamily.display, fontSize: FontSize.md, fontWeight: '700', color: Colors.text, letterSpacing: -0.5, alignSelf: 'stretch', textAlign: 'center' },
  label: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
})

// ─── Artist bar ───────────────────────────────────────────────────────────────
function ArtistBar({ name, count, maxCount, rank, onPress }: { name: string; count: number; maxCount: number; rank: number; onPress?: () => void }) {
  const w = useSharedValue(0)
  const frac = count / Math.max(maxCount, 1)
  const barStyle = useAnimatedStyle(() => ({ width: `${w.value}%` as any }))
  useEffect(() => { w.value = withDelay(rank * 60, withSpring(frac * 100, { mass: 1, damping: 20, stiffness: 100 })) }, [frac])
  const inner = (
    <View style={a_styles.row}>
      <Text style={a_styles.rank}>{rank}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={a_styles.name} numberOfLines={1}>{name}</Text>
        <View style={a_styles.track}><Animated.View style={[a_styles.fill, barStyle]} /></View>
      </View>
      <Text style={a_styles.count}>{count}</Text>
    </View>
  )
  return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{inner}</TouchableOpacity> : inner
}
const a_styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 3 },
  rank:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 16, textAlign: 'right' },
  name:  { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  track: { height: 3, backgroundColor: Colors.glass, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  fill:  { height: '100%', backgroundColor: Colors.greenPrimary, borderRadius: 2, opacity: 0.7 },
  count: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 28, textAlign: 'right' },
})

// ─── Section head (divider w/ label) ──────────────────────────────────────────

// ─── Compatibility bar ────────────────────────────────────────────────────────
function CompatBar({ pct }: { pct: number }) {
  const w = useSharedValue(0)
  useEffect(() => { w.value = withDelay(200, withSpring(pct, { mass: 1, damping: 20, stiffness: 80 })) }, [pct])
  const barStyle = useAnimatedStyle(() => ({ width: `${w.value}%` as any }))
  const color = pct >= 75 ? Colors.greenPrimary : pct >= 50 ? Colors.lavender : pct >= 30 ? Colors.pink : Colors.textMuted
  return (
    <View style={c_styles.wrap}>
      <View style={c_styles.track}><Animated.View style={[c_styles.fill, barStyle, { backgroundColor: color }]} /></View>
      <Text style={[c_styles.pct, { color }]}>{pct}%</Text>
    </View>
  )
}
const c_styles = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: { flex: 1, height: 6, backgroundColor: Colors.glass, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: Colors.glassBorder },
  fill:  { height: '100%', borderRadius: 3 },
  pct:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.lg, letterSpacing: -0.5, width: 48, textAlign: 'right' },
})

// ─── Friend result card ───────────────────────────────────────────────────────
function FriendCard({ theirs, mine }: { theirs: TasteProfile; mine: TasteProfile | null }) {
  const compat = mine ? computeCompatibility(mine, theirs) : null
  const genreAccents = [Colors.greenPrimary, Colors.pink, Colors.lavender]
  const sharedGenres = mine
    ? (() => { const mySet = new Set(mine.topGenres.map(g => g.genre)); return theirs.topGenres.filter(g => mySet.has(g.genre)).slice(0, 6) })()
    : []
  return (
    <Animated.View entering={FadeIn.duration(300)} style={f_styles.card}>
      <View style={f_styles.specular} />
      <View style={f_styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={f_styles.name}>{theirs.name || 'Anonymous listener'}</Text>
          <Text style={f_styles.meta}>{theirs.playlistCount} lenses · {theirs.trackCount.toLocaleString()} tracks</Text>
        </View>
        {theirs.vibe && (
          <View style={f_styles.vibePill}><Text style={f_styles.vibeText} numberOfLines={1}>{theirs.vibe}</Text></View>
        )}
      </View>
      {compat !== null && (
        <View style={f_styles.section}>
          <Text style={f_styles.sectionLabel}>TASTE MATCH</Text>
          <CompatBar pct={compat} />
        </View>
      )}
      {theirs.af && (
        <View style={f_styles.section}>
          <Text style={f_styles.sectionLabel}>AUDIO PROFILE</Text>
          <View style={{ alignItems: 'center' }}>
            <RadarChart acousticness={theirs.af.acousticness} danceability={theirs.af.danceability} energy={theirs.af.energy} valence={theirs.af.valence} instrumentalness={theirs.af.instrumentalness} liveness={theirs.af.liveness} color={Colors.lavender} size={180} />
          </View>
        </View>
      )}
      {theirs.topArtists.length > 0 && (
        <View style={f_styles.section}>
          <Text style={f_styles.sectionLabel}>TOP ARTISTS</Text>
          {theirs.topArtists.slice(0, 5).map((a, i) => (
            <View key={a.id} style={f_styles.artistRow}>
              <Text style={f_styles.artistRank}>{i + 1}</Text>
              <Text style={f_styles.artistName} numberOfLines={1}>{a.name}</Text>
            </View>
          ))}
        </View>
      )}
      {sharedGenres.length > 0 && (
        <View style={f_styles.section}>
          <Text style={f_styles.sectionLabel}>YOU BOTH LIKE</Text>
          <View style={f_styles.genreCloud}>
            {sharedGenres.map((g, i) => (
              <View key={g.genre} style={[f_styles.genrePill, { borderColor: `${genreAccents[i % 3]}30` }]}>
                <Text style={[f_styles.genreText, { color: genreAccents[i % 3] }]}>{g.genre}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  )
}
const f_styles = StyleSheet.create({
  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.lg, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.lg },
  specular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  name: { fontFamily: FontFamily.display, fontSize: FontSize.lg, color: Colors.text, letterSpacing: -0.5 },
  meta: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  vibePill: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.full, paddingVertical: 3, paddingHorizontal: Spacing.sm, maxWidth: 140 },
  vibeText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.lavender },
  section: { gap: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 },
  artistRank: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 16, textAlign: 'right' },
  artistName: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  genreCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  genrePill: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: Colors.glass },
  genreText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs },
})

// ─── Profile (playlist aggregate) ─────────────────────────────────────────────
function ProfileContent({ profile, onSelectArtist }: { profile: TasteProfile; onSelectArtist: (s: WrappedSelection) => void }) {
  const maxArtistCount = profile.topArtists[0]?.count ?? 1
  const genreAccents   = [Colors.greenPrimary, Colors.pink, Colors.lavender]
  const artistCount    = profile.artistCount ?? profile.topArtists.length
  return (
    <>
      <View style={styles.statRow}>
        <StatPill value={profile.playlistCount.toString()} label="lenses" />
        <StatPill value={profile.trackCount.toLocaleString()} label="tracks" />
        <StatPill value={artistCount.toLocaleString()} label="artists" />
      </View>
      {profile.vibe && <VibePill vibe={profile.vibe} />}
      {profile.af && (
        <View style={styles.card}>
          <View style={styles.cardSpecular} />
          <Text style={styles.sectionLabel}>AUDIO FINGERPRINT</Text>
          <View style={{ alignItems: 'center' }}>
            <RadarChart acousticness={profile.af.acousticness} danceability={profile.af.danceability} energy={profile.af.energy} valence={profile.af.valence} instrumentalness={profile.af.instrumentalness} liveness={profile.af.liveness} color={Colors.greenPrimary} size={200} />
          </View>
          {profile.af.avgTempo > 0 && <Text style={styles.bpmText}>{Math.round(profile.af.avgTempo)} BPM avg</Text>}
        </View>
      )}
      {profile.topGenres.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardSpecular} />
          <Text style={styles.sectionLabel}>TOP GENRES</Text>
          <View style={styles.genreCloud}>
            {profile.topGenres.map((g, i) => (
              <View key={g.genre} style={[styles.genrePill, { borderColor: `${genreAccents[i % 3]}30` }]}>
                <Text style={[styles.genreText, { color: genreAccents[i % 3] }]}>{g.genre}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {profile.topArtists.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardSpecular} />
          <Text style={styles.sectionLabel}>CORE ARCHITECTS</Text>
          {profile.topArtists.slice(0, 10).map((a, i) => (
            <ArtistBar key={a.id} rank={i + 1} name={withMemorialMark(a.name)} count={a.count} maxCount={maxArtistCount}
              onPress={() => onSelectArtist({ kind: 'artist', name: a.name, rank: i + 1, tracks: a.count, accent: Colors.greenPrimary })} />
          ))}
        </View>
      )}
    </>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TasteScreen() {
  const { fetch: fetchPlaylists, data: playlists } = usePlaylists()
  const {
    profile, shareCode, friendProfile, status, errorMsg, scanProgress,
    buildFromCache, scanAll, saveProfile, loadFriend,
  } = useTasteProfile()

  const [scanBtnVisible, setScanBtnVisible] = useState(false)
  const [codeInput, setCodeInput]           = useState('')
  const [sel, setSel]                       = useState<WrappedSelection | null>(null)

  useEffect(() => {
    buildFromCache()
    fetchPlaylists().then(pls => { if (pls && pls.length > 0) setScanBtnVisible(true) })
  }, [])

  const uncachedCount = useMemo(() => {
    if (!playlists || !profile) return playlists?.length ?? 0
    return Math.max(0, playlists.length - profile.playlistCount)
  }, [playlists, profile])

  const handleScanAll = useCallback(async () => {
    if (!playlists) return
    haptic.medium()
    await scanAll(playlists)
  }, [playlists, scanAll])

  const handleGenerate = useCallback(async () => {
    if (!profile) return
    haptic.light()
    const code = await saveProfile(profile)
    if (code) await Share.share({ message: `Check out my music taste on playlist.lens! Enter my code: ${code}` })
  }, [profile, saveProfile])

  const handleShare = useCallback(async () => {
    if (!shareCode) return
    haptic.light()
    await Share.share({ message: `Check out my music taste on playlist.lens! Enter my code: ${shareCode}` })
  }, [shareCode])

  const handleLoad = useCallback(async () => {
    if (codeInput.replace(/-/g, '').length < 6) return
    Keyboard.dismiss()
    haptic.light()
    await loadFriend(codeInput)
  }, [codeInput, loadFriend])

  const isScanning      = status === 'scanning'
  const isSaving        = status === 'saving'
  const isLoadingFriend = status === 'loading-friend'
  const canLoad         = codeInput.replace(/-/g, '').length === 6

  return (
    <Screen
      scrollProps={{ keyboardShouldPersistTaps: 'handled' }}
      overlay={<WrappedItemSheet selection={sel} onClose={() => setSel(null)} />}
    >
      <ScreenHeader title="taste" subtitle={profile ? `Across ${profile.playlistCount} analysed playlist${profile.playlistCount === 1 ? '' : 's'}` : 'Your aggregate taste profile'} />

      {isScanning && (
        <Card padded style={styles.scanCard}>
          <ActivityIndicator size="small" color={Colors.greenPrimary} />
          <Text style={Type.caption}>Scanning {scanProgress.done}/{scanProgress.total} playlists…</Text>
        </Card>
      )}

      {profile ? <ProfileContent profile={profile} onSelectArtist={setSel} /> : !isScanning ? (
        <DSEmptyState
          icon="aperture-outline"
          title="No taste profile yet"
          body="It's built from your analysed playlists. Scan them all at once, or open a few in Lenses."
          actionLabel={playlists?.length ? 'Scan my playlists' : undefined}
          onAction={playlists?.length ? handleScanAll : undefined}
        />
      ) : null}

      {profile && !isScanning && scanBtnVisible && uncachedCount > 0 && (
        <Button label={`Scan ${uncachedCount} more playlist${uncachedCount !== 1 ? 's' : ''}`} icon="scan" variant="secondary" onPress={handleScanAll} />
      )}

      {/* ── Share your taste ── */}
      {profile && (
        <Section label="your code">
          <View style={styles.codeCard}>
            {shareCode ? (
              <>
                <Text style={[Type.caption, styles.center]}>Friends enter this to see your taste</Text>
                <View style={my_styles.codeBox}><Text style={my_styles.code} selectable>{shareCode}</Text></View>
                <Button label="Share code" icon="share-outline" onPress={handleShare} />
              </>
            ) : (
              <>
                <Text style={[Type.caption, styles.center]}>Generate a 6-character code so friends can view your taste profile.</Text>
                <Button label="Generate & share" icon="share-outline" onPress={handleGenerate} loading={isSaving} />
              </>
            )}
          </View>
        </Section>
      )}

      {/* ── Load a friend ── */}
      <Section label="load a friend" footer={errorMsg && status === 'error' ? errorMsg : undefined}>
        <View style={styles.friendRow}>
          <TextInput
            style={styles.input}
            value={codeInput}
            onChangeText={t => setCodeInput(formatCode(t))}
            placeholder="ABC-123"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            returnKeyType="search"
            onSubmitEditing={handleLoad}
            selectionColor={Colors.greenPrimary}
            accessibilityLabel="Friend's taste code"
          />
          <Button label="Load" size="sm" onPress={handleLoad} disabled={!canLoad} loading={isLoadingFriend} style={styles.loadBtn} />
        </View>
      </Section>

      {friendProfile && <FriendCard theirs={friendProfile} mine={profile} />}
    </Screen>
  )
}

// ─── Your-code card styles ────────────────────────────────────────────────────
const my_styles = StyleSheet.create({
  codeBox: { backgroundColor: alpha(Colors.greenPrimary, 0.08), borderWidth: 1, borderColor: alpha(Colors.greenPrimary, 0.25), borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing['2xl'] },
  code: { fontFamily: FontFamily.monoMedium, fontSize: 28, color: Colors.greenPrimary, letterSpacing: 6 },
})

// ─── Screen styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scanCard:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  codeCard:  { padding: Spacing.lg, gap: Spacing.md, alignItems: 'stretch' },
  center:    { textAlign: 'center' },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },


  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },


  statRow: { flexDirection: 'row', gap: Spacing.sm },

  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.lg, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.sm },
  cardSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  sectionLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.xs },
  bpmText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs },

  genreCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  genrePill: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: Colors.glass },
  genreText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs },


  input: { flex: 1, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, fontFamily: FontFamily.monoMedium, fontSize: FontSize.lg, color: Colors.text, letterSpacing: 3 },
  loadBtn: { minWidth: 72 },

})
