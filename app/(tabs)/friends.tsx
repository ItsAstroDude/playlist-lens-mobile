import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Share, Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay,
  withTiming, FadeIn,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useTasteProfile } from '@/hooks/useTasteProfile'
import { RadarChart } from '@/components/ui/RadarChart'
import type { TasteProfile, ArtistCount, GenreCount } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCompatibility(
  mine: TasteProfile, theirs: TasteProfile,
): number {
  // Genre overlap score (0-1)
  const myGenres    = new Set(mine.topGenres.slice(0, 10).map(g => g.genre))
  const theirGenres = theirs.topGenres.slice(0, 10).map(g => g.genre)
  const overlap     = theirGenres.filter(g => myGenres.has(g)).length
  const genreScore  = overlap / Math.max(myGenres.size, 1)

  // Audio distance score (0-1) — lower distance = higher score
  if (mine.af && theirs.af) {
    const dims: Array<keyof typeof mine.af> = [
      'energy', 'valence', 'danceability', 'acousticness',
    ]
    const dist = dims.reduce((sum, k) => {
      const a = mine.af![k] as number
      const b = theirs.af![k] as number
      return sum + Math.abs(a - b)
    }, 0) / dims.length
    const audioScore = 1 - dist
    return Math.round((genreScore * 0.5 + audioScore * 0.5) * 100)
  }

  return Math.round(genreScore * 100)
}

