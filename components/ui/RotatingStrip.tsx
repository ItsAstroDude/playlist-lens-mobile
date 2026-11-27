import React, { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Pressable, View, Text, InteractionManager } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
} from 'react-native-reanimated'
import { Colors, FontFamily, FontSize, Spacing, Radius, CHROME_FONT_MAX } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { loadCachedWrapped } from '@/hooks/useWrapped'
import type { WrappedStats } from '@/utils/wrapped'
import { reduceMotionEnabled, getCustomQuote } from '@/utils/settings'
import { weekFacts } from '@/utils/liveLines'
import { allTimeAsync } from '@/utils/stats'
import { peekCached } from '@/utils/sqlJob'
import { backupStatus } from '@/utils/backup'
import { buildStrip, weekStripLines, lifetimeStripLines, stripHref, type StripLine } from '@/utils/stripLines'
import { GlyphOrIcon, Icon } from '@/components/ui/Icon'
import { ArtThumb } from '@/components/ui/ArtThumb'

/**
 * The Lenses top strip (2.0.49) — lines about you, each one a way in.
 *  • Your week and your lifetime lead (utils/stripLines); quotes and tips only fill in
 *    when there's little to say about you yet.
 *  • Tap opens the line (an artist's page, a song's, your week as a story…); a line with
 *    nowhere to go skips ahead. Hold to skip any line.
 *  • `override` pins a message (e.g. the cold-start status) and pauses rotation.
 *  • Honours Reduce motion (no auto-rotate / fades — still tappable).
 */

const ACCENTS = [Colors.greenPrimary, Colors.lavender, Colors.pink]
const ROTATE_MS = 5600

/** The rotation from what's known right now — instant (saved answers only). */
function readStrip(): StripLine[] {
  const life = peekCached<WrappedStats | null>('allTime') ?? loadCachedWrapped()
  return buildStrip({
    custom: getCustomQuote(),
    week: weekStripLines(weekFacts()),
    life: lifetimeStripLines(life),
    backedUp: backupStatus().lastAt !== null,
  })
}

export function RotatingStrip({ override }: { override?: string }) {
  const reduce = reduceMotionEnabled()
  const [pool, setPool] = useState(readStrip)
  // Open on the first line (your banner or your own numbers lead); with nothing about
  // you yet, somewhere random among the quotes.
  const [i, setI] = useState(() => (pool[0]?.personal ? 0 : Math.floor(Math.random() * Math.max(1, pool.length))))
  const op    = useSharedValue(1)
  const press = useSharedValue(1)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Rebuild, keeping the line on screen in place when it's still there.
  const poolRef = useRef(pool); poolRef.current = pool
  const iRef = useRef(i); iRef.current = i
  const rebuild = useCallback(() => {
    const next = readStrip()
    const current = poolRef.current[iRef.current]?.id
    const at = current ? next.findIndex(l => l.id === current) : -1
    setPool(next)
    setI(at >= 0 ? at : 0)
  }, [])

  // Fresh numbers whenever Lenses comes back to the front (a sync, a new song, Settings).
  const first = useRef(true)
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return }
    rebuild()
  }, [rebuild]))

  // Lifetime lines come from the saved All-time answer; bring it up to date quietly
  // once the screen has settled (off the UI thread, cached until a play changes).
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      allTimeAsync(loadCachedWrapped()).then(() => rebuild(), () => {})
    })
    return () => task.cancel()
  }, [rebuild])

  const advance = (step = 1) => {
    const len = poolRef.current.length || 1
    if (reduce) { setI(p => (p + step + len) % len); return }
    op.value = withTiming(0, { duration: 280 })
    setTimeout(() => {
      setI(p => (p + step + len) % len)
      op.value = withTiming(1, { duration: 320 })
    }, 300)
  }

  const startTimer = () => {
    if (timer.current) clearInterval(timer.current)
    if (override || reduce || pool.length < 2) return
    timer.current = setInterval(() => advance(1), ROTATE_MS)
  }

  useEffect(() => {
    startTimer()
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [override, reduce, pool.length])

  const bump = () => {
    press.value = withSpring(0.97, { mass: 0.4, damping: 12, stiffness: 320 })
    setTimeout(() => { press.value = withSpring(1, { mass: 0.5, damping: 14, stiffness: 260 }) }, 90)
  }
  const skip = () => { haptic.light(); bump(); advance(1); startTimer() }

  const line: StripLine | undefined = override ? undefined : pool[i % Math.max(1, pool.length)]
  const href = line ? stripHref(line.action) : null
  const onPress = () => {
    if (override || !line) return
    if (!href) { skip(); return }
    haptic.light(); bump()
    router.push(href as never)
  }

  const textStyle  = useAnimatedStyle(() => ({ opacity: op.value }))
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }))
  const accent = override ? Colors.lavender : ACCENTS[i % ACCENTS.length]
  const text = override ?? line?.text ?? ''
  const glyph = override ? '◌' : line?.glyph ?? '✦'

  return (
    <Animated.View style={[styles.outer, pressStyle]}>
      <Pressable onPress={onPress} onLongPress={override ? undefined : skip} delayLongPress={350} disabled={!!override}
        accessibilityRole={href ? 'link' : 'button'} accessibilityLabel={text}
        accessibilityHint={href ? 'Opens it. Hold for the next line.' : 'Shows the next line'}>
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.pill, { borderColor: `${accent}33` }]}
        >
          <View style={styles.specular} />
          <Animated.View style={[styles.row, textStyle]}>
            {line?.art
              ? <ArtThumb kind={line.art.kind} name={line.art.name} artist={line.art.artist} size={22} />
              : <Text style={styles.glyph}><GlyphOrIcon glyph={glyph} size={13} color={accent} inline /></Text>}
            <Text style={styles.body} numberOfLines={1} maxFontSizeMultiplier={CHROME_FONT_MAX}>{text}</Text>
            {href ? <Icon name="chevron-forward" size={13} color={accent} /> : null}
          </Animated.View>
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
    minHeight: 40,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  specular: {
    position: 'absolute', top: 0, left: Spacing.lg, right: Spacing.lg, height: 1,
    backgroundColor: Colors.glassHighlight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 0,
  },
  glyph: {
    fontFamily: FontFamily.monoMedium,
    fontSize: FontSize.sm,
  },
  body: {
    flexShrink: 1,
    fontFamily: FontFamily.monoMedium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
})
