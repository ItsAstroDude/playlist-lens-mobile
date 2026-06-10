import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { loadArtReports, clearArtReports, type ArtReport } from '@/hooks/useArtwork'

export default function FlaggedCoversScreen() {
  const [reports, setReports] = useState<ArtReport[]>(() => loadArtReports())

  const onClear = useCallback(() => {
    if (!reports.length) return
    Alert.alert(
      'Clear flagged covers?',
      'Removes the locally-stored list of covers you reported as wrong.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => { clearArtReports(); haptic.success(); setReports([]) } },
      ],
    )
  }, [reports.length])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.heading}>flagged covers</Text>
        <TouchableOpacity onPress={onClear} style={styles.backBtn} activeOpacity={0.7} disabled={!reports.length}>
          <Ionicons name="trash-outline" size={18} color={reports.length ? Colors.error : Colors.textDim} />
        </TouchableOpacity>
      </View>

      <Text style={styles.note}>
        Stored on this device only — there's no server collecting these yet. The 4-step fixer
        (pick · re-search · upload) resolves most covers without a report.
      </Text>

      {reports.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing flagged.</Text>
          <Text style={styles.emptySub}>Covers you report from Wrapped show up here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {reports.map((r, i) => (
            <View key={`${r.name}-${r.at}-${i}`} style={styles.row}>
              <View style={styles.kindChip}><Text style={styles.kindText}>{r.kind}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                {r.artist ? <Text style={styles.sub} numberOfLines={1}>{r.artist}</Text> : null}
              </View>
              <Text style={styles.date}>{new Date(r.at).toLocaleDateString()}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  heading: { fontFamily: FontFamily.display, fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  note: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, lineHeight: FontSize.xs * 1.5 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
    borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
  },
  kindChip: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  kindText: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  name: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.sm, color: Colors.text },
  sub: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  date: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.textDim },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingBottom: 80 },
  emptyText: { fontFamily: FontFamily.monoMedium, fontSize: FontSize.md, color: Colors.textSecondary },
  emptySub: { fontFamily: FontFamily.mono, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.xl },
})
