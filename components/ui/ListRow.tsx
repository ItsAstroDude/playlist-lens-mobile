import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native'
import { Colors, Spacing, Radius, Type, alpha } from '@/constants/theme'
import { Icon, type IconName } from '@/components/ui/Icon'

/**
 * Design system — rows (inside a Card / Section).
 *  ListRow    icon tile · label + hint · value or confirmation chip · chevron when tappable
 *  ToggleRow  same anatomy with a Switch
 *  Tile       the tinted icon square, usable on its own
 */

// Tile tints — mid-tones that read on both the dark and the light theme.
export const TINT = {
  accent: Colors.greenPrimary,
  violet: '#8B7CF6',
  pink:   '#F0609E',
  sky:    '#3FA9F5',
  amber:  '#F5A524',
  danger: Colors.error,
} as const
export type Tint = keyof typeof TINT

export function Tile({ icon, tint = 'accent', size = 32 }: { icon: IconName; tint?: Tint; size?: number }) {
  const c = TINT[tint]
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: alpha(c, 0.15), borderColor: alpha(c, 0.28) }]}>
      <Icon name={icon} size={Math.round(size / 2)} color={c} />
    </View>
  )
}

function RowText({ label, hint, danger }: { label: string; hint?: string; danger?: boolean }) {
  return (
    <View style={styles.text}>
      <Text style={[styles.label, danger && { color: Colors.error }]} numberOfLines={1}>{label}</Text>
      {hint ? <Text style={styles.hint} numberOfLines={2}>{hint}</Text> : null}
    </View>
  )
}

export function ListRow({
  icon, tint = 'accent', label, hint, value, valueTone, onPress, danger, last,
}: {
  icon:       IconName
  tint?:      Tint
  label:      string
  hint?:      string
  value?:     string
  /** 'ok' renders the value as a green confirmation chip (e.g. "Cleared"). */
  valueTone?: 'ok'
  onPress?:   () => void
  danger?:    boolean
  last?:      boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={[label, value].filter(Boolean).join(', ')}
      accessibilityHint={hint}
    >
      <Tile icon={icon} tint={danger ? 'danger' : tint} />
      <RowText label={label} hint={hint} danger={danger} />
      {value ? (
        valueTone === 'ok'
          ? <View style={styles.okChip}><Icon name="checkmark" size={12} color={Colors.greenPrimary} /><Text style={styles.okText}>{value}</Text></View>
          : <Text style={styles.value} numberOfLines={1}>{value}</Text>
      ) : null}
      {onPress && !danger && <Icon name="chevron-forward" size={15} color={Colors.textMuted} />}
    </TouchableOpacity>
  )
}

export function ToggleRow({
  icon, tint = 'accent', label, hint, value, onValueChange, last, disabled,
}: {
  icon:          IconName
  tint?:         Tint
  label:         string
  hint?:         string
  value:         boolean
  onValueChange: (v: boolean) => void
  last?:         boolean
  disabled?:     boolean
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Tile icon={icon} tint={tint} />
      <RowText label={label} hint={hint} />
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityHint={hint}
        trackColor={{ false: Colors.glassBorder, true: alpha(Colors.greenPrimary, 0.45) }}
        thumbColor={value ? Colors.greenPrimary : '#9a9a9a'}
        ios_backgroundColor={Colors.glassBorder}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.md,
    minHeight:         56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  tile:    { borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text:    { flex: 1, minWidth: 0, gap: 2 },
  label:   Type.label,
  hint:    Type.caption,
  value:   { ...Type.caption, fontSize: 11, color: Colors.textSecondary, maxWidth: 140 },
  okChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
    backgroundColor: alpha(Colors.greenPrimary, 0.12),
  },
  okText: { ...Type.caption, fontFamily: Type.label.fontFamily, color: Colors.greenPrimary },
})
