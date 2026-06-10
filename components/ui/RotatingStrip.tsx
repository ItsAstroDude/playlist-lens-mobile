import React, { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Pressable, View, Text } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { loadCachedWrapped } from '@/hooks/useWrapped'
import { wrappedTeasers } from '@/utils/wrapped'
import { reduceMotionEnabled, getCustomQuote } from '@/utils/settings'

/**
 * The Lenses top strip — tappable, stat-aware, alive.
 *  • Rotates music quotes/tips AND the user's own numbers (from imported history).
 *  • Tap to skip to the next line.
 *  • `override` pins a message (e.g. the cold-start status) and pauses rotation.
 *  • Honours the Reduce-motion setting (no auto-rotate / fades — still tappable).
 * Each line is "<glyph>  <text>"; the glyph is tinted with a cycling accent.
 */
const QUOTES = [
  '✦  Every playlist tells a story.',
  '♪  Where words fail, music speaks.',
  '◎  Tap your taste profile for the big picture.',
  '◐  Import your lifetime history in Wrapped.',
  '♥  Pretending the aux is yours again.',
  '✦  Without music, life would be a mistake.',
  '☾  Your late-night playlist knows things.',
  '◍  Compare two playlists — see who really wins.',
  '⤳  Skips are just unspoken opinions.',
  '♪  Good taste is a playlist away.',
]

const ACCENTS = [Colors.greenPrimary, Colors.lavender, Colors.pink]
const ROTATE_MS = 5600

/** Split "<glyph>  <rest>" → ['<glyph>', '<rest>']; falls back gracefully. */
function splitGlyph(line: string): [string, string] {
  const m = line.match(/^(\S+)\s{2,}(.*)$/)
  return m ? [m[1], m[2]] : ['✦', line]
}

/** Interleave teasers + quotes so a personal stat shows up early. */
function buildPool(): string[] {
  const teasers = wrappedTeasers(loadCachedWrapped())
  const out: string[] = []
  // The user's custom banner (Settings → Appearance) leads the rotation.
  const custom = getCustomQuote()
  if (custom) out.push(custom)
  if (!teasers.length) return out.concat(QUOTES)
  const max = Math.max(teasers.length, QUOTES.length)
  for (let i = 0; i < max; i++) {
    if (i < teasers.length) out.push(teasers[i])
    if (i < QUOTES.length)  out.push(QUOTES[i])
  }
  return out
}

export function RotatingStrip({ override }: { override?: string }) {
  const reduce = reduceMotionEnabled()
  const [pool, setPool] = useState(buildPool)
  // With a custom banner, open on it; otherwise land somewhere random.
  const [i, setI] = useState(() => (getCustomQuote() ? 0 : Math.floor(Math.random() * pool.length)))
  const op       = useSharedValue(1)
  const press    = useSharedValue(1)
  const timer    = useRef<ReturnType<typeof setInterval> | null>(null)

  // Re-read the custom banner when the screen regains focus (e.g. returning from
  // Settings) so edits apply live without a restart.
  const quoteRef = useRef(getCustomQuote())
  useFocusEffect(useCallback(() => {
    const q = getCustomQuote()
    if (q !== quoteRef.current) {
      quoteRef.current = q
      setPool(buildPool())
      setI(0)
    }
  }, []))

  const advance = (step = 1) => {
    if (reduce) { setI(p => (p + step + pool.length) % pool.length); return }
    op.value = withTiming(0, { duration: 280 })
    setTimeout(() => {
      setI(p => (p + step + pool.length) % pool.length)
      op.value = withTiming(1, { duration: 320 })
    }, 300)
  }

  const startTimer = () => {
    if (timer.current) clearInterval(timer.current)
    if (override || reduce) return
    timer.current = setInterval(() => advance(1), ROTATE_MS)
  }

  useEffect(() => {
    startTimer()
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [override, reduce, pool.length])

  const onPress = () => {
    if (override) return
    haptic.light()
    press.value = withSpring(0.97, { mass: 0.4, damping: 12, stiffness: 320 })
    setTimeout(() => { press.value = withSpring(1, { mass: 0.5, damping: 14, stiffness: 260 }) }, 90)
    advance(1)
    startTimer() // reset cadence after a manual skip
  }

  const textStyle  = useAnimatedStyle(() => ({ opacity: op.value }))
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }))

  const line = override ?? pool[i] ?? QUOTES[0]
  const [glyph, rest] = splitGlyph(line)
  const accent = override ? Colors.lavender : ACCENTS[i % ACCENTS.length]

  return (
    <Animated.View style={[styles.outer, pressStyle]}>
      <Pressable onPress={onPress} disabled={!!override}>
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.pill, { borderColor: `${accent}33` }]}
        >
          <View style={styles.specular} />
          <Animated.Text style={[styles.text, textStyle]} numberOfLines={1}>
            <Text style={[styles.glyph, { color: accent }]}>{glyph}  </Text>
            <Text style={styles.body}>{rest}</Text>
          </Animated.Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  )
}

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
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  specular: {
    position: 'absolute', top: 0, left: Spacing.lg, right: Spacing.lg, height: 1,
    backgroundColor: Colors.glassHighlight,
  },
  text: {
    textAlign: 'center',
  },
  glyph: {
    fontFamily: FontFamily.monoMedium,
    fontSize: FontSize.sm,
  },
  body: {
    fontFamily: FontFamily.monoMedium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
})
