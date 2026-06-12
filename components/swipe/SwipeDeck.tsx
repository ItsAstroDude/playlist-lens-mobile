import React, { useEffect, useState } from 'react'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue,
  withSpring, withTiming,
} from 'react-native-reanimated'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { api } from '@/utils/api'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import type { SpotifyTrack } from '@/types'

// ─── Swipe deck (v1.3 "Lively") ──────────────────────────────────────────────
// The card stack for swipe-refresh: drag right = keep, left = cut, with a 30s
// snippet auto-playing per card (resolved by the backend — Deezer/embed/iTunes,
// since preview_url is dead for this app). Each card instance owns its gesture
// values (keyed by track id), so a flying-out card never bleeds state into the
// next one. The action row lives inside the card instance for the same reason.

const { width: SW, height: SH } = Dimensions.get('window')
const CARD_W  = Math.min(SW - Spacing.lg * 2, 380)
const CARD_H  = Math.min(SH * 0.52, 460)
const FLY_X   = SW * 1.4
const THRESH  = SW * 0.30

// ── Preview resolution (session cache; backend caches 30min on top) ──
const previewCache = new Map<string, string | null>()

async function resolvePreview(t: SpotifyTrack): Promise<string | null> {
  if (previewCache.has(t.id)) return previewCache.get(t.id) ?? null
  try {
    const qs =
      `isrc=${encodeURIComponent(t.external_ids?.isrc ?? '')}` +
      `&title=${encodeURIComponent(t.name ?? '')}` +
      `&artist=${encodeURIComponent(t.artists?.[0]?.name ?? '')}` +
      `&track_id=${encodeURIComponent(t.id ?? '')}`
    const res = await api.get<{ preview_url: string | null }>(`/api/preview?${qs}`)
    previewCache.set(t.id, res.preview_url)
    return res.preview_url
  } catch {
    return null   // not cached — a transient failure can retry on revisit (undo)
  }
}

