import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { ACCENTS, Colors, FontFamily, OnDark, activeAccentId, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { tabBarHidden } from '@/utils/tabBar'
import { reduceMotionEnabled, type NavbarStyle } from '@/utils/settings'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useAuth } from '@/hooks/useAuth'
import { NowPlayingSheet } from './NowPlayingSheet'

// ─── Live now-playing bar (v1.3 "Pulse") ─────────────────────────────────────
// Slim glass pill docked just above the floating tab bar, on every tab. Shows
// the track playing on the user's Spotify account right now; tap → personal
// stats sheet. When the token predates the v1.3 scopes it becomes the inline
// "Reconnect Spotify" prompt instead (dismissible for the session).
//
// Like the tab bar, this surface is ALWAYS dark regardless of theme mode — so
// text uses the fixed OnDark tokens and the accent is the RAW hue (the light-
// mode darkened accent would vanish on a dark pill).

const BAR_H = 48

// The bright accent as picked (NOT darkened for light mode — see note above).
const RAW_ACCENT = (ACCENTS.find(a => a.id === activeAccentId()) ?? ACCENTS[0]).hex

// ── Animated 3-bar equalizer — the "this is live" signal ──
function Equalizer({ playing }: { playing: boolean }) {
  const h1 = useSharedValue(5)
  const h2 = useSharedValue(11)
  const h3 = useSharedValue(7)

  useEffect(() => {
    const bars: Array<[typeof h1, number, number, number]> = [
      [h1, 13, 5, 460], [h2, 15, 7, 380], [h3, 11, 4, 540],
    ]
    if (playing && !reduceMotionEnabled()) {
      bars.forEach(([v, hi, lo, dur]) => {
        v.value = withRepeat(
          withSequence(
            withTiming(hi, { duration: dur, easing: Easing.inOut(Easing.quad) }),
            withTiming(lo, { duration: dur, easing: Easing.inOut(Easing.quad) }),
          ),
          -1, true,
        )
      })
    } else {
      bars.forEach(([v]) => { cancelAnimation(v); v.value = withTiming(4, { duration: 200 }) })
    }
    return () => { cancelAnimation(h1); cancelAnimation(h2); cancelAnimation(h3) }
  }, [playing])

  const s1 = useAnimatedStyle(() => ({ height: h1.value }))
  const s2 = useAnimatedStyle(() => ({ height: h2.value }))
  const s3 = useAnimatedStyle(() => ({ height: h3.value }))

  return (
    <View style={eq.row}>
      <Animated.View style={[eq.bar, s1]} />
      <Animated.View style={[eq.bar, s2]} />
      <Animated.View style={[eq.bar, s3]} />
    </View>
  )
}

export function NowPlayingBar({ navStyle }: { navStyle: NavbarStyle }) {
  const insets = useSafeAreaInsets()
  const { np, needsReconnect } = useNowPlaying()
  const { login, isLoading } = useAuth()
  const [dismissed, setDismissed] = useState(false)   // reconnect pill only, per session
  const [sheetOpen, setSheetOpen] = useState(false)

  const isTrack = !!np?.item && np.type === 'track'
  const showReconnect = needsReconnect && !dismissed
  const visible = showReconnect || isTrack

  // Sits just above whichever navbar variant is active.
  const bottom = useMemo(() => {
    if (navStyle === 'gestures') return Math.max(insets.bottom, 10) + 34
    const navH = navStyle === 'minimal' ? 50 : 60
    return Math.max(insets.bottom, 8) + 10 + navH + 8
  }, [navStyle, insets.bottom])

  // ── Entrance/exit + follow the tab bar's auto-hide ──
  const vis = useSharedValue(0)
  useEffect(() => {
    vis.value = visible
      ? withSpring(1, Spring.default)
      : withTiming(0, { duration: 180 })
  }, [visible])

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: vis.value * (1 - tabBarHidden.value * 0.25),
    transform: [
      { translateY: (1 - vis.value) * 14 + tabBarHidden.value * (BAR_H + bottom + 40) },
    ],
  }))

  // ── Progress line: snap to the polled position, then glide linearly toward
  // the track's end — so it tracks real time between polls. Each poll re-syncs.
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

  const onReconnect = async () => {
    if (isLoading) return
    haptic.medium()
    await login()   // success → finalizeAuth sets scopeStatus 'ok' → poll resumes
  }

  const onOpen = () => { haptic.light(); setSheetOpen(true) }

  const art = np?.item?.album?.images?.[0]?.url ?? null

  return (
    <>
      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        style={[styles.wrap, { bottom }, wrapStyle]}
      >
        <View style={styles.pill}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

          {showReconnect ? (
            <Pressable style={styles.inner} onPress={onReconnect} disabled={isLoading}>
              <View style={styles.reconnectIcon}>
                <Ionicons name="sync" size={15} color={RAW_ACCENT} />
              </View>
              <View style={styles.textCol}>
                <Text style={styles.title} numberOfLines={1}>
                  {isLoading ? 'Opening Spotify…' : 'Reconnect Spotify'}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  New features need a quick re-auth
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={OnDark.textMuted} />
              <TouchableOpacity
                onPress={() => { haptic.light(); setDismissed(true) }}
                hitSlop={10}
                style={styles.dismiss}
              >
                <Ionicons name="close" size={14} color={OnDark.textMuted} />
              </TouchableOpacity>
            </Pressable>
          ) : (
            <Pressable style={styles.inner} onPress={onOpen}>
              {art ? (
                <Image source={{ uri: art }} style={styles.art} contentFit="cover" transition={150} />
              ) : (
                <View style={[styles.art, styles.artFallback]}>
                  <Ionicons name="musical-note" size={14} color={RAW_ACCENT} />
                </View>
              )}
              <View style={styles.textCol}>
                <Text style={styles.title} numberOfLines={1}>{np?.item?.name}</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {np?.item?.artists?.join(', ')}
                </Text>
              </View>
              <Equalizer playing={!!np?.is_playing} />
            </Pressable>
          )}

          {/* progress underline — only meaningful in playing mode */}
          {!showReconnect && (
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
          )}
        </View>
      </Animated.View>

      <NowPlayingSheet np={sheetOpen ? np : null} onClose={() => setSheetOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 18, right: 18, height: BAR_H, zIndex: 10,
  },
  pill: {
    flex: 1,
    borderRadius: BAR_H / 2,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: 'rgba(18,18,22,0.82)', // always-dark, docks with the tab bar
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    gap: 10,
  },
  art: {
    width: 32, height: 32, borderRadius: 16,
  },
  artFallback: {
    backgroundColor: alpha(RAW_ACCENT, 0.12),
    alignItems: 'center', justifyContent: 'center',
  },
  reconnectIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: alpha(RAW_ACCENT, 0.12),
    alignItems: 'center', justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 1 },
  title: {
    fontFamily: FontFamily.monoMedium, fontSize: 12, color: OnDark.text,
  },
  subtitle: {
    fontFamily: FontFamily.mono, fontSize: 10, color: OnDark.textMuted,
  },
  dismiss: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute', left: 22, right: 22, bottom: 5,
    height: 2, borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressFill: {
    height: 2, borderRadius: 1, backgroundColor: RAW_ACCENT,
  },
})

const eq = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 2.5,
    height: 16, marginRight: 6,
  },
  bar: { width: 3, borderRadius: 1.5, backgroundColor: RAW_ACCENT },
})
