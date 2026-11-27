import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'
import { Chip } from '@/components/ui'
import { artistHref, songHref, roundLinkList, type PageRef } from '@/utils/itemStats'

/** "ROUND 3 OF 10" on the left, the score on the right. */
export function ScoreLine({ left, right }: { left: string; right: string }) {
  return (
    <View style={g.scoreLine} accessible accessibilityLabel={`${left}. ${right}`}>
      <Text style={g.overline}>{left}</Text>
      <Text style={g.scoreRight}>{right}</Text>
    </View>
  )
}

export type { PageRef }

/**
 * After a game (never mid-question: a page would give the answer away), the artists
 * and songs it used, each a link to its page (2.0.43). Newest first, no repeats.
 */
export function RoundLinks({ items, max = 6 }: { items: PageRef[]; max?: number }) {
  const list = roundLinkList(items, max)
  if (!list.length) return null
  return (
    <View style={g.links}>
      <Text style={g.overline}>FROM THIS ROUND</Text>
      <View style={g.linkChips}>
        {list.map(it => (
          <Chip key={`${it.kind}|${it.name}|${it.artist ?? ''}`} label={it.name} icon={it.kind === 'artist' ? 'person' : 'musical-note'}
            onPress={() => router.push(it.kind === 'artist' ? artistHref(it.name) : songHref(it.name, it.artist!))} />
        ))}
      </View>
    </View>
  )
}

export const g = StyleSheet.create({
  links:      { gap: Spacing.sm, marginTop: Spacing.md },
  linkChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  scoreLine:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 2 },
  overline:   { fontFamily: FontFamily.monoMedium, fontSize: FontSize.xs, letterSpacing: 2, color: Colors.textMuted },
  scoreRight: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: '#FFB347' },
  title:      { fontFamily: FontFamily.syneBold, fontSize: FontSize['2xl'], color: Colors.text, letterSpacing: -1 },
  question:   { fontFamily: FontFamily.syneBold, fontSize: FontSize.lg + 2, lineHeight: 26, color: Colors.text, letterSpacing: -0.5 },
  rules:      { fontFamily: FontFamily.mono, fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.5, color: Colors.textMuted, marginVertical: Spacing.sm },
  best:       { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.greenPrimary, marginBottom: Spacing.sm },
  foot:       { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  center:     { paddingVertical: Spacing.xl, alignItems: 'center' },
  bigScore:   { fontFamily: FontFamily.syneBold, fontSize: 56, color: Colors.text },
  panel:      { borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass, padding: Spacing.lg },
  option:     { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass },
  optionRight: { borderColor: alpha(Colors.greenPrimary, 0.7), backgroundColor: alpha(Colors.greenPrimary, 0.12) },
  optionWrong: { borderColor: alpha(Colors.error, 0.7), backgroundColor: alpha(Colors.error, 0.1) },
  optionName: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.base, color: Colors.text },
  optionSub:  { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
})
