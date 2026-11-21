import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { FontFamily, Spacing } from '@/constants/theme'
import { RackFocus } from '@/components/motion'
import { ArtThumb } from '@/components/ui'
import { ShareCard, CARD_W, CARD_H } from './ShareCard'
import { fmtListen, type StorySlide, type Palette } from '@/utils/story'
import type { PeriodSummary } from '@/utils/listening'

/**
 * Story mode's pictures (2.0.13): each slide fills the space under its words with
 * something to look at — the period's bars, this-vs-before, a wall of covers, the
 * day's clock, a preview of the share card. They enter with the rack-focus motion.
 */

const { width: SW, height: SH } = Dimensions.get('window')
const PAD = Spacing.xl
const INNER = SW - PAD * 2

/** The period's bars, the biggest one solid and labelled. */
export function StoryBars({ bars }: { bars: NonNullable<StorySlide['bars']> }) {
  const max = Math.max(...bars.values, 1)
  const many = bars.values.length > 14
  return (
    <RackFocus index={1} step={120}>
      <View style={styles.barsRow} accessible accessibilityLabel="Listening across the period; the biggest is highlighted">
        {bars.values.map((v, i) => (
          <View key={i} style={styles.barCol}>
            <View style={[styles.bar, {
              height: `${Math.max(3, (v / max) * 100)}%`,
              opacity: i === bars.peak ? 1 : 0.38,
              borderRadius: many ? 2 : 6,
            }]}>
              {/* the peak's value sits right on top of its bar */}
              {i === bars.peak && <Text style={styles.peakTag} numberOfLines={1}>{fmtListen(v)}</Text>}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        {bars.labels.map((l, i) => (
          <Text key={i} style={[styles.barLabel, i === bars.peak && styles.barLabelPeak]} numberOfLines={1}>{l}</Text>
        ))}
      </View>
    </RackFocus>
  )
}

/** Two big bars: this period and the one before. */
export function StoryCompare({ c }: { c: NonNullable<StorySlide['compare']> }) {
  const max = Math.max(c.now, c.before, 1)
  const rows = [
    { label: c.nowLabel, ms: c.now, strong: true },
    { label: c.beforeLabel, ms: c.before, strong: false },
  ]
  return (
    <View style={styles.compare}>
      {rows.map((r, k) => (
        <RackFocus key={k} index={k + 1} step={140}>
          <Text style={styles.compareLabel}>{r.label}</Text>
          <View style={styles.compareTrack}>
            <View style={[styles.compareFill, { width: `${Math.max(4, (r.ms / max) * 100)}%`, opacity: r.strong ? 1 : 0.42 }]} />
          </View>
          <Text style={styles.compareValue}>{fmtListen(r.ms)}</Text>
        </RackFocus>
      ))}
    </View>
  )
}

/** A grid of covers or artist photos, three across. */
export function StoryMosaic({ items }: { items: NonNullable<StorySlide['mosaic']> }) {
  const cols = 3
  const gap = Spacing.sm
  const size = Math.floor((INNER - gap * (cols - 1)) / cols)
  return (
    <View style={[styles.mosaic, { gap }]}>
      {items.map((m, k) => (
        <RackFocus key={m.name + k} index={k + 1} step={70}>
          <ArtThumb kind={m.kind} name={m.name} artist={m.artist} size={size} />
        </RackFocus>
      ))}
    </View>
  )
}

/** The listening clock, big: 24 bars with hour marks. */
export function StoryClock({ clock }: { clock: number[] }) {
  const max = Math.max(...clock, 1)
  const peak = clock.indexOf(max)
  return (
    <RackFocus index={1} step={120}>
      <View style={styles.clockRow}>
        {clock.map((v, h) => (
          <View key={h} style={styles.barCol}>
            <View style={[styles.bar, { height: `${Math.max(3, (v / max) * 100)}%`, opacity: h === peak ? 1 : 0.38, borderRadius: 3 }]} />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        {['00', '06', '12', '18', '23'].map(l => <Text key={l} style={styles.clockMark}>{l}</Text>)}
      </View>
    </RackFocus>
  )
}

/** The share card itself, scaled to the free space — what you'd send. */
export function StoryCardPreview({ s, all, palette, maxHeight }: { s: PeriodSummary; all: boolean; palette: Palette; maxHeight: number }) {
  const scale = Math.min(INNER / CARD_W, maxHeight / CARD_H, 1)
  return (
    <RackFocus index={1} step={120} style={{ alignSelf: 'center' }}>
      <View style={[styles.preview, { width: CARD_W * scale, height: CARD_H * scale }]}>
        <View style={{ width: CARD_W, height: CARD_H, transform: [{ scale }], transformOrigin: 'top left' }}>
          <ShareCard s={s} all={all} palette={palette} />
        </View>
      </View>
    </RackFocus>
  )
}

/** Room for a card preview between the words and the Share button. */
export const PREVIEW_MAX_H = Math.round(SH * 0.46)

const styles = StyleSheet.create({
  barsRow:      { flexDirection: 'row', alignItems: 'flex-end', height: Math.min(280, SH * 0.32), gap: 3 },
  clockRow:     { flexDirection: 'row', alignItems: 'flex-end', height: Math.min(240, SH * 0.28), gap: 3 },
  barCol:       { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar:          { width: '100%', backgroundColor: '#fff' },
  peakTag:      { position: 'absolute', bottom: '100%', left: '50%', width: 80, marginLeft: -40, marginBottom: 6, textAlign: 'center', fontFamily: FontFamily.monoMedium, fontSize: 12, color: '#fff' },
  barLabels:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  barLabel:     { flex: 1, textAlign: 'center', fontFamily: FontFamily.mono, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  barLabelPeak: { color: '#fff', fontFamily: FontFamily.monoMedium },
  clockMark:    { fontFamily: FontFamily.mono, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  compare:      { gap: Spacing.xl },
  compareLabel: { fontFamily: FontFamily.mono, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  compareTrack: { height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  compareFill:  { height: '100%', borderRadius: 12, backgroundColor: '#fff' },
  compareValue: { fontFamily: FontFamily.syneBold, fontSize: 22, color: '#fff', marginTop: 8, letterSpacing: -0.5 },
  mosaic:       { flexDirection: 'row', flexWrap: 'wrap' },
  preview:      {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 16,
  },
})
