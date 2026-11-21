import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Colors, Spacing, Type } from '@/constants/theme'

/**
 * Design system — a ranked row for top-N lists (artists, tracks, albums, genres):
 *
 *   1  Name  artist                       12h
 *      ████████████░░░░░░
 *
 * `frac` (0–1) is the bar length relative to the #1 item; `color` is the list's
 * colour (artists accent · tracks pink · albums lavender). `trailing` sits outside
 * the pressable area (e.g. the queue ＋) so tapping it doesn't open the item.
 * `leading` goes between the rank and the name — the cover (ArtThumb).
 */
export const RankRow = React.memo(function RankRow({ rank, name, sub, value, frac, color = Colors.greenPrimary, onPress, trailing, leading }: {
  rank?:     number
  leading?:  React.ReactNode
  name:      string
  sub?:      string
  value:     string
  frac:      number
  color?:    string
  onPress?:  () => void
  trailing?: React.ReactNode
}) {
  const body = (
    <View style={styles.body}>
      {rank != null && <Text style={styles.rank}>{rank}</Text>}
      {leading}
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}{sub ? <Text style={styles.sub}>  {sub}</Text> : null}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(2, Math.min(1, frac) * 100)}%`, backgroundColor: color }]} />
        </View>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
  return (
    <View style={styles.row}>
      {onPress ? (
        <TouchableOpacity
          style={styles.flex} onPress={onPress} activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`${rank != null ? `${rank}. ` : ''}${name}${sub ? `, ${sub}` : ''}, ${value}`}
        >
          {body}
        </TouchableOpacity>
      ) : (
        <View style={styles.flex} accessible accessibilityLabel={`${rank != null ? `${rank}. ` : ''}${name}${sub ? `, ${sub}` : ''}, ${value}`}>
          {body}
        </View>
      )}
      {trailing}
    </View>
  )
})

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex:  { flex: 1, minWidth: 0 },
  body:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5 },
  rank:  { ...Type.caption, width: 18, textAlign: 'right' },
  text:  { flex: 1, gap: 5, minWidth: 0 },
  name:  { ...Type.label, fontSize: 12, color: Colors.textSecondary },
  sub:   { ...Type.caption },
  track: { height: 4, backgroundColor: Colors.glass, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  fill:  { height: '100%', borderRadius: 2, opacity: 0.85 },
  value: { ...Type.caption, minWidth: 52, textAlign: 'right' },
})