function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  if (clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3)}`
  return clean
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return (
    <View style={head_styles.row}>
      <View style={head_styles.line} />
      <Text style={head_styles.label}>{label}</Text>
      <View style={head_styles.line} />
    </View>
  )
}
const head_styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line:  { flex: 1, height: 1, backgroundColor: Colors.glassBorder },
  label: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
})

function CompatBar({ pct }: { pct: number }) {
  const w = useSharedValue(0)
  useEffect(() => {
    w.value = withDelay(200, withSpring(pct, { mass: 1, damping: 20, stiffness: 80 }))
  }, [pct])
  const barStyle = useAnimatedStyle(() => ({ width: `${w.value}%` as any }))

  const color =
    pct >= 75 ? Colors.greenPrimary :
    pct >= 50 ? Colors.lavender     :
    pct >= 30 ? Colors.pink         :
                Colors.textMuted

  return (
    <View style={compat_styles.wrap}>
      <View style={compat_styles.track}>
        <Animated.View style={[compat_styles.fill, barStyle, { backgroundColor: color }]} />
      </View>
      <Text style={[compat_styles.pct, { color }]}>{pct}%</Text>
    </View>
  )
}
const compat_styles = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: { flex: 1, height: 6, backgroundColor: Colors.glass, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: Colors.glassBorder },
  fill:  { height: '100%', borderRadius: 3 },
  pct:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.lg, letterSpacing: -0.5, width: 48, textAlign: 'right' },
})

// Friend profile card
function FriendCard({
  theirs, mine,
}: {
  theirs: TasteProfile
  mine:   TasteProfile | null
}) {
  const compat = mine ? computeCompatibility(mine, theirs) : null
  const genreAccents = [Colors.greenPrimary, Colors.pink, Colors.lavender]

  const sharedGenres = mine
    ? (() => {
        const mySet = new Set(mine.topGenres.map(g => g.genre))
        return theirs.topGenres.filter(g => mySet.has(g.genre)).slice(0, 6)
      })()
    : []

  return (
    <Animated.View entering={FadeIn.duration(300)} style={friend_styles.card}>
      <View style={friend_styles.specular} />

      {/* Header row */}
      <View style={friend_styles.header}>
        <View>
          <Text style={friend_styles.name}>
            {theirs.name || 'Anonymous listener'}
          </Text>
          <Text style={friend_styles.meta}>
            {theirs.playlistCount} lenses · {theirs.trackCount.toLocaleString()} tracks
          </Text>
        </View>
        {theirs.vibe && (
          <View style={friend_styles.vibePill}>
            <Text style={friend_styles.vibeText} numberOfLines={1}>{theirs.vibe}</Text>
          </View>
        )}
      </View>

      {/* Compatibility */}
      {compat !== null && (
        <View style={friend_styles.section}>
          <Text style={friend_styles.sectionLabel}>TASTE MATCH</Text>
          <CompatBar pct={compat} />
        </View>
      )}

      {/* Radar */}
      {theirs.af && (
        <View style={friend_styles.section}>
          <Text style={friend_styles.sectionLabel}>AUDIO PROFILE</Text>
          <View style={{ alignItems: 'center' }}>
            <RadarChart
              acousticness={theirs.af.acousticness}
              danceability={theirs.af.danceability}
              energy={theirs.af.energy}
              valence={theirs.af.valence}
              instrumentalness={theirs.af.instrumentalness}
              liveness={theirs.af.liveness}
              color={Colors.lavender}
              size={180}
            />
          </View>
        </View>
      )}

      {/* Top artists */}
      {theirs.topArtists.length > 0 && (
        <View style={friend_styles.section}>
          <Text style={friend_styles.sectionLabel}>TOP ARTISTS</Text>
          {theirs.topArtists.slice(0, 5).map((a, i) => (
            <View key={a.id} style={friend_styles.artistRow}>
              <Text style={friend_styles.artistRank}>{i + 1}</Text>
              <Text style={friend_styles.artistName} numberOfLines={1}>{a.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Shared genres */}
      {sharedGenres.length > 0 && (
        <View style={friend_styles.section}>
          <Text style={friend_styles.sectionLabel}>YOU BOTH LIKE</Text>
          <View style={friend_styles.genreCloud}>
            {sharedGenres.map((g, i) => (
              <View key={g.genre} style={[friend_styles.genrePill, { borderColor: `${genreAccents[i % 3]}30` }]}>
                <Text style={[friend_styles.genreText, { color: genreAccents[i % 3] }]}>{g.genre}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Their genres */}
      {theirs.topGenres.length > 0 && (
        <View style={friend_styles.section}>
          <Text style={friend_styles.sectionLabel}>THEIR GENRES</Text>
          <View style={friend_styles.genreCloud}>
            {theirs.topGenres.slice(0, 10).map((g, i) => (
              <View key={g.genre} style={[friend_styles.genrePill, { borderColor: Colors.glassBorder }]}>
                <Text style={[friend_styles.genreText, { color: Colors.textMuted }]}>{g.genre}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  )
}

const friend_styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    borderRadius:    Radius.xl,
    overflow:        'hidden',
    padding:         Spacing.lg,
    gap:             Spacing.lg,
  },
  specular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: Colors.glassHighlight,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            Spacing.sm,
  },
  name: {
    fontFamily:    FontFamily.display,
    fontSize:      FontSize.lg,
    color:         Colors.text,
    letterSpacing: -0.5,
  },
  meta: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
    marginTop:  2,
  },
  vibePill: {
    backgroundColor:   Colors.glass,
    borderWidth:       1,
    borderColor:       Colors.glassBorder,
    borderRadius:      Radius.full,
    paddingVertical:   3,
    paddingHorizontal: Spacing.sm,
    maxWidth:          140,
  },
  vibeText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.lavender,
  },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  artistRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 },
  artistRank: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 16, textAlign: 'right' },
  artistName: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  genreCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  genrePill:  { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: Colors.glass },
  genreText:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs },
})

// ─── Your code card ───────────────────────────────────────────────────────────
function YourCodeCard({
  shareCode, saving, onGenerate, onShare,
}: {
  shareCode:  string | null
  saving:     boolean
  onGenerate: () => void
  onShare:    () => void
}) {
  return (
    <View style={my_styles.card}>
      <View style={my_styles.specular} />
      {shareCode ? (
        <>
          <Text style={my_styles.hint}>Your taste code</Text>
          <View style={my_styles.codeBox}>
            <Text style={my_styles.code}>{shareCode}</Text>
          </View>
          <TouchableOpacity style={my_styles.shareBtn} onPress={onShare} activeOpacity={0.75}>
            <Text style={my_styles.shareBtnText}>Share Code</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={my_styles.hint}>
            Generate a code from your Taste tab, then share it with friends.
          </Text>
          <TouchableOpacity
            style={[my_styles.shareBtn, saving && { opacity: 0.5 }]}
            onPress={onGenerate}
            activeOpacity={0.75}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={Colors.background} />
              : <Text style={my_styles.shareBtnText}>Generate Code</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

const my_styles = StyleSheet.create({
  card: {
    backgroundColor:  Colors.glass,
    borderWidth:      1,
    borderColor:      Colors.glassBorder,
    borderRadius:     Radius.xl,
    overflow:         'hidden',
    padding:          Spacing.lg,
    gap:              Spacing.md,
    alignItems:       'center',
  },
  specular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: Colors.glassHighlight,
  },
  hint: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: FontSize.sm * 1.6,
  },
  codeBox: {
    backgroundColor:   'rgba(83,224,118,0.08)',
    borderWidth:       1,
    borderColor:       'rgba(83,224,118,0.25)',
    borderRadius:      Radius.md,
    paddingVertical:   Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
  },
  code: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      28,
    color:         Colors.greenPrimary,
    letterSpacing: 6,
  },
  shareBtn: {
    backgroundColor:  Colors.greenPrimary,
    borderRadius:     Radius.full,
    paddingVertical:  Spacing.sm,
    paddingHorizontal: Spacing['2xl'],
    minWidth:         160,
    minHeight:        36,
    alignItems:       'center',
    justifyContent:   'center',
  },
  shareBtnText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
    color:      Colors.background,
  },
})

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function FriendsTab() {
  const {
    profile, shareCode, friendProfile, status, errorMsg,
    buildFromCache, saveProfile, loadFriend,
  } = useTasteProfile()

  const [codeInput, setCodeInput] = useState('')

  // Entrance animation
  const headerY       = useSharedValue(12)
  const headerOpacity = useSharedValue(0)
  useEffect(() => {
    headerY.value       = withDelay(60, withSpring(0, Spring.entrance))
    headerOpacity.value = withDelay(60, withTiming(1, { duration: 360 }))
    // Build profile from cache so we can show compatibility
    buildFromCache()
  }, [])
  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerY.value }],
    opacity:   headerOpacity.value,
  }))

  const handleCodeChange = useCallback((text: string) => {
    setCodeInput(formatCode(text))
  }, [])

  const handleLoad = useCallback(async () => {
    const clean = codeInput.replace(/-/g, '')
    if (clean.length < 6) return
    Keyboard.dismiss()
    haptic.light()
    await loadFriend(codeInput)
  }, [codeInput, loadFriend])

  const handleGenerate = useCallback(async () => {
    if (!profile) return
    haptic.light()
    const code = await saveProfile(profile)
    if (code) {
      await Share.share({
        message: `Check out my music taste on playlist.lens! Enter my code: ${code}`,
      })
    }
  }, [profile, saveProfile])

  const handleShare = useCallback(async () => {
    if (!shareCode) return
    haptic.light()
    await Share.share({
      message: `Check out my music taste on playlist.lens! Enter my code: ${shareCode}`,
    })
  }, [shareCode])

  const isLoadingFriend = status === 'loading-friend'
  const isSaving        = status === 'saving'

  const canLoad = codeInput.replace(/-/g, '').length === 6

  return (
    <View style={styles.container}>
      {/* Ambient glows */}
      <View style={styles.ambientViolet} pointerEvents="none" />
      <View style={styles.ambientPink}   pointerEvents="none" />
      <LinearGradient
        colors={[Colors.auroraTop, Colors.auroraBot]}
        style={styles.aurora}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <Text style={styles.logo}>
            playlist<Text style={styles.dot}>.</Text>lens
          </Text>
        </Animated.View>

        <Animated.View style={[styles.titleBlock, headerStyle]}>
          <Text style={styles.title}>share</Text>
          <Text style={styles.sub}>Taste codes & compatibility</Text>
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Your code */}
          <SectionHead label="Your Code" />
          <YourCodeCard
            shareCode={shareCode}
            saving={isSaving}
            onGenerate={handleGenerate}
            onShare={handleShare}
          />

          {/* Load a friend */}
          <SectionHead label="Load a Friend" />
          <View style={styles.inputCard}>
            <View style={styles.cardSpecular} />
            <Text style={styles.inputLabel}>Enter their code</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={codeInput}
                onChangeText={handleCodeChange}
                placeholder="ABC-123"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                returnKeyType="search"
                onSubmitEditing={handleLoad}
                selectionColor={Colors.greenPrimary}
              />
              <TouchableOpacity
                style={[styles.loadBtn, (!canLoad || isLoadingFriend) && styles.loadBtnDisabled]}
                onPress={handleLoad}
                activeOpacity={0.75}
                disabled={!canLoad || isLoadingFriend}
              >
                {isLoadingFriend
                  ? <ActivityIndicator size="small" color={Colors.background} />
                  : <Text style={styles.loadBtnText}>Load</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Error */}
            {errorMsg && status === 'error' && (
              <Text style={styles.errorText}>{errorMsg}</Text>
            )}
          </View>

          {/* Friend result */}
          {friendProfile && (
            <FriendCard theirs={friendProfile} mine={profile} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  ambientViolet: {
    position:        'absolute',
    top:             -80,
    left:            -80,
    width:           300,
    height:          300,
    borderRadius:    150,
    backgroundColor: Colors.violetGlow,
  },
  ambientPink: {
    position:        'absolute',
    bottom:          -100,
    right:           -80,
    width:           260,
    height:          260,
    borderRadius:    130,
    backgroundColor: Colors.pinkGlow,
  },
  aurora: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    height:   200,
  },
  safe: {
    flex:   1,
    zIndex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.sm,
    paddingBottom:     Spacing.xs,
  },
  logo: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize.xl,
    color:         Colors.text,
    letterSpacing: -1,
  },
  dot: { color: Colors.greenPrimary },

  titleBlock: {
    paddingHorizontal: Spacing.lg,
    paddingBottom:     Spacing.lg,
    gap:               3,
  },
  title: {
    fontFamily:    FontFamily.syneBold,
    fontSize:      FontSize['2xl'],
    color:         Colors.text,
    letterSpacing: -1,
  },
  sub: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textMuted,
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom:     140,
    gap:               Spacing.md,
  },

  inputCard: {
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    borderRadius:    Radius.xl,
    overflow:        'hidden',
    padding:         Spacing.lg,
    gap:             Spacing.md,
  },
  cardSpecular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: Colors.glassHighlight,
  },
  inputLabel: {
    fontFamily:    FontFamily.monoMedium,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    gap:           Spacing.sm,
    alignItems:    'center',
  },
  input: {
    flex:            1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    borderRadius:    Radius.md,
    paddingVertical:  Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontFamily:      FontFamily.monoMedium,
    fontSize:        FontSize.lg,
    color:           Colors.text,
    letterSpacing:   3,
  },
  loadBtn: {
    backgroundColor: Colors.greenPrimary,
    borderRadius:    Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    minWidth:        72,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
  },
  loadBtnDisabled: { opacity: 0.4 },
  loadBtnText: {
    fontFamily: FontFamily.monoMedium,
    fontSize:   FontSize.sm,
    color:      Colors.background,
  },
  errorText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.error,
    textAlign:  'center',
  },
})
