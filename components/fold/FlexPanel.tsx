import React, { useCallback, useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useMotionReduced } from '@/components/motion'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { fmtClock, useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'
import { requestTabletop } from '@/utils/coverMode'

/**
 * Flex panel (2.0.35): the flat half while the Flip is folded like a laptop. Whatever
 * screen you're on moves to the half that stands up (app/_layout); this half is a music
 * remote, the same on every screen:
 *  · the song — cover, title, progress — and a button that opens Now playing full screen
 *  · a big touch pad: tap = play/pause, swipe left = next, swipe right = previous
 * Nothing playing: the pad resumes Spotify where it was.
 */
export function FlexPanel({ height }: { height: number }) {
  const insets = useSafeAreaInsets()
  const reduced = useMotionReduced()
  const { np } = useNowPlaying()
  const isTrack = !!np?.item && np.type === 'track'
  const m = useNowPlayingModel(isTrack ? np : null, true)
  const pct = m.dur > 0 ? Math.min(m.liveMs / m.dur, 1) : 0

  // Rises in from the table when the phone folds.
  const k = useSharedValue(reduced ? 1 : 0)
  useEffect(() => { if (!reduced) k.value = withSpring(1, Spring.entrance) }, [])
  const enter = useAnimatedStyle(() => ({ opacity: Math.min(1, k.value * 1.3), transform: [{ translateY: (1 - k.value) * 40 }] }))

  // The pad: tap = play/pause, swipe = skip. A little press-in on the pad itself.
  const press = useSharedValue(1)
  const onSwipe = useCallback((dx: number) => {
    if (!isTrack) return
    haptic.light()
    if (dx < 0) m.onNext(); else m.onPrev()
  }, [isTrack, m])
  const onTap = useCallback(() => { m.onPlayPause() }, [m])
  const pan = Gesture.Pan().activeOffsetX([-24, 24]).failOffsetY([-30, 30])
    .onEnd(e => { if (Math.abs(e.translationX) > 60) runOnJS(onSwipe)(e.translationX) })
  const tap = Gesture.Tap()
    .onBegin(() => { press.value = withSpring(0.97, Spring.snappy) })
    .onFinalize(() => { press.value = withSpring(1, Spring.snappy) })
    .onEnd((_e, ok) => { if (ok) runOnJS(onTap)() })
  const padStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }))

  return (
    <Animated.View style={[styles.wrap, { height, paddingBottom: Math.max(insets.bottom, Spacing.md) }, enter]}>
      <View style={styles.hinge} pointerEvents="none" />

      <View style={styles.song}>
        {m.art ? <Image source={{ uri: m.art }} style={styles.art} contentFit="cover" transition={200} />
               : <View style={[styles.art, styles.artEmpty]}><Ionicons name="musical-notes-outline" size={20} color={Colors.textMuted} /></View>}
        <View style={styles.songText}>
          <Text style={styles.title} numberOfLines={1}>{isTrack ? m.item?.name : 'Nothing playing'}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {isTrack ? `${m.item?.artists?.join(', ')} · ${fmtClock(m.liveMs)} / ${fmtClock(m.dur)}` : 'Tap the pad to resume Spotify'}
          </Text>
        </View>
        {isTrack && (
          <Pressable onPress={() => { haptic.light(); requestTabletop() }} hitSlop={8} style={styles.open}
            accessibilityRole="button" accessibilityLabel="Open Now playing full screen">
            <Ionicons name="expand-outline" size={18} color={Colors.text} />
          </Pressable>
        )}
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%` }]} /></View>

      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <Animated.View style={[styles.pad, padStyle]} accessible accessibilityRole="adjustable"
          accessibilityLabel={`Remote. ${m.playing ? 'Playing' : 'Paused'}. Tap to ${m.playing ? 'pause' : 'play'}, swipe to skip.`}
          accessibilityActions={[{ name: 'activate' }, { name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => {
            const a = e.nativeEvent.actionName
            if (a === 'activate') m.onPlayPause(); else if (a === 'increment') m.onNext(); else m.onPrev()
          }}>
          <Ionicons name="chevron-back" size={22} color={alpha(Colors.text, isTrack ? 0.4 : 0.15)} />
          <View style={styles.padMid}>
            <View style={[styles.play, m.busy && { opacity: 0.6 }]}>
              <Ionicons name={m.playing ? 'pause' : 'play'} size={30} color={Colors.background} />
            </View>
            <Text style={styles.hint}>tap to {m.playing ? 'pause' : 'play'}{isTrack ? ' · swipe to skip' : ''}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={alpha(Colors.text, isTrack ? 0.4 : 0.15)} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap:     { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md, backgroundColor: Colors.background },
  hinge:    { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: Colors.glassBorder },
  song:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  art:      { width: 52, height: 52, borderRadius: Radius.md },
  artEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.glass },
  songText: { flex: 1, minWidth: 0 },
  title:    { fontFamily: FontFamily.syneBold, fontSize: FontSize.md + 1, letterSpacing: -0.3, color: Colors.text },
  sub:      { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  open:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass },
  track:    { height: 4, borderRadius: 2, backgroundColor: alpha(Colors.greenPrimary, 0.18), overflow: 'hidden' },
  fill:     { height: 4, borderRadius: 2, backgroundColor: Colors.greenPrimary },
  pad:      {
    flex: 1, borderRadius: 36, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl,
  },
  padMid:   { alignItems: 'center', gap: Spacing.md },
  play:     { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.greenPrimary },
  hint:     { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
})
