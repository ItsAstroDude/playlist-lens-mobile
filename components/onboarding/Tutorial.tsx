import React, { useRef, useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, Pressable, ScrollView, Dimensions, BackHandler,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { haptic } from '@/constants/animation'

const { width: W } = Dimensions.get('window')

interface Slide { glyph: string; tint: string; title: string; body: string }

const SLIDES: Slide[] = [
  { glyph: '✦', tint: Colors.greenPrimary, title: 'Welcome to playlist.lens', body: 'Your library, seen in a new light. Here’s the 20-second tour.' },
  { glyph: '◎', tint: Colors.greenPrimary, title: 'Lenses', body: 'Tap a lens to break down its sound, genres and era. Long-press one for quick actions — Pin to top, Share, Re-analyze, or Reorder.' },
  { glyph: '◐', tint: Colors.lavender,     title: 'Wrapped', body: 'Import your Spotify history for all-time stats. Tap any artist, track or album to see its artwork — and fix it yourself if it’s wrong.' },
  { glyph: '◍', tint: Colors.pink,         title: 'Compare', body: 'Put two playlists head-to-head and see how their vibes stack up.' },
  { glyph: '⟳', tint: Colors.greenPrimary, title: 'Always fresh', body: 'Updates now arrive on their own — no reinstalling. Pull them anytime from Settings › Check for updates.' },
]

export function Tutorial({ onDone }: { onDone: () => void }) {
  const ref = useRef<ScrollView>(null)
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onDone(); return true })
    return () => sub.remove()
  }, [onDone])

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W)
    if (idx !== i) { setI(idx); haptic.light() }
  }

  const next = () => {
    if (last) { haptic.success(); onDone(); return }
    ref.current?.scrollTo({ x: (i + 1) * W, animated: true })
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#15151b', Colors.background]} style={StyleSheet.absoluteFill} />
      <View style={styles.glowTop} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable hitSlop={10} onPress={() => { haptic.light(); onDone() }}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={{ flexGrow: 0 }}
        >
          {SLIDES.map((s, idx) => (
            <View key={idx} style={styles.slide}>
              <View style={[styles.glyphWrap, { borderColor: `${s.tint}55`, backgroundColor: `${s.tint}12` }]}>
                <Text style={[styles.glyph, { color: s.tint }]}>{s.glyph}</Text>
              </View>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {SLIDES.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === i && styles.dotActive]} />
          ))}
        </View>

        <Pressable style={styles.btn} onPress={next}>
          <Text style={styles.btnText}>{last ? 'Start exploring' : 'Next'}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 70, backgroundColor: Colors.background },
  glowTop: {
    position: 'absolute', top: -120, alignSelf: 'center', width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(83,224,118,0.10)',
  },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  skip: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted },

  slide: { width: W, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing['2xl'], flex: 1 },
  glyphWrap: {
    width: 104, height: 104, borderRadius: 32, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  glyph: { fontSize: 48 },
  title: { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1, textAlign: 'center' },
  body: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: FontSize.sm * 1.6, marginTop: Spacing.md },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.glassBorder },
  dotActive: { backgroundColor: Colors.greenPrimary, width: 20 },

  btn: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing.md,
    backgroundColor: Colors.greenPrimary, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center',
  },
  btnText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.background },
})
