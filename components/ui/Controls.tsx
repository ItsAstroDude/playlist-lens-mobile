import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'
import { Colors, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { haptic } from '@/constants/animation'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Spark } from '@/components/spark/Spark'
import { useSparkMode } from '@/components/spark/director'

/**
 * Design system — small controls and display pieces.
 *  IconButton   36px glass circle (header actions, toggles). `active` = accent ring.
 *  Chip         pill for filters/segments. `selected` = filled accent.
 *  Stat         big number + caption (+ optional delta), for stat grids.
 *  EmptyState   sleeping Spark (or icon) + title + body + optional action — every empty/no-result screen.
 */

export function IconButton({ icon, onPress, label, active, style }: {
  icon:    IconName
  onPress: () => void
  /** Screen-reader label — required, an icon alone says nothing. */
  label:   string
  active?: boolean
  style?:  StyleProp<ViewStyle>
}) {
  return (
    <TouchableOpacity
      onPress={() => { haptic.light(); onPress() }}
      activeOpacity={0.7}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active !== undefined ? { selected: active } : undefined}
      style={[styles.iconBtn, active && styles.iconBtnActive, style]}
    >
      <Icon name={icon} size={17} color={active ? Colors.greenPrimary : Colors.textMuted} />
    </TouchableOpacity>
  )
}

export function Chip({ label, icon, selected, onPress }: {
  label:     string
  icon?:     IconName
  selected?: boolean
  onPress?:  () => void
}) {
  const color = selected ? Colors.background : Colors.textSecondary
  return (
    <TouchableOpacity
      onPress={onPress ? () => { haptic.light(); onPress() } : undefined}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon ? <Icon name={icon} size={13} color={color} /> : null}
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  )
}

export function Stat({ value, label, delta, style }: {
  value:  string
  label:  string
  /** e.g. +12 (vs last period). Positive → accent, negative → muted. */
  delta?: number | null
  style?: StyleProp<ViewStyle>
}) {
  const showDelta = typeof delta === 'number' && Number.isFinite(delta) && delta !== 0
  return (
    <View style={[styles.stat, style]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      {showDelta ? (
        <View style={styles.delta}>
          <Icon name={delta! > 0 ? 'arrow-up' : 'arrow-down'} size={11} color={delta! > 0 ? Colors.greenPrimary : Colors.textMuted} />
          <Text style={[styles.deltaText, { color: delta! > 0 ? Colors.greenPrimary : Colors.textMuted }]}>
            {Math.abs(delta!)}%
          </Text>
        </View>
      ) : null}
    </View>
  )
}

export function EmptyState({ icon, title, body, actionLabel, onAction }: {
  icon:         IconName
  title:        string
  body?:        string
  actionLabel?: string
  onAction?:    () => void
}) {
  // Spark naps on every empty screen (unless he's switched off).
  const spark = useSparkMode() !== 'off'
  return (
    <View style={styles.empty}>
      {spark
        ? <Spark mood="sleeping" size={76} />
        : <Icon name={icon} size={40} color={alpha(Colors.greenPrimary, 0.85)} />}
      <Text style={styles.emptyTitle} accessibilityRole="header">{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.emptyBtn} onPress={() => { haptic.light(); onAction() }} activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.emptyBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { borderColor: alpha(Colors.greenPrimary, 0.5), backgroundColor: alpha(Colors.greenPrimary, 0.1) },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm - 1,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass,
  },
  chipSelected: { backgroundColor: Colors.greenPrimary, borderColor: Colors.greenPrimary },
  chipText:     { ...Type.caption, fontFamily: Type.label.fontFamily, fontSize: 11 },

  stat:      { gap: 2, minWidth: 0 },
  statValue: Type.stat,
  statLabel: Type.caption,
  delta:     { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  deltaText: { ...Type.caption, fontFamily: Type.label.fontFamily },

  empty:      { alignItems: 'center', paddingVertical: Spacing['4xl'], paddingHorizontal: Spacing['2xl'], gap: Spacing.sm },
  emptyTitle: { ...Type.heading, textAlign: 'center', marginTop: Spacing.sm },
  emptyBody:  { ...Type.caption, fontSize: 11, textAlign: 'center', lineHeight: 17 },
  emptyBtn: {
    marginTop: Spacing.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: alpha(Colors.greenPrimary, 0.4), backgroundColor: alpha(Colors.greenPrimary, 0.1),
  },
  emptyBtnText: { ...Type.label, fontSize: 11, color: Colors.greenPrimary },
})
