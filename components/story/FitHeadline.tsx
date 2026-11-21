import React, { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle, type LayoutChangeEvent } from 'react-native'
import { KineticText } from '@/components/motion/KineticText'

/**
 * How much to shrink: the longest word must fit on a line, and all the words must fit
 * in `maxLines` (with slack for the ragged right edge of wrapped lines). 1 = full size.
 */
export function fitScale(wordWidths: number[], avail: number, maxLines = 3, minScale = 0.42): number {
  if (!wordWidths.length || avail <= 0) return 1
  const longest = Math.max(...wordWidths)
  const total = wordWidths.reduce((a, w) => a + w, 0)
  const s = Math.min(1, (avail - 2) / longest, (maxLines * avail * 0.85) / total)
  return Math.max(minScale, s)
}

/**
 * A story headline that always fits: KineticText (each word rises from its own slot)
 * at the largest size where the longest word fits the width and the whole line fits in
 * `maxLines`. Before 2.0.12 the big display face ran at a fixed 46 pt and a long title
 * ("CONTRADICTIONS") was cut to "CONTRA" by its word slot.
 *
 * Measures every word once at full size (invisible, off-layout), then renders.
 */
export function FitHeadline({ text, style, maxLines = 3, minScale = 0.42, delay, stagger, containerStyle }: {
  text: string
  style: StyleProp<TextStyle>
  maxLines?: number
  /** Never smaller than this share of the base size. */
  minScale?: number
  delay?: number
  stagger?: number
  containerStyle?: StyleProp<ViewStyle>
}) {
  const base = StyleSheet.flatten(style) ?? {}
  const words = useMemo(() => text.split(' ').filter(Boolean), [text])
  const [avail, setAvail] = useState(0)
  const widths = useRef<number[]>([])
  const [measured, setMeasured] = useState<number[] | null>(null)

  const onWord = useCallback((i: number, e: LayoutChangeEvent) => {
    widths.current[i] = e.nativeEvent.layout.width
    if (widths.current.filter(w => w !== undefined).length === words.length) setMeasured([...widths.current])
  }, [words.length])

  const scale = useMemo(
    () => (!measured || !avail ? null : fitScale(measured, avail, maxLines, minScale)),
    [measured, avail, maxLines, minScale],
  )

  const fontSize = (base.fontSize ?? 46)
  const lineHeight = (base.lineHeight as number | undefined) ?? fontSize * 1.13
  const fitted: TextStyle | null = scale === null ? null : {
    ...base,
    fontSize: Math.floor(fontSize * scale),
    lineHeight: Math.ceil(lineHeight * scale),
    letterSpacing: base.letterSpacing !== undefined ? base.letterSpacing * scale : undefined,
  }

  return (
    <View onLayout={e => setAvail(e.nativeEvent.layout.width)} style={{ alignSelf: 'stretch' }}>
      {/* Invisible measuring row: every word at full size, unconstrained width. */}
      {!measured && (
        <View style={styles.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {words.map((w, i) => (
            <Text key={`${i}-${w}`} style={[base, styles.noShrink]} onLayout={e => onWord(i, e)}>{w}</Text>
          ))}
        </View>
      )}
      {fitted
        ? <KineticText text={text} style={fitted} delay={delay} stagger={stagger} containerStyle={containerStyle} />
        : <View style={{ height: lineHeight }} />}
    </View>
  )
}

const styles = StyleSheet.create({
  measure:  { position: 'absolute', left: 0, top: 0, width: 10_000, flexDirection: 'row', alignItems: 'flex-start', opacity: 0 },
  noShrink: { flexShrink: 0 },
})
