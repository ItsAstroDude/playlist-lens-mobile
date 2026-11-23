import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Colors, FontFamily, FontSize, Radius, Spacing, alpha } from '@/constants/theme'

/** "ROUND 3 OF 10" on the left, the score on the right. */
export function ScoreLine({ left, right }: { left: string; right: string }) {
  return (
    <View style={g.scoreLine} accessible accessibilityLabel={`${left}. ${right}`}>
      <Text style={g.overline}>{left}</Text>
      <Text style={g.scoreRight}>{right}</Text>
    </View>
  )
}

export const g = StyleSheet.create({
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
