import React, { useEffect, useState } from 'react'
import { BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated'
import { Colors, Spacing } from '@/constants/theme'
import { Spring, haptic } from '@/constants/animation'
import { Aurora } from '@/components/motion/Aurora'
import { useMotionReduced } from '@/components/motion'
import { useNowPlaying } from '@/hooks/useNowPlaying'
import { usePosture } from '@/hooks/usePosture'
import { useIsCover } from '@/hooks/useScreen'
import { tabletopSplit } from '@/utils/posture'
import { onFoldSettings, tabletopEnabled } from '@/utils/settings'
import { UpNextStrip, UpNextTop, useUpNext } from './UpNext'
import { topShift } from '@/utils/upNext'
import { requestTabletop, setTabletopActive, useTabletopRequested } from '@/utils/coverMode'
import { useNowPlayingModel } from '@/components/nowplaying/useNowPlayingModel'

/**
 * Half-folded on the main screen (Flex mode / tabletop): stand the phone on the desk and
 * Now Playing splits at the hinge — the song and what plays after it on the half that
 * stands up, the up-next deck and the controls on the half lying flat (2.0.38: up next
 * only). Open the phone flat (or tap the arrow) and it springs away.
 *
 * Shows while a song is playing and the hinge runs across the screen: by itself when you
 * fold (Labs switch, on by default), or when asked for (Lenses' cover button, folded).
 * Labs also has "simulate" to try it flat.
 */
export function TabletopNowPlaying() {
  const { width: W, height: H } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduced = useMotionReduced()
  const posture = usePosture()
  const cover = useIsCover()
  const { np } = useNowPlaying()

  const [enabled, setEnabled] = useState(tabletopEnabled)
  useEffect(() => onFoldSettings(() => setEnabled(tabletopEnabled())), [])

  // Dismissed with the arrow: stays away until the phone leaves the half fold.
  const [dismissed, setDismissed] = useState(false)
  const half = posture.state === 'half'
  const asked = useTabletopRequested()
  // Opening the phone flat after a fold: forget the dismissal (and a request made folded).
  const wasHalf = React.useRef(half)
  useEffect(() => {
    if (wasHalf.current && !half) { setDismissed(false); requestTabletop(false) }
    wasHalf.current = half
  }, [half])

  // 2.0.34: this is also Now playing's full screen on a flat phone — the Lenses cover
  // button opens it. Folded, it splits at the hinge; flat, at the middle of the screen.
  const foldSplit = cover ? null : tabletopSplit(posture, H)
  const split = foldSplit ?? (asked && !cover ? { top: Math.round(H / 2), bottom: H - Math.round(H / 2) } : null)
  const isTrack = !!np?.item && np.type === 'track'
  // When asked for (cover button), or by itself when you fold (Labs switch).
  const show = !!split && isTrack && (asked || (enabled && !dismissed && !!foldSplit))
  // The song stopped: close, and don't pop open again with the next one.
  useEffect(() => { if (asked && !isTrack && np !== undefined) requestTabletop(false) }, [asked, isTrack])

  // Stay mounted through the exit, then unmount (the aurora redraws every frame).
  const [mounted, setMounted] = useState(show)
  const vis = useSharedValue(0)
  useEffect(() => {
    if (show) {
      setMounted(true)
      haptic.light()
      vis.value = reduced ? withTiming(1, { duration: 180 }) : withSpring(1, Spring.entrance)
    } else {
      vis.value = withTiming(0, { duration: 200 }, done => { if (done) runOnJS(setMounted)(false) })
    }
  }, [show])
  useEffect(() => { setTabletopActive(show) }, [show])
  useEffect(() => () => setTabletopActive(false), [])

  useEffect(() => {
    if (!show) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setDismissed(true); requestTabletop(false); return true })
    return () => sub.remove()
  }, [show])

  // Keep the last song + split on screen while it springs away.
  const lastNp = React.useRef(np)
  if (isTrack) lastNp.current = np
  const lastSplit = React.useRef(split)
  if (split) lastSplit.current = split
  const m = useNowPlayingModel(isTrack ? np : lastNp.current, mounted)

  // 2.0.38: one layout, up next (the "now" layout and its switch are gone).
  const upNext = useUpNext(m.item?.id, mounted)

  // The standing half drops in from above, the flat half rises from below.
  const rootStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, vis.value) }))
  // Through the queue on a flat phone, the stats can need more than the bottom half:
  // the top half slides up into its own empty space by that much (never under the
  // close button). Half-folded the hinge stays put, and the stats drop their chart.
  const [overflow, setOverflow] = useState(0)
  const [topContent, setTopContent] = useState(0)
  const shift = useSharedValue(0)
  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (reduced ? 0 : (1 - vis.value) * -56) - shift.value }] }))
  const bottomStyle = useAnimatedStyle(() => ({ transform: [{ translateY: reduced ? 0 : (1 - vis.value) * 72 }] }))

  const sNow = split ?? lastSplit.current
  const want = sNow ? topShift(overflow, !foldSplit, sNow.top, insets.top + 56, topContent, Spacing.lg) : 0
  useEffect(() => {
    shift.value = reduced ? withTiming(want, { duration: 180 }) : withSpring(want, Spring.entrance)
  }, [want])

  // Keep the last song's colours while the new cover's are worked out: dropping them
  // swapped the aurora for a plain fill and back, a grey flash on every song change.
  const lastAurora = React.useRef(m.auroraColors)
  if (m.auroraColors) lastAurora.current = m.auroraColors
  const s = split ?? lastSplit.current
  if (!mounted || !s) return null

  const topH = s.top, bottomH = s.bottom
  const auroraColors = lastAurora.current
  const padTop = insets.top + 56
  const flat = !foldSplit

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents={show ? 'auto' : 'none'}
      accessibilityViewIsModal={show}>
      {auroraColors
        ? <Aurora colors={auroraColors} base={Colors.background} dim={0.48} style={StyleSheet.absoluteFill} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.background }]} />}

      <Animated.View style={topStyle}>
        <UpNextTop m={m} state={upNext.state} W={W} height={topH} padTop={padTop} skipFirst={false} onContentH={setTopContent} />
      </Animated.View>
      <Animated.View style={bottomStyle}>
        <UpNextStrip m={m} state={upNext.state} refresh={upNext.refresh} W={W} height={bottomH} padBottom={Math.max(insets.bottom, Spacing.lg)}
          roomy={flat} onOverflow={setOverflow} />
      </Animated.View>

      {/* ── close, top right of the standing half ── */}
      <View style={[styles.chrome, { top: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => { haptic.light(); setDismissed(true); requestTabletop(false) }} hitSlop={12} style={styles.close}
          accessibilityRole="button" accessibilityLabel="Close tabletop view">
          <Ionicons name="chevron-down" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root:    { zIndex: 60, elevation: 60 },
  close:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.glass },
  chrome:  { position: 'absolute', right: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, zIndex: 5 },
})
