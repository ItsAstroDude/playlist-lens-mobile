import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { getNowPlayingPos, onNowPlayingPos } from '@/utils/settings'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useAuth } from '@/hooks/useAuth'
import { emitOpenNowPlaying } from '@/utils/overlayEvents'
import { RotatingStrip } from '@/components/ui/RotatingStrip'

// ─── Home-strip now-playing (v1.3 "Pulse") ───────────────────────────────────
// The alternative placement: now-playing takes over the Lenses quote-strip slot
// (Settings → Appearance → Now playing → "Home strip"). Same geometry as
// RotatingStrip so the header never shifts; the quotes return whenever nothing
// is playing — and always when the user keeps the default bottom placement.
// This pill sits on the THEMED screen background, so themed tokens throughout.

export function HomeTopStrip() {
  const [pos, setPos] = useState(getNowPlayingPos)
  useEffect(() => onNowPlayingPos(setPos), [])

  const { np, needsReconnect } = useNowPlaying()
  const { login, isLoading } = useAuth()
  const [dismissed, setDismissed] = useState(false)   // reconnect line only, per session

  const isTrack = !!np?.item && np.type === 'track'
  const showReconnect = needsReconnect && !dismissed

  // ── Progress: snap to the polled position, then glide toward track end ──
  const progress = useSharedValue(0)
  useEffect(() => {
    const dur = np?.item?.duration_ms ?? 0
    if (!isTrack || !dur) { progress.value = 0; return }
    const at = Math.min((np?.progress_ms ?? 0) / dur, 1)
    if (np?.is_playing) {
      progress.value = withSequence(
        withTiming(at, { duration: 250 }),
        withTiming(1, { duration: Math.max(dur - (np?.progress_ms ?? 0), 0), easing: Easing.linear }),
      )
    } else {
      progress.value = withTiming(at, { duration: 250 })
    }
  }, [np, isTrack])
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))

  if (pos !== 'top' || (!isTrack && !showReconnect)) return <RotatingStrip />

  const accent = Colors.greenPrimary
  const art = np?.item?.album?.images?.[0]?.url ?? null

  return (
    <View style={styles.outer}>
      {showReconnect ? (
        <Pressable
          onPress={() => { if (!isLoading) { haptic.medium(); login() } }}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.pill, { borderColor: alpha(accent, 0.3) }]}
          >
            <Ionicons name="sync" size={13} color={accent} />
            <Text style={styles.text} numberOfLines={1}>
              {isLoading ? 'Opening Spotify…' : 'Reconnect Spotify — new features await'}
            </Text>
            <TouchableOpacity onPress={() => { haptic.light(); setDismissed(true) }} hitSlop={10}>
              <Ionicons name="close" size={13} color={Colors.textMuted} />
            </TouchableOpacity>
          </LinearGradient>
        </Pressable>
      ) : (
        <Pressable onPress={() => { haptic.light(); emitOpenNowPlaying() }}>
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.pill, { borderColor: alpha(accent, 0.3) }]}
          >
            {art ? (
              <Image source={{ uri: art }} style={styles.art} contentFit="cover" transition={150} />
            ) : (
              <Text style={[styles.glyph, { color: accent }]}>♪</Text>
            )}
            <Text style={styles.text} numberOfLines={1}>
              <Text style={styles.name}>{np?.item?.name}</Text>
              <Text style={styles.artist}>  ·  {np?.item?.artists?.join(', ')}</Text>
            </Text>
            {/* progress underline along the pill's bottom edge */}
            <View style={styles.progressTrack} pointerEvents="none">
              <Animated.View style={[styles.progressFill, progressStyle, { backgroundColor: accent }]} />
            </View>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  )
}

// Mirrors RotatingStrip's outer/pill geometry so the slot never shifts.
const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    maxWidth: '92%',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  art: { width: 18, height: 18, borderRadius: 9 },
  glyph: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm },
  text: { flexShrink: 1 },
  name: {
    fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm,
    color: Colors.text, letterSpacing: 0.3,
  },
  artist: {
    fontFamily: FontFamily.mono, fontSize: FontSize.sm,
    color: Colors.textMuted, letterSpacing: 0.3,
  },
  progressTrack: {
    position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: 0,
    height: 2, borderRadius: 1,
  },
  progressFill: { height: 2, borderRadius: 1 },
})
