import React, { useEffect, useCallback, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Keyboard, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay,
  withTiming, withRepeat, Easing, FadeIn,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useTasteProfile } from '@/hooks/useTasteProfile'
import { usePlaylists } from '@/hooks/useSpotify'
import { RadarChart } from '@/components/ui/RadarChart'
import { vibeColor } from '@/utils/color'
import type { TasteProfile } from '@/types'

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
function ArtistBar({ name, count, maxCount, rank }: { name: string; count: number; maxCount: number; rank: number }) {
  const w = useSharedValue(0)
  const frac = count / Math.max(maxCount, 1)
  const barStyle = useAnimatedStyle(() => ({ width: `${w.value}%` as any }))
  useEffect(() => { w.value = withDelay(rank * 60, withSpring(frac * 100, { mass: 1, damping: 20, stiffness: 100 })) }, [frac])
  return (
    <View style={a_styles.row}>
      <Text style={a_styles.rank}>{rank}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={a_styles.name} numberOfLines={1}>{name}</Text>
        <View style={a_styles.track}><Animated.View style={[a_styles.fill, barStyle]} /></View>
      </View>
      <Text style={a_styles.count}>{count}</Text>
    </View>
  )
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
function SectionHead({ label }: { label: string }) {
  return (
    <View style={h_styles.row}>
      <View style={h_styles.line} />
      <Text style={h_styles.label}>{label}</Text>
      <View style={h_styles.line} />
    </View>
  )
}
const h_styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  line:  { flex: 1, height: 1, backgroundColor: Colors.glassBorder },
  label: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
})

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
  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.lg },
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
function ProfileContent({ profile }: { profile: TasteProfile }) {
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
            <ArtistBar key={a.id} rank={i + 1} name={a.name} count={a.count} maxCount={maxArtistCount} />
          ))}
        </View>
      )}
    </>
  )
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>◎</Text>
      <Text style={styles.emptyTitle}>No data yet</Text>
      <Text style={styles.emptyDesc}>Open some playlists in the Lenses tab to build{'\n'}your taste profile.</Text>
    </View>
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
    <View style={styles.container}>
      <View style={styles.ambientViolet} pointerEvents="none" />
      <View style={styles.ambientPink}   pointerEvents="none" />
      <LinearGradient colors={[Colors.auroraTop, Colors.auroraBot]} style={styles.aurora} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.heading}>taste</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {isScanning && (
            <View style={styles.scanBanner}>
              <ActivityIndicator size="small" color={Colors.greenPrimary} />
              <Text style={styles.scanText}>Scanning {scanProgress.done}/{scanProgress.total} playlists…</Text>
            </View>
          )}

          {profile ? <ProfileContent profile={profile} /> : !isScanning ? <EmptyState /> : null}

          {!isScanning && scanBtnVisible && uncachedCount > 0 && (
            <TouchableOpacity style={styles.scanBtn} onPress={handleScanAll} activeOpacity={0.75}>
              <Text style={styles.scanBtnText}>⟳  Scan {uncachedCount} more playlist{uncachedCount !== 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}

          {/* ── Share your taste ── */}
          {profile && (
            <>
              <SectionHead label="Your Code" />
              <View style={my_styles.card}>
                <View style={my_styles.specular} />
                {shareCode ? (
                  <>
                    <Text style={my_styles.hint}>Your taste code</Text>
                    <View style={my_styles.codeBox}><Text style={my_styles.code}>{shareCode}</Text></View>
                    <TouchableOpacity style={my_styles.shareBtn} onPress={handleShare} activeOpacity={0.75}>
                      <Text style={my_styles.shareBtnText}>Share Code</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={my_styles.hint}>Generate a 6-character code so friends can view your taste profile.</Text>
                    <TouchableOpacity style={[my_styles.shareBtn, isSaving && { opacity: 0.5 }]} onPress={handleGenerate} activeOpacity={0.75} disabled={isSaving}>
                      {isSaving ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={my_styles.shareBtnText}>Generate & Share</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}

          {/* ── Load a friend ── */}
          <SectionHead label="Load a Friend" />
          <View style={styles.inputCard}>
            <View style={styles.cardSpecular} />
            <Text style={styles.inputLabel}>Enter their code</Text>
            <View style={styles.inputRow}>
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
              />
              <TouchableOpacity style={[styles.loadBtn, (!canLoad || isLoadingFriend) && styles.loadBtnDisabled]} onPress={handleLoad} activeOpacity={0.75} disabled={!canLoad || isLoadingFriend}>
                {isLoadingFriend ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={styles.loadBtnText}>Load</Text>}
              </TouchableOpacity>
            </View>
            {errorMsg && status === 'error' && <Text style={styles.errorText}>{errorMsg}</Text>}
          </View>

          {friendProfile && <FriendCard theirs={friendProfile} mine={profile} />}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─── Your-code card styles ────────────────────────────────────────────────────
const my_styles = StyleSheet.create({
  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.md, alignItems: 'center' },
  specular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  hint: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: FontSize.sm * 1.6 },
  codeBox: { backgroundColor: 'rgba(83,224,118,0.08)', borderWidth: 1, borderColor: 'rgba(83,224,118,0.25)', borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing['2xl'] },
  code: { fontFamily: FontFamily.monoMedium, fontSize: 28, color: Colors.greenPrimary, letterSpacing: 6 },
  shareBtn: { backgroundColor: Colors.greenPrimary, borderRadius: Radius.full, paddingVertical: Spacing.sm, paddingHorizontal: Spacing['2xl'], minWidth: 160, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  shareBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.background },
})

// ─── Screen styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  ambientViolet: { position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.violetGlow },
  ambientPink:   { position: 'absolute', bottom: -100, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: Colors.pinkGlow },
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  safe: { flex: 1, zIndex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  heading: { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: Colors.text, letterSpacing: -0.5 },

  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 60, gap: Spacing.md },

  statRow: { flexDirection: 'row', gap: Spacing.sm },

  card: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.sm },
  cardSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.glassHighlight },
  sectionLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.xs },
  bpmText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs },

  genreCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  genrePill: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: Colors.glass },
  genreText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs },

  scanBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center', paddingVertical: Spacing.sm },
  scanText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },
  scanBtn: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: 'rgba(83,224,118,0.2)', borderRadius: Radius.full, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs },
  scanBtnText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.greenPrimary },

  inputCard: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.md },
  inputLabel: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, fontFamily: FontFamily.monoMedium, fontSize: FontSize.lg, color: Colors.text, letterSpacing: 3 },
  loadBtn: { backgroundColor: Colors.greenPrimary, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, minWidth: 72, height: 44, alignItems: 'center', justifyContent: 'center' },
  loadBtnDisabled: { opacity: 0.4 },
  loadBtnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.background },
  errorText: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },

  emptyWrap: { alignItems: 'center', paddingTop: Spacing['4xl'], gap: Spacing.md },
  emptyIcon: { fontSize: 48, color: Colors.glassBorder },
  emptyTitle: { fontFamily: FontFamily.display, fontSize: FontSize.xl, color: Colors.textSecondary, letterSpacing: -0.5 },
  emptyDesc: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: FontSize.sm * 1.7 },
})