function fmtSecs(s: number): string {
  const v = Math.max(Math.floor(s), 0)
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

// ── One live card (remounts per track via key) ──
function Card({ track, onDecide, onUndo, canUndo }: {
  track:    SpotifyTrack
  onDecide: (keep: boolean) => void
  onUndo:   () => void
  canUndo:  boolean
}) {
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)

  // ── 30s snippet ──
  // CRASH GUARD: useAudioPlayer releases the native player at unmount BEFORE
  // sibling effect cleanups run — any later call (even pause) throws
  // ERR_USING_RELEASED_SHARED_OBJECT, which is FATAL in a release build. So:
  // never touch the player in a cleanup, and wrap every call.
  const player = useAudioPlayer(null)
  const status = useAudioPlayerStatus(player)
  const [preview, setPreview] = useState<'loading' | 'none' | 'ready'>('loading')
  const safe = (fn: () => void) => { try { fn() } catch { /* released player */ } }

  useEffect(() => {
    let alive = true
    resolvePreview(track).then(url => {
      if (!alive) return
      if (url) {
        setPreview('ready')
        safe(() => { player.replace(url); player.play() })
      } else {
        setPreview('none')
      }
    })
    return () => { alive = false }   // do NOT pause here — see crash guard above
  }, [track.id])

  const togglePlay = () => {
    haptic.light()
    if (status.playing) safe(() => player.pause())
    else if (status.didJustFinish) safe(() => { player.seekTo(0).catch(() => {}); player.play() })
    else safe(() => player.play())
  }

  const decide = (keep: boolean) => { haptic.medium(); onDecide(keep) }

  const flyOut = (keep: boolean) => {
    safe(() => player.pause())
    tx.value = withTiming(keep ? FLY_X : -FLY_X, { duration: 240, easing: Easing.in(Easing.quad) },
      finished => { if (finished) runOnJS(decide)(keep) })
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onChange(e => {
      tx.value = e.translationX
      ty.value = e.translationY * 0.4
    })
    .onEnd(e => {
      if (Math.abs(e.translationX) > THRESH || Math.abs(e.velocityX) > 900) {
        const keep = e.translationX > 0
        runOnJS(haptic.medium)()
        tx.value = withTiming(keep ? FLY_X : -FLY_X, { duration: 220, easing: Easing.in(Easing.quad) },
          finished => { if (finished) runOnJS(onDecide)(keep) })
      } else {
        tx.value = withSpring(0, Spring.snappy)
        ty.value = withSpring(0, Spring.snappy)
      }
    })

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${tx.value / 18}deg` },
    ],
  }))
  const keepBadge = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [20, THRESH], [0, 1], 'clamp') }))
  const cutBadge  = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-THRESH, -20], [1, 0], 'clamp') }))

  const art = track.album?.images?.[0]?.url ?? null
  const dur = status.duration > 0 ? status.duration : 30
  const at  = status.currentTime ?? 0

  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          {art ? (
            <Image source={{ uri: art }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
          ) : (
            <LinearGradient colors={[alpha(Colors.greenPrimary, 0.35), alpha(Colors.greenPrimary, 0.06)]} style={StyleSheet.absoluteFill} />
          )}
          {/* readability scrim — always dark over art, so fixed light text */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
            style={styles.scrim}
            start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }}
          />

          {/* decision badges */}
          <Animated.View style={[styles.badge, styles.badgeKeep, keepBadge]}>
            <Text style={[styles.badgeText, { color: '#53e076' }]}>KEEP</Text>
          </Animated.View>
          <Animated.View style={[styles.badge, styles.badgeCut, cutBadge]}>
            <Text style={[styles.badgeText, { color: '#ff6b6b' }]}>CUT</Text>
          </Animated.View>

          {/* meta + snippet controls */}
          <View style={styles.meta}>
            <Text style={styles.trackName} numberOfLines={2}>{track.name}</Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {track.artists?.map(a => a.name).join(', ')}
            </Text>

            <View style={styles.audioRow}>
              {preview === 'ready' ? (
                <>
                  <TouchableOpacity onPress={togglePlay} hitSlop={10} style={styles.playBtn}>
                    <Ionicons
                      name={status.playing ? 'pause' : 'play'}
                      size={16}
                      color="#0c0c0f"
                    />
                  </TouchableOpacity>
                  <View style={styles.audioTrack}>
                    <View style={[styles.audioFill, { width: `${Math.min(at / dur, 1) * 100}%` }]} />
                  </View>
                  <Text style={styles.audioTime}>{fmtSecs(at)}</Text>
                </>
              ) : (
                <Text style={styles.noPreview}>
                  {preview === 'loading' ? 'finding a snippet…' : 'no snippet found — judge the cover ✦'}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* action row — part of the card instance so a mid-flight card can't be re-triggered */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionCut]} onPress={() => flyOut(false)} activeOpacity={0.8}>
          <Ionicons name="close" size={26} color="#ff6b6b" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionUndo, !canUndo && { opacity: 0.35 }]}
          onPress={() => { if (canUndo) { haptic.light(); onUndo() } }}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-undo" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionKeep]} onPress={() => flyOut(true)} activeOpacity={0.8}>
          <Ionicons name="heart" size={24} color="#53e076" />
        </TouchableOpacity>
      </View>
    </>
  )
}

export function SwipeDeck({ track, nextTrack, onDecide, onUndo, canUndo }: {
  track:     SpotifyTrack
  nextTrack: SpotifyTrack | null
  onDecide:  (keep: boolean) => void
  onUndo:    () => void
  canUndo:   boolean
}) {
  // Prefetch the next snippet while the current one plays.
  useEffect(() => { if (nextTrack) resolvePreview(nextTrack) }, [nextTrack?.id])

  const nextArt = nextTrack?.album?.images?.[0]?.url ?? null

  return (
    <View style={styles.deck}>
      {/* the card waiting underneath */}
      {nextTrack && (
        <View style={[styles.card, styles.cardNext]}>
          {nextArt ? (
            <Image source={{ uri: nextArt }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.card }]} />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.overlayLight }]} />
        </View>
      )}

      <Card
        key={track.id}
        track={track}
        onDecide={onDecide}
        onUndo={onUndo}
        canUndo={canUndo}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  deck: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Spacing.sm,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  cardNext: {
    position: 'absolute',
    top: Spacing.sm + 12,
    transform: [{ scale: 0.94 }],
  },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },

  badge: {
    position: 'absolute', top: 18,
    borderWidth: 2, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  badgeKeep: { left: 16,  borderColor: '#53e076', transform: [{ rotate: '-12deg' }] },
  badgeCut:  { right: 16, borderColor: '#ff6b6b', transform: [{ rotate: '12deg' }] },
  badgeText: { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg, letterSpacing: 2 },

  meta: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: Spacing.lg, gap: 3,
  },
  // On the dark cover scrim regardless of theme → fixed light text.
  trackName:  { fontFamily: FontFamily.syneBold, fontSize: FontSize.xl, color: '#F2EFF4', letterSpacing: -0.5 },
  artistName: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: 'rgba(242,239,244,0.72)' },

  audioRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm,
    minHeight: 30,
  },
  playBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F2EFF4',
    alignItems: 'center', justifyContent: 'center',
  },
  audioTrack: {
    flex: 1, height: 3, borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  audioFill: { height: 3, borderRadius: 1.5, backgroundColor: '#F2EFF4' },
  audioTime: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, color: 'rgba(242,239,244,0.72)' },
  noPreview: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: 'rgba(242,239,244,0.6)' },

  actions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xl, marginTop: Spacing.xl,
  },
  actionBtn: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  actionCut: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: 'rgba(255,107,107,0.10)', borderColor: 'rgba(255,107,107,0.45)',
  },
  actionUndo: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.glass, borderColor: Colors.glassBorder,
  },
  actionKeep: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: 'rgba(83,224,118,0.10)', borderColor: 'rgba(83,224,118,0.45)',
  },
})
