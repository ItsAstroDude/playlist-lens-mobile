import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { useMotionReduced } from '@/components/motion'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'
import { requestTabletop } from '@/utils/coverMode'
import { ControlRow, DeckCard, SongAbout, useCardGestures, useDeck, useUpNext } from './UpNext'

/**
 * Flex panel (2.0.35; F3 "deck remote" in 2.0.38): the flat half while the Flip is folded
 * like a laptop. Whatever screen you're on moves to the half that stands up (app/_layout);
 * this half is a music remote, the same on every screen:
 *  · the song — cover, title, progress — and a button that opens Now playing full screen
 *  · up next as a card you swipe (← drop · keep →, up = play now); through the queue, the
 *    card turns into stats about the song playing
 *  · one row of controls: ✕ drop · previous · play/pause · next · ✓ keep
 * Nothing playing: one big button that resumes Spotify where it was.
 */
export function FlexPanel({ height }: { height: number }) {
  const insets = useSafeAreaInsets()
  const reduced = useMotionReduced()
  const { width: W } = useWindowDimensions()
  const { np } = useNowPlaying()
  const isTrack = !!np?.item && np.type === 'track'
  const m = useNowPlayingModel(isTrack ? np : null, true)
  const pct = m.dur > 0 ? Math.min(m.liveMs / m.dur, 1) : 0
  const upNext = useUpNext(m.item?.id, isTrack)
  const deck = useDeck(upNext.state, m, upNext.refresh)
  const g = useCardGestures(deck, W)

  // Rises in from the table when the phone folds.
  const k = useSharedValue(reduced ? 1 : 0)
  useEffect(() => { if (!reduced) k.value = withSpring(1, Spring.entrance) }, [])
  const enter = useAnimatedStyle(() => ({ opacity: Math.min(1, k.value * 1.3), transform: [{ translateY: (1 - k.value) * 40 }] }))

  const art = Math.round(Math.max(64, Math.min(height * 0.26, 112)))
  return (
    <Animated.View style={[styles.wrap, { height, paddingBottom: Math.max(insets.bottom, Spacing.md) }, enter]}>
      <View style={styles.hinge} pointerEvents="none" />

      <View style={styles.song}>
        {m.art ? <Image source={{ uri: m.art }} style={styles.art} contentFit="cover" transition={200} />
               : <View style={[styles.art, styles.artEmpty]}><Ionicons name="musical-notes-outline" size={18} color={Colors.textMuted} /></View>}
        <View style={styles.songText}>
          <Text style={styles.title} numberOfLines={1}>
            {isTrack ? `${m.item?.name} · ${m.item?.artists?.join(', ')}` : 'Nothing playing'}
          </Text>
          {isTrack
            ? <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%` }]} /></View>
            : <Text style={styles.sub}>Press play to resume Spotify</Text>}
        </View>
        {isTrack && (
          <Pressable onPress={() => { haptic.light(); requestTabletop() }} hitSlop={8} style={styles.open}
            accessibilityRole="button" accessibilityLabel="Open Now playing full screen">
            <Ionicons name="expand-outline" size={18} color={Colors.text} />
          </Pressable>
        )}
      </View>

      {isTrack ? (
        <>
          <View style={styles.head}>
            <Text style={styles.overline}>{deck.card ? 'UP NEXT' : 'NOW PLAYING'}</Text>
            {!!deck.card && <Text style={styles.hint}>← drop · keep →</Text>}
          </View>
          <View style={styles.deck}>
            {deck.card
              ? <DeckCard deck={deck} cardStyle={g.style} gesture={Gesture.Simultaneous(g.pan, g.tap)} artSize={art} />
              : upNext.state.status === 'ok'
                ? <SongAbout m={m} again={deck.total > 0 ? deck.again : undefined} />
                : <View style={styles.wait}><Text style={styles.hint}>{upNext.state.status === 'loading' ? 'Looking at what\'s next…' : 'Couldn\'t get what\'s next from Spotify.'}</Text></View>}
          </View>
          <ControlRow m={m} deck={deck} fly={g.fly} big={68} />
        </>
      ) : (
        <View style={styles.idle}>
          <Pressable onPress={m.onPlayPause} disabled={m.busy} style={[styles.play, m.busy && { opacity: 0.6 }]}
            accessibilityRole="button" accessibilityLabel="Play">
            <Ionicons name="play" size={30} color={Colors.background} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap:     { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md, backgroundColor: Colors.background },
  hinge:    { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: Colors.glassBorder },
  song:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  art:      { width: 40, height: 40, borderRadius: Radius.md },
  artEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.glass },
  songText: { flex: 1, minWidth: 0, gap: 6 },
  title:    { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  sub:      { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted },
  open:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass },
  track:    { height: 3, borderRadius: 2, backgroundColor: alpha(Colors.greenPrimary, 0.18), overflow: 'hidden' },
  fill:     { height: 3, borderRadius: 2, backgroundColor: Colors.greenPrimary },
  head:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  overline: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, letterSpacing: 2, color: Colors.textMuted },
  hint:     { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  deck:     { flex: 1, minHeight: 96 },
  wait:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  idle:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  play:     { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.greenPrimary },
})
