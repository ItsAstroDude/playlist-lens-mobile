import React from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/theme'
import { useAuth } from '@/hooks/useAuth'

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  )
}

// ─── Settings row ─────────────────────────────────────────────────────────────
function SettingRow({
  icon, label, value, onPress, danger, last,
}: {
  icon:     keyof typeof Ionicons.glyphMap
  label:    string
  value?:   string
  onPress?: () => void
  danger?:  boolean
  last?:    boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons
          name={icon}
          size={16}
          color={danger ? Colors.error : Colors.textMuted}
        />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && !danger && (
        <Ionicons name="chevron-forward" size={14} color={Colors.textDim} />
      )}
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { logout } = useAuth()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.heading}>settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* App */}
        <Section label="app">
          <SettingRow icon="notifications-outline" label="Notifications"  value="Coming soon" last />
        </Section>

        {/* Spotify */}
        <Section label="spotify">
          <SettingRow icon="musical-notes-outline" label="Extended quota mode" value="Coming soon" />
          <SettingRow icon="refresh-outline"       label="Clear cache"          value="Coming soon" last />
        </Section>

        {/* About */}
        <Section label="about">
          <SettingRow icon="information-circle-outline" label="Version"    value="1.0.0" />
          <SettingRow icon="code-slash-outline"         label="Built with" value="Expo SDK 54" last />
        </Section>

        {/* Account */}
        <Section label="account">
          <SettingRow
            icon="log-out-outline"
            label="Log out"
            onPress={logout}
            danger
            last
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
  },
  backBtn: {
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily:    FontFamily.display,
    fontSize:      FontSize.xl,
    fontWeight:    '800',
    color:         Colors.text,
    letterSpacing: -0.5,
  },

  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 60, gap: Spacing.lg },

  // Section
  section:      { gap: Spacing.xs },
  sectionLabel: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    paddingLeft:   Spacing.xs,
  },
  sectionCard: {
    backgroundColor: Colors.glass,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    borderRadius:    Radius.lg,
    overflow:        'hidden',
  },

  // Row
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width:          28,
    height:         28,
    borderRadius:   Radius.sm,
    backgroundColor: Colors.glass,
    alignItems:     'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: `${Colors.error}15` },
  rowLabel: {
    flex:       1,
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.sm,
    color:      Colors.text,
  },
  rowLabelDanger: { color: Colors.error },
  rowValue: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.xs,
    color:      Colors.textDim,
  },
})
